package com.amarsingh.daytrace;

import android.Manifest;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Log;

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

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
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
    private static DayTraceNativePlugin instance;

    private SpeechRecognizer speechRecognizer;
    private GeofencingClient geofencingClient;
    private PendingIntent geofencePendingIntent;

    @Override
    public void load() {
        super.load();
        instance = this;
        geofencingClient = LocationServices.getGeofencingClient(getContext());
        AlarmReceiver.createNotificationChannel(getContext());
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
    // 2. NATIVE ALARMMANAGER SCHEDULING (Section 9)
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
    // 3. NATIVE GEOFENCING CLIENT (Section 10)
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
    // 4. ON-DEVICE AI / GEMINI NANO STATUS (Section 7)
    // ==========================================

    @PluginMethod
    public void checkGeminiNanoStatus(PluginCall call) {
        JSObject ret = new JSObject();
        
        // Runtime feature detection for Pixel / Android AICore & Prompt API
        // Truthful reporting: Check if AICore service or ML Kit GenAI Prompt model exists
        boolean hasAiCoreService = false;
        try {
            PackageManager pm = getContext().getPackageManager();
            pm.getPackageInfo("com.google.android.aicore", 0);
            hasAiCoreService = true;
        } catch (PackageManager.NameNotFoundException ignored) {}

        String status = "UNAVAILABLE";
        if (hasAiCoreService) {
            status = "AVAILABLE"; // AICore package is present on Pixel system
        }

        ret.put("status", status);
        ret.put("hasAiCorePackage", hasAiCoreService);
        ret.put("deviceModel", Build.MODEL);
        ret.put("androidVersion", Build.VERSION.RELEASE);
        ret.put("sdkInt", Build.VERSION.SDK_INT);
        call.resolve(ret);
    }

    // ==========================================
    // 5. PIXEL HAPTICS (Section 13)
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

    @Override
    protected void handleOnDestroy() {
        if (speechRecognizer != null) {
            speechRecognizer.destroy();
            speechRecognizer = null;
        }
        super.handleOnDestroy();
    }
}
