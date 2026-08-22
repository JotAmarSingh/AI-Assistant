package com.amarsingh.daytrace;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.provider.Settings;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Log;

import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingClient;
import com.google.android.gms.location.GeofencingRequest;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.Scope;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

@CapacitorPlugin(
        name = "DayTraceNative",
        permissions = {
                @Permission(
                        alias = "recordAudio",
                        strings = { Manifest.permission.RECORD_AUDIO }
                ),
                @Permission(
                        alias = "notifications",
                        strings = { Manifest.permission.POST_NOTIFICATIONS }
                ),
                @Permission(
                        alias = "locationForeground",
                        strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }
                ),
                @Permission(
                        alias = "locationBackground",
                        strings = { Manifest.permission.ACCESS_BACKGROUND_LOCATION }
                )
        }
)
public class DayTraceNativePlugin extends Plugin {
    private static final String TAG = "DayTraceNativePlugin";
    public static final String PREFS_ALARMS = "daytrace_scheduled_alarms";
    public static final String PREFS_AUTOMATIONS = "daytrace_automations";
    public static final String PREFS_PENDING_LOGS = "daytrace_pending_logs";
    public static final String PREFS_SYNC_QUEUE = "daytrace_sync_queue";
    private static DayTraceNativePlugin instance;
    private static JSObject pendingInitialNotificationAction = null;

    private SpeechRecognizer speechRecognizer;
    private GeofencingClient geofencingClient;
    private PendingIntent geofencePendingIntent;
    private PluginCall pendingGoogleAuthorizationCall;

    @Override
    public void load() {
        super.load();
        instance = this;
        geofencingClient = LocationServices.getGeofencingClient(getContext());
        AlarmReceiver.createNotificationChannel(getContext());
        PeriodicPromptReceiver.createNotificationChannel(getContext());
        NightlySyncWorker.scheduleNightlySync(getContext());
        Log.d(TAG, "DayTraceNativePlugin loaded on Pixel device");
    }

    public static void notifyGeofenceEvent(String locationId, String transitionType) {
        if (instance != null) {
            JSObject data = new JSObject();
            data.put("locationId", locationId);
            data.put("locationName", locationId);
            data.put("transitionType", transitionType);
            data.put("timestamp", System.currentTimeMillis());
            instance.notifyListeners("geofenceTransition", data);
        }
    }

    public static void notifyNotificationAction(String action, String reminderId, String locationName) {
        JSObject data = new JSObject();
        data.put("action", action);
        data.put("reminderId", reminderId != null ? reminderId : "");
        data.put("locationName", locationName != null ? locationName : "");
        data.put("timestamp", System.currentTimeMillis());

        if (instance != null) {
            instance.notifyListeners("notificationAction", data);
        } else {
            // Buffer for when plugin loads and React queries initial action
            pendingInitialNotificationAction = data;
        }
    }

    // ==========================================
    // 1. SPEECH RECOGNITION (On-Device Pixel Preferred)
    // ==========================================

    @PluginMethod
    public void startSpeechRecognition(PluginCall call) {
        if (getPermissionState("recordAudio") != com.getcapacitor.PermissionState.GRANTED) {
            requestPermissionForAlias("recordAudio", call, "speechPermissionCallback");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                if (speechRecognizer != null) {
                    speechRecognizer.destroy();
                    speechRecognizer = null;
                }

                Context context = getContext();
                boolean isOnDevice = false;

                // Android 13+ (API 33+) & Android 16 (API 36) On-Device Speech Recognition check
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    if (SpeechRecognizer.isOnDeviceRecognitionAvailable(context)) {
                        speechRecognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(context);
                        isOnDevice = true;
                        Log.d(TAG, "Using On-Device Pixel SpeechRecognizer");
                    }
                }

                if (speechRecognizer == null) {
                    speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context);
                    Log.d(TAG, "Using standard SpeechRecognizer");
                }

                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag());
                intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
                if (isOnDevice && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
                }

                speechRecognizer.setRecognitionListener(new RecognitionListener() {
                    @Override
                    public void onReadyForSpeech(Bundle params) {
                        JSObject event = new JSObject();
                        event.put("status", "ready");
                        notifyListeners("speechStatus", event);
                    }

                    @Override
                    public void onBeginningOfSpeech() {
                        JSObject event = new JSObject();
                        event.put("status", "listening");
                        notifyListeners("speechStatus", event);
                    }

                    @Override
                    public void onRmsChanged(float rmsdB) {}

                    @Override
                    public void onBufferReceived(byte[] buffer) {}

                    @Override
                    public void onEndOfSpeech() {
                        JSObject event = new JSObject();
                        event.put("status", "processing");
                        notifyListeners("speechStatus", event);
                    }

                    @Override
                    public void onError(int error) {
                        String message = getSpeechErrorMessage(error);
                        Log.w(TAG, "SpeechRecognizer error: " + message + " (code: " + error + ")");
                        JSObject errorObj = new JSObject();
                        errorObj.put("error", message);
                        errorObj.put("code", error);
                        notifyListeners("speechError", errorObj);
                    }

                    @Override
                    public void onResults(Bundle results) {
                        ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        String text = (matches != null && !matches.isEmpty()) ? matches.get(0) : "";
                        JSObject resultObj = new JSObject();
                        resultObj.put("transcript", text);
                        resultObj.put("isFinal", true);
                        notifyListeners("speechResult", resultObj);
                    }

                    @Override
                    public void onPartialResults(Bundle partialResults) {
                        ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        String text = (matches != null && !matches.isEmpty()) ? matches.get(0) : "";
                        if (!text.isEmpty()) {
                            JSObject resultObj = new JSObject();
                            resultObj.put("transcript", text);
                            resultObj.put("isFinal", false);
                            notifyListeners("speechResult", resultObj);
                        }
                    }

                    @Override
                    public void onEvent(int eventType, Bundle params) {}
                });

                speechRecognizer.startListening(intent);
                JSObject ret = new JSObject();
                ret.put("started", true);
                ret.put("isOnDevice", isOnDevice);
                call.resolve(ret);
            } catch (Exception e) {
                Log.e(TAG, "Failed to start speech recognition", e);
                call.reject("Failed to start speech recognition: " + e.getMessage());
            }
        });
    }

    @PermissionCallback
    private void speechPermissionCallback(PluginCall call) {
        if (getPermissionState("recordAudio") == com.getcapacitor.PermissionState.GRANTED) {
            startSpeechRecognition(call);
        } else {
            call.reject("Microphone permission was denied");
        }
    }

    @PluginMethod
    public void stopSpeechRecognition(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                if (speechRecognizer != null) {
                    speechRecognizer.stopListening();
                }
                JSObject ret = new JSObject();
                ret.put("stopped", true);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Error stopping speech: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void cancelSpeechRecognition(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                if (speechRecognizer != null) {
                    speechRecognizer.cancel();
                    speechRecognizer.destroy();
                    speechRecognizer = null;
                }
                JSObject ret = new JSObject();
                ret.put("cancelled", true);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Error cancelling speech: " + e.getMessage());
            }
        });
    }

    private String getSpeechErrorMessage(int errorCode) {
        switch (errorCode) {
            case SpeechRecognizer.ERROR_AUDIO: return "Audio recording error";
            case SpeechRecognizer.ERROR_CLIENT: return "Client side error";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: return "Insufficient microphone permissions";
            case SpeechRecognizer.ERROR_NETWORK: return "Network error";
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: return "Network timeout";
            case SpeechRecognizer.ERROR_NO_MATCH: return "No speech match found";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: return "Speech service is busy";
            case SpeechRecognizer.ERROR_SERVER: return "Server error";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: return "No speech input detected";
            default: return "Speech recognition error code: " + errorCode;
        }
    }

    // ==========================================
    // 2. NATIVE PERSISTENT AUTOMATIONS SYNCHRONIZATION
    // ==========================================

    @PluginMethod
    public void syncNativeAutomations(PluginCall call) {
        JSArray automationsArray = call.getArray("automations");
        if (automationsArray == null) {
            call.reject("automations array is required");
            return;
        }

        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_AUTOMATIONS, Context.MODE_PRIVATE);
            prefs.edit().putString("automations_list", automationsArray.toString()).apply();
            Log.d(TAG, "Persisted " + automationsArray.length() + " native automations for dead-process geofence matching");

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("count", automationsArray.length());
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to persist automations", e);
            call.reject("Failed to sync automations: " + e.getMessage());
        }
    }

    @PluginMethod
    public void syncPendingQueue(PluginCall call) {
        JSObject queueObj = call.getObject("queue");
        if (queueObj == null) {
            call.reject("queue object is required");
            return;
        }

        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_SYNC_QUEUE, Context.MODE_PRIVATE);
            prefs.edit()
                    .putString("pending_queue_json", queueObj.toString())
                    .putLong("last_queued_at", System.currentTimeMillis())
                    .putString("sync_status", "PENDING")
                    .apply();
            Log.d(TAG, "Synced unified pending queue to native storage for background WorkManager");

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to persist sync queue", e);
            call.reject("Failed to sync pending queue: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getPendingQueue(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_SYNC_QUEUE, Context.MODE_PRIVATE);
            String queueJson = prefs.getString("pending_queue_json", "{}");
            String syncStatus = prefs.getString("sync_status", "IDLE");
            long lastQueuedAt = prefs.getLong("last_queued_at", 0);

            JSObject ret = new JSObject();
            ret.put("queue", new JSObject(queueJson));
            ret.put("syncStatus", syncStatus);
            ret.put("lastQueuedAt", lastQueuedAt);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error getting pending queue", e);
            call.reject("Error getting pending queue: " + e.getMessage());
        }
    }

    @PluginMethod
    public void markNativeSyncCompleted(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_SYNC_QUEUE, Context.MODE_PRIVATE);
            prefs.edit()
                    .putString("sync_status", "SYNCED")
                    .putLong("last_synced_at", System.currentTimeMillis())
                    .apply();

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error marking sync completed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getNativePendingState(PluginCall call) {
        try {
            Context context = getContext();
            SharedPreferences autoPrefs = context.getSharedPreferences(PREFS_AUTOMATIONS, Context.MODE_PRIVATE);

            JSONArray pendingEvents = NativeEventStore.getPending(context);
            String automationsJson = autoPrefs.getString("automations_list", "[]");

            JSObject ret = new JSObject();
            ret.put("pendingLogs", new JSArray(pendingEvents.toString()));
            ret.put("pendingEvents", new JSArray(pendingEvents.toString()));
            ret.put("automations", new JSArray(automationsJson));
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error reading native pending state", e);
            call.reject("Error getting pending state: " + e.getMessage());
        }
    }

    @PluginMethod
    public void acknowledgeNativeEvents(PluginCall call) {
        JSArray eventIds = call.getArray("eventIds", new JSArray());
        int acknowledged = NativeEventStore.acknowledge(getContext(), eventIds);
        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("acknowledged", acknowledged);
        call.resolve(ret);
    }

    @PluginMethod
    public void configureNightlySync(PluginCall call) {
        try {
            String endpoint = call.getString("syncEndpoint", "");
            String authToken = call.getString("authToken", "");

            SharedPreferences prefs = getContext().getSharedPreferences(NightlySyncWorker.PREFS_SYNC, Context.MODE_PRIVATE);
            prefs.edit()
                    .putString("sync_endpoint", endpoint)
                    .putString("auth_token", authToken)
                    .apply();

            NightlySyncWorker.scheduleNightlySync(getContext());

            JSObject ret = new JSObject();
            ret.put("scheduled", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to configure nightly sync: " + e.getMessage());
        }
    }

    // ==========================================
    // 3. NATIVE ALARMMANAGER SCHEDULING (Section 9)
    // ==========================================

    @PluginMethod
    public void scheduleExactAlarm(PluginCall call) {
        String reminderId = call.getString("reminderId");
        Long triggerTimeMillis = call.getLong("triggerTimeMillis");
        String title = call.getString("title", "DayTrace Reminder");
        String message = call.getString("message", "");

        if (reminderId == null || triggerTimeMillis == null) {
            call.reject("reminderId and triggerTimeMillis are required");
            return;
        }

        try {
            Context context = getContext();
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

            if (alarmManager == null) {
                call.reject("AlarmManager service not available");
                return;
            }

            Intent intent = new Intent(context, AlarmReceiver.class);
            intent.putExtra("reminderId", reminderId);
            intent.putExtra("title", title);
            intent.putExtra("message", message);

            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    context,
                    reminderId.hashCode(),
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            boolean isExact = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTimeMillis, pendingIntent);
                } else {
                    isExact = false;
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTimeMillis, pendingIntent);
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTimeMillis, pendingIntent);
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerTimeMillis, pendingIntent);
            }

            // Persist alarm metadata in SharedPreferences for reboot restoration
            SharedPreferences prefs = context.getSharedPreferences(PREFS_ALARMS, Context.MODE_PRIVATE);
            JSONObject json = new JSONObject();
            json.put("triggerTimeMillis", triggerTimeMillis);
            json.put("title", title);
            json.put("message", message);
            prefs.edit().putString(reminderId, json.toString()).apply();

            Log.d(TAG, "Scheduled alarm " + reminderId + " exact=" + isExact + " at " + triggerTimeMillis);

            JSObject ret = new JSObject();
            ret.put("scheduled", true);
            ret.put("isExact", isExact);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to schedule exact alarm", e);
            call.reject("Failed to schedule alarm: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancelAlarm(PluginCall call) {
        String reminderId = call.getString("reminderId");
        if (reminderId == null) {
            call.reject("reminderId is required");
            return;
        }

        try {
            Context context = getContext();
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);

            if (alarmManager != null) {
                Intent intent = new Intent(context, AlarmReceiver.class);
                PendingIntent pendingIntent = PendingIntent.getBroadcast(
                        context,
                        reminderId.hashCode(),
                        intent,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );
                alarmManager.cancel(pendingIntent);
            }

            SharedPreferences prefs = context.getSharedPreferences(PREFS_ALARMS, Context.MODE_PRIVATE);
            prefs.edit().remove(reminderId).apply();

            JSObject ret = new JSObject();
            ret.put("cancelled", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to cancel alarm: " + e.getMessage());
        }
    }

    @PluginMethod
    public void canScheduleExactAlarms(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager alarmManager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            ret.put("canScheduleExact", alarmManager != null && alarmManager.canScheduleExactAlarms());
        } else {
            ret.put("canScheduleExact", true);
        }
        call.resolve(ret);
    }

    // ==========================================
    // 4. NATIVE GEOFENCING CLIENT (Section 10)
    // ==========================================

    @PluginMethod
    public void registerGeofences(PluginCall call) {
        JSArray locationsArray = call.getArray("locations");
        if (locationsArray == null || locationsArray.length() == 0) {
            call.reject("locations array is required");
            return;
        }

        // Check foreground location first
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            call.reject("Foreground location permission (ACCESS_FINE_LOCATION) is required for geofencing.");
            return;
        }

        try {
            List<Geofence> geofenceList = new ArrayList<>();

            for (int i = 0; i < locationsArray.length(); i++) {
                JSONObject loc = locationsArray.getJSONObject(i);
                String id = loc.getString("id");
                double lat = loc.getDouble("latitude");
                double lng = loc.getDouble("longitude");
                float radius = (float) loc.optDouble("radiusMeters", 200.0);

                geofenceList.add(new Geofence.Builder()
                        .setRequestId(id)
                        .setCircularRegion(lat, lng, radius)
                        .setExpirationDuration(Geofence.NEVER_EXPIRE)
                        .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER | Geofence.GEOFENCE_TRANSITION_EXIT)
                        .build());
            }

            GeofencingRequest request = new GeofencingRequest.Builder()
                    .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER)
                    .addGeofences(geofenceList)
                    .build();

            geofencePendingIntent = getGeofencePendingIntent();

            geofencingClient.addGeofences(request, geofencePendingIntent)
                    .addOnSuccessListener(aVoid -> {
                        Log.d(TAG, "Successfully registered " + geofenceList.size() + " native geofences");
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        ret.put("registeredCount", geofenceList.size());
                        call.resolve(ret);
                    })
                    .addOnFailureListener(e -> {
                        Log.e(TAG, "Failed to register geofences", e);
                        call.reject("Failed to register geofences: " + e.getMessage());
                    });
        } catch (Exception e) {
            Log.e(TAG, "Error parsing geofence registration", e);
            call.reject("Geofence registration error: " + e.getMessage());
        }
    }

    @PluginMethod
    public void removeAllGeofences(PluginCall call) {
        try {
            if (geofencePendingIntent == null) {
                geofencePendingIntent = getGeofencePendingIntent();
            }
            geofencingClient.removeGeofences(geofencePendingIntent)
                    .addOnSuccessListener(aVoid -> {
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        call.resolve(ret);
                    })
                    .addOnFailureListener(e -> call.reject("Failed to remove geofences: " + e.getMessage()));
        } catch (Exception e) {
            call.reject("Error removing geofences: " + e.getMessage());
        }
    }

    private PendingIntent getGeofencePendingIntent() {
        if (geofencePendingIntent != null) {
            return geofencePendingIntent;
        }
        Intent intent = new Intent(getContext(), GeofenceBroadcastReceiver.class);
        geofencePendingIntent = PendingIntent.getBroadcast(
                getContext(),
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE
        );
        return geofencePendingIntent;
    }

    // ==========================================
    // 5. ON-DEVICE AI / GEMINI NANO STATUS (Section 7)
    // ==========================================

    @PluginMethod
    public void checkGeminiNanoStatus(PluginCall call) {
        JSObject ret = new JSObject();
        
        // Runtime feature detection for Pixel / Android AICore & Prompt API
        // Truthful reporting per requirement 9: Check if AICore service exists
        boolean hasAiCoreService = false;
        try {
            PackageManager pm = getContext().getPackageManager();
            pm.getPackageInfo("com.google.android.aicore", 0);
            hasAiCoreService = true;
        } catch (PackageManager.NameNotFoundException ignored) {}

        // Non-blocking: Return UNAVAILABLE per requirement 9 unless official runtime feature confirms prompt model
        String status = "UNAVAILABLE";

        ret.put("status", status);
        ret.put("hasAiCorePackage", hasAiCoreService);
        ret.put("deviceModel", Build.MODEL);
        ret.put("androidVersion", Build.VERSION.RELEASE);
        ret.put("sdkInt", Build.VERSION.SDK_INT);
        call.resolve(ret);
    }

    // ==========================================
    // 6. PIXEL HAPTICS (Section 13)
    // ==========================================

    @PluginMethod
    public void triggerHaptic(PluginCall call) {
        String type = call.getString("type", "impactMedium");
        try {
            Context context = getContext();
            Vibrator vibrator;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                VibratorManager vibratorManager = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                vibrator = vibratorManager != null ? vibratorManager.getDefaultVibrator() : (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            } else {
                vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            }

            if (vibrator != null && vibrator.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    int effectId = VibrationEffect.EFFECT_CLICK;
                    if ("impactHeavy".equalsIgnoreCase(type) || "taskDone".equalsIgnoreCase(type)) {
                        effectId = VibrationEffect.EFFECT_HEAVY_CLICK;
                    } else if ("tick".equalsIgnoreCase(type) || "light".equalsIgnoreCase(type)) {
                        effectId = VibrationEffect.EFFECT_TICK;
                    } else if ("notification".equalsIgnoreCase(type) || "doubleClick".equalsIgnoreCase(type)) {
                        effectId = VibrationEffect.EFFECT_DOUBLE_CLICK;
                    }
                    vibrator.vibrate(VibrationEffect.createPredefined(effectId));
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(40, VibrationEffect.DEFAULT_AMPLITUDE));
                } else {
                    vibrator.vibrate(40);
                }
            }
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Haptic error: " + e.getMessage());
        }
    }

    // ==========================================
    // 7. NATIVE ACCOUNTABILITY PROMPTS (Lock-Screen & AlarmManager)
    // ==========================================

    @PluginMethod
    public void configurePeriodicPrompt(PluginCall call) {
        try {
            boolean enabled = call.getBoolean("enabled", true);
            int intervalMinutes = Math.max(1, call.getInt("intervalMinutes", 30));
            String wakeUpTime = call.getString("wakeUpTime", "07:00");
            String bedTime = call.getString("bedTime", "23:30");
            boolean gamingMode = call.getBoolean("gamingModeActive", false);
            long incomingSnooze = call.getLong("snoozedUntilMillis", 0L);
            JSArray suggestedTasks = call.getArray("suggestedTasks", new JSArray());
            long lastActivityTimestampMillis = call.getLong("lastActivityTimestampMillis", 0L);

            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(PeriodicPromptReceiver.PREFS_PROMPT_CONFIG, Context.MODE_PRIVATE);
            boolean wasConfigured = prefs.getBoolean("configured", false);
            boolean previousEnabled = prefs.getBoolean("enabled", false);
            boolean previousGamingMode = prefs.getBoolean("gaming_mode", false);
            int previousInterval = prefs.getInt("interval_minutes", 30);
            String previousWake = prefs.getString("wake_up_time", "07:00");
            String previousBed = prefs.getString("bed_time", "23:30");
            long previousSnooze = prefs.getLong("snoozed_until", 0L);
            long prevActivityTime = prefs.getLong("last_activity_time", 0L);
            long now = System.currentTimeMillis();
            long effectiveSnooze = Math.max(incomingSnooze, previousSnooze > now ? previousSnooze : 0L);
            boolean isActivityUpdated = lastActivityTimestampMillis > prevActivityTime;
            boolean scheduleConfigChanged = !wasConfigured || enabled != previousEnabled
                    || gamingMode != previousGamingMode || intervalMinutes != previousInterval
                    || !wakeUpTime.equals(previousWake) || !bedTime.equals(previousBed)
                    || effectiveSnooze != previousSnooze;

            SharedPreferences.Editor editor = prefs.edit()
                    .putBoolean("configured", true)
                    .putBoolean("enabled", enabled)
                    .putInt("interval_minutes", intervalMinutes)
                    .putString("wake_up_time", wakeUpTime)
                    .putString("bed_time", bedTime)
                    .putBoolean("gaming_mode", gamingMode)
                    .putLong("snoozed_until", effectiveSnooze)
                    .putString("suggested_tasks", suggestedTasks != null ? suggestedTasks.toString() : "[]");

            if (lastActivityTimestampMillis > 0) {
                editor.putLong("last_activity_time", lastActivityTimestampMillis);
            }
            editor.commit();

            if (!enabled || gamingMode) {
                PeriodicPromptReceiver.cancelPrompt(context);
            } else if (effectiveSnooze > now) {
                PeriodicPromptReceiver.scheduleAlarmAtTime(context, effectiveSnooze);
            } else if (isActivityUpdated) {
                PeriodicPromptReceiver.scheduleAlarmAtTime(context, Math.max(lastActivityTimestampMillis + intervalMinutes * 60_000L, now + 1_000L));
            } else if (scheduleConfigChanged) {
                PeriodicPromptReceiver.scheduleNextPrompt(context);
            } else {
                PeriodicPromptReceiver.ensurePromptScheduled(context);
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("enabled", enabled);
            ret.put("intervalMinutes", intervalMinutes);
            ret.put("nextTriggerAtMillis", prefs.getLong("next_scheduled_trigger", 0L));
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error configuring periodic prompt", e);
            call.reject("Failed to configure periodic prompt: " + e.getMessage());
        }
    }

    @PluginMethod
    public void triggerTestPeriodicPrompt(PluginCall call) {
        int delaySeconds = call.getInt("delaySeconds", 10);
        Context context = getContext();

        try {
            if (delaySeconds <= 0) {
                PeriodicPromptReceiver.showAccountabilityNotification(context, PeriodicPromptReceiver.TEST_NOTIFICATION_ID, true);
            } else {
                long triggerAt = System.currentTimeMillis() + (delaySeconds * 1000L);
                PeriodicPromptReceiver.scheduleTestAlarmAtTime(context, triggerAt);
                Log.d(TAG, "Scheduled test accountability notification in " + delaySeconds + " seconds");
            }

            JSObject ret = new JSObject();
            ret.put("scheduled", true);
            ret.put("delaySeconds", delaySeconds);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Error triggering test periodic prompt", e);
            call.reject("Failed to trigger test prompt: " + e.getMessage());
        }
    }

    @PluginMethod
    public void checkNotificationPermission(PluginCall call) {
        JSObject ret = new JSObject();
        Context context = getContext();
        boolean runtimeGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
                || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        boolean notificationsEnabled = NotificationManagerCompat.from(context).areNotificationsEnabled();
        boolean channelEnabled = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            NotificationChannel channel = manager != null ? manager.getNotificationChannel(PeriodicPromptReceiver.CHANNEL_ID) : null;
            channelEnabled = channel == null || channel.getImportance() != NotificationManager.IMPORTANCE_NONE;
        }
        String permissionState = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                ? getPermissionState("notifications").toString().toLowerCase(Locale.US) : "granted";
        boolean granted = runtimeGranted && notificationsEnabled && channelEnabled;
        String status = granted ? "GRANTED" : (permissionState.contains("prompt") ? "NOT_REQUESTED" : "DENIED");
        ret.put("granted", granted);
        ret.put("status", status);
        ret.put("runtimeGranted", runtimeGranted);
        ret.put("notificationsEnabled", notificationsEnabled);
        ret.put("channelEnabled", channelEnabled);
        ret.put("canRequest", "NOT_REQUESTED".equals(status));
        call.resolve(ret);
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (getPermissionState("notifications") != com.getcapacitor.PermissionState.GRANTED) {
                requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
                return;
            }
        }
        JSObject ret = new JSObject();
        ret.put("granted", true);
        call.resolve(ret);
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        boolean granted = getPermissionState("notifications") == com.getcapacitor.PermissionState.GRANTED;
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        try {
            Context context = getContext();
            Intent intent = new Intent();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, context.getPackageName());
            } else {
                intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.fromParts("package", context.getPackageName(), null));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to open notification settings: " + e.getMessage());
        }
    }

    // ==========================================
    // 8. NATIVE GOOGLE SHEETS AUTHORIZATION
    // ==========================================

    @PluginMethod
    public void requestGoogleSheetsAccess(PluginCall call) {
        if (!(getActivity() instanceof MainActivity)) {
            call.reject("DayTrace activity is unavailable for Google authorization");
            return;
        }
        if (pendingGoogleAuthorizationCall != null) {
            call.reject("A Google authorization request is already in progress");
            return;
        }

        List<Scope> requestedScopes = Arrays.asList(
                new Scope("https://www.googleapis.com/auth/spreadsheets"),
                new Scope("https://www.googleapis.com/auth/drive.file")
        );
        AuthorizationRequest request = AuthorizationRequest.builder()
                .setRequestedScopes(requestedScopes)
                .build();

        Identity.getAuthorizationClient(getActivity())
                .authorize(request)
                .addOnSuccessListener(result -> {
                    if (!result.hasResolution()) {
                        resolveGoogleAuthorization(call, result);
                        return;
                    }
                    pendingGoogleAuthorizationCall = call;
                    MainActivity activity = (MainActivity) getActivity();
                    activity.launchGoogleAuthorization(
                            result.getPendingIntent(),
                            new MainActivity.GoogleAuthorizationResultCallback() {
                                @Override
                                public void onResult(Intent data) {
                                    PluginCall pendingCall = pendingGoogleAuthorizationCall;
                                    pendingGoogleAuthorizationCall = null;
                                    if (pendingCall == null) return;
                                    try {
                                        AuthorizationResult authorizationResult = Identity
                                                .getAuthorizationClient(getActivity())
                                                .getAuthorizationResultFromIntent(data);
                                        resolveGoogleAuthorization(pendingCall, authorizationResult);
                                    } catch (ApiException error) {
                                        pendingCall.reject("Google authorization failed (" + error.getStatusCode() + "): " + error.getMessage());
                                    }
                                }

                                @Override
                                public void onCancelled() {
                                    PluginCall pendingCall = pendingGoogleAuthorizationCall;
                                    pendingGoogleAuthorizationCall = null;
                                    if (pendingCall != null) pendingCall.reject("Google authorization was cancelled");
                                }
                            }
                    );
                })
                .addOnFailureListener(error -> call.reject(
                        "Google authorization could not start. Verify the Android OAuth client for com.amarsingh.daytrace and its signing SHA-1: "
                                + error.getMessage()
                ));
    }

    private void resolveGoogleAuthorization(PluginCall call, AuthorizationResult result) {
        String accessToken = result.getAccessToken();
        if (accessToken == null || accessToken.isEmpty()) {
            call.reject("Google authorization returned no access token");
            return;
        }
        JSObject response = new JSObject();
        response.put("accessToken", accessToken);
        response.put("expiresInSeconds", 3600);
        call.resolve(response);
    }

    @PluginMethod
    public void getPendingNotificationAction(PluginCall call) {
        JSObject ret = new JSObject();
        if (pendingInitialNotificationAction != null) {
            ret.put("hasAction", true);
            ret.put("action", pendingInitialNotificationAction.getString("action"));
            ret.put("reminderId", pendingInitialNotificationAction.getString("reminderId"));
            ret.put("locationName", pendingInitialNotificationAction.getString("locationName"));
            pendingInitialNotificationAction = null; // Clear once consumed
        } else {
            ret.put("hasAction", false);
        }
        call.resolve(ret);
    }

    @Override
    protected void handleOnDestroy() {
        if (speechRecognizer != null) {
            speechRecognizer.destroy();
            speechRecognizer = null;
        }
        if (pendingGoogleAuthorizationCall != null) {
            pendingGoogleAuthorizationCall.reject("Google authorization was interrupted because DayTrace closed");
            pendingGoogleAuthorizationCall = null;
        }
        super.handleOnDestroy();
    }
}
