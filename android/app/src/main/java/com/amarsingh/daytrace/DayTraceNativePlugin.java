package com.amarsingh.daytrace;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
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
import androidx.core.app.ActivityCompat;
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
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.Priority;
import com.google.android.gms.tasks.CancellationTokenSource;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.io.File;
import java.security.MessageDigest;

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
    public static final String PREFS_GEOFENCE_NAMES = "daytrace_geofence_names";
    private static final String PREFS_PERMISSIONS = "daytrace_permission_state";
    private static DayTraceNativePlugin instance;
    private static JSObject pendingInitialNotificationAction = null;

    private SpeechRecognizer speechRecognizer;
    private GeofencingClient geofencingClient;
    private FusedLocationProviderClient fusedLocationClient;
    private PendingIntent geofencePendingIntent;

    @Override
    public void load() {
        super.load();
        instance = this;
        geofencingClient = LocationServices.getGeofencingClient(getContext());
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(getContext());
        AlarmReceiver.createNotificationChannel(getContext());
        PeriodicPromptReceiver.createNotificationChannel(getContext());
        Log.d(TAG, "DayTraceNativePlugin loaded on Pixel device");
    }

    public static void notifyGeofenceEvent(String locationId, String locationName, String transitionType) {
        if (instance != null) {
            JSObject data = new JSObject();
            data.put("locationId", locationId);
            data.put("locationName", locationName);
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

    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
                JSObject granted = new JSObject();
                granted.put("success", true);
                granted.put("alreadyGranted", true);
                call.resolve(granted);
                return;
            }
            AlarmManager alarmManager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            if (alarmManager != null && alarmManager.canScheduleExactAlarms()) {
                JSObject granted = new JSObject();
                granted.put("success", true);
                granted.put("alreadyGranted", true);
                call.resolve(granted);
                return;
            }
            Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("alreadyGranted", false);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not open exact-alarm settings: " + error.getMessage());
        }
    }

    @PluginMethod
    public void getCapabilityStatus(PluginCall call) {
        Context context = getContext();
        boolean microphoneGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO)
                == PackageManager.PERMISSION_GRANTED;
        boolean locationGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED
                || ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
        boolean backgroundLocationGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
                ? locationGranted
                : ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                    == PackageManager.PERMISSION_GRANTED;
        boolean notificationsGranted = (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
                || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                    == PackageManager.PERMISSION_GRANTED)
                && NotificationManagerCompat.from(context).areNotificationsEnabled();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        boolean exactAlarmsGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.S
                || (alarmManager != null && alarmManager.canScheduleExactAlarms());

        JSObject permissions = new JSObject();
        permissions.put("notifications", notificationsGranted ? "GRANTED" : "DENIED");
        permissions.put("microphone", microphoneGranted ? "GRANTED" : "DENIED");
        permissions.put("location", locationGranted ? "GRANTED" : "DENIED");
        permissions.put("backgroundLocation", backgroundLocationGranted ? "GRANTED" : "DENIED");
        permissions.put("exactAlarms", exactAlarmsGranted ? "GRANTED" : "NEEDS_SETTINGS");

        JSObject ret = new JSObject();
        ret.put("permissions", permissions);
        call.resolve(ret);
    }

    // ==========================================
    // 4. NATIVE GEOFENCING CLIENT (Section 10)
    // ==========================================

    @PluginMethod
    public void getCurrentLocation(PluginCall call) {
        if (!hasAnyForegroundLocationPermission()) {
            requestPermissionForAlias("locationForeground", call, "currentLocationPermissionCallback");
            return;
        }
        readCurrentLocation(call);
    }

    @PermissionCallback
    private void currentLocationPermissionCallback(PluginCall call) {
        if (hasAnyForegroundLocationPermission()) {
            readCurrentLocation(call);
        } else {
            call.reject("Location permission was denied. DayTrace did not save a place.");
        }
    }

    private boolean hasAnyForegroundLocationPermission() {
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED
                || ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_COARSE_LOCATION)
                    == PackageManager.PERMISSION_GRANTED;
    }

    private void readCurrentLocation(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
                && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            call.reject("Location permission is required.");
            return;
        }
        CancellationTokenSource tokenSource = new CancellationTokenSource();
        fusedLocationClient.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, tokenSource.getToken())
                .addOnSuccessListener(location -> {
                    if (location == null) {
                        call.reject("Android could not determine the current location. Turn on Location and retry.");
                        return;
                    }
                    JSObject result = new JSObject();
                    result.put("latitude", location.getLatitude());
                    result.put("longitude", location.getLongitude());
                    result.put("accuracyMeters", location.getAccuracy());
                    call.resolve(result);
                })
                .addOnFailureListener(error -> call.reject("Could not get current location: " + error.getMessage()));
    }

    @PluginMethod
    public void requestGeofencePermissions(PluginCall call) {
        if (getPermissionState("locationForeground") != com.getcapacitor.PermissionState.GRANTED) {
            requestPermissionForAlias("locationForeground", call, "geofenceForegroundPermissionCallback");
            return;
        }
        requestBackgroundLocationIfNeeded(call);
    }

    @PermissionCallback
    private void geofenceForegroundPermissionCallback(PluginCall call) {
        if (getPermissionState("locationForeground") != com.getcapacitor.PermissionState.GRANTED) {
            resolveGeofencePermissionResult(call, false, false);
            return;
        }
        requestBackgroundLocationIfNeeded(call);
    }

    private void requestBackgroundLocationIfNeeded(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
                || getPermissionState("locationBackground") == com.getcapacitor.PermissionState.GRANTED) {
            resolveGeofencePermissionResult(call, true, true);
            return;
        }
        requestPermissionForAlias("locationBackground", call, "geofenceBackgroundPermissionCallback");
    }

    @PermissionCallback
    private void geofenceBackgroundPermissionCallback(PluginCall call) {
        resolveGeofencePermissionResult(
                call,
                getPermissionState("locationForeground") == com.getcapacitor.PermissionState.GRANTED,
                getPermissionState("locationBackground") == com.getcapacitor.PermissionState.GRANTED
        );
    }

    private void resolveGeofencePermissionResult(PluginCall call, boolean foregroundGranted, boolean backgroundGranted) {
        JSObject result = new JSObject();
        result.put("foregroundGranted", foregroundGranted);
        result.put("backgroundGranted", backgroundGranted);
        call.resolve(result);
    }

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
            JSONObject geofenceNames = new JSONObject();

            for (int i = 0; i < locationsArray.length(); i++) {
                JSONObject loc = locationsArray.getJSONObject(i);
                String id = loc.getString("id");
                String name = loc.optString("name", id);
                double lat = loc.getDouble("latitude");
                double lng = loc.getDouble("longitude");
                float radius = (float) loc.optDouble("radiusMeters", 200.0);

                geofenceList.add(new Geofence.Builder()
                        .setRequestId(id)
                        .setCircularRegion(lat, lng, radius)
                        .setExpirationDuration(Geofence.NEVER_EXPIRE)
                        .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER | Geofence.GEOFENCE_TRANSITION_EXIT)
                        .build());
                geofenceNames.put(id, name);
            }

            getContext().getSharedPreferences(PREFS_GEOFENCE_NAMES, Context.MODE_PRIVATE)
                    .edit().putString("names_json", geofenceNames.toString()).apply();

            GeofencingRequest request = new GeofencingRequest.Builder()
                    .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER)
                    .addGeofences(geofenceList)
                    .build();

            geofencePendingIntent = getGeofencePendingIntent();

            // Replace the complete set so deleted/renamed places cannot leave
            // stale geofences behind.
            geofencingClient.removeGeofences(geofencePendingIntent).addOnCompleteListener(unused ->
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
                            })
            );
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
                        getContext().getSharedPreferences(PREFS_GEOFENCE_NAMES, Context.MODE_PRIVATE)
                                .edit().clear().apply();
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
        boolean askedBefore = context.getSharedPreferences(PREFS_PERMISSIONS, Context.MODE_PRIVATE)
                .getBoolean("notifications_asked", false);
        boolean canRequestAgain = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && !runtimeGranted
                && (!askedBefore || ActivityCompat.shouldShowRequestPermissionRationale(getActivity(), Manifest.permission.POST_NOTIFICATIONS));
        boolean granted = runtimeGranted && notificationsEnabled && channelEnabled;
        String status;
        if (granted) {
            status = "GRANTED";
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !runtimeGranted && !askedBefore) {
            status = "NOT_REQUESTED";
        } else {
            status = "DENIED";
        }
        ret.put("granted", granted);
        ret.put("status", status);
        ret.put("runtimeGranted", runtimeGranted);
        ret.put("notificationsEnabled", notificationsEnabled);
        ret.put("channelEnabled", channelEnabled);
        ret.put("canRequest", canRequestAgain);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (getPermissionState("notifications") != com.getcapacitor.PermissionState.GRANTED) {
                getContext().getSharedPreferences(PREFS_PERMISSIONS, Context.MODE_PRIVATE)
                        .edit().putBoolean("notifications_asked", true).apply();
                requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
                return;
            }
        }
        boolean notificationsEnabled = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        boolean channelEnabled = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            NotificationChannel channel = manager != null ? manager.getNotificationChannel(PeriodicPromptReceiver.CHANNEL_ID) : null;
            channelEnabled = channel == null || channel.getImportance() != NotificationManager.IMPORTANCE_NONE;
        }
        JSObject ret = new JSObject();
        ret.put("granted", notificationsEnabled && channelEnabled);
        call.resolve(ret);
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        boolean granted = getPermissionState("notifications") == com.getcapacitor.PermissionState.GRANTED
                && NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void exportJsonBackup(PluginCall call) {
        String jsonText = call.getString("jsonText");
        String fileName = call.getString("fileName", "daytrace-backup.json");
        if (jsonText == null || jsonText.isEmpty()) {
            call.reject("JSON text is required");
            return;
        }

        try {
            Context context = getContext();
            String safeFileName = fileName.replaceAll("[^A-Za-z0-9._-]", "_");
            if (!safeFileName.toLowerCase(Locale.US).endsWith(".json")) safeFileName += ".json";
            String savedPath;
            Uri savedUri;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                android.content.ContentValues values = new android.content.ContentValues();
                values.put(android.provider.MediaStore.Downloads.DISPLAY_NAME, safeFileName);
                values.put(android.provider.MediaStore.Downloads.MIME_TYPE, "application/json");
                values.put(android.provider.MediaStore.Downloads.RELATIVE_PATH, android.os.Environment.DIRECTORY_DOWNLOADS);
                values.put(android.provider.MediaStore.Downloads.IS_PENDING, 1);
                savedUri = context.getContentResolver().insert(
                        android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                        values
                );
                if (savedUri == null) throw new IllegalStateException("Android Downloads provider did not create a file");
                try (java.io.OutputStream stream = context.getContentResolver().openOutputStream(savedUri, "w")) {
                    if (stream == null) throw new IllegalStateException("Android could not open the backup file");
                    stream.write(jsonText.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                } catch (Exception writeError) {
                    context.getContentResolver().delete(savedUri, null, null);
                    throw writeError;
                }
                values.clear();
                values.put(android.provider.MediaStore.Downloads.IS_PENDING, 0);
                context.getContentResolver().update(savedUri, values, null, null);
                savedPath = "Downloads/" + safeFileName;
            } else {
                java.io.File downloadsDir = android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS);
                if (!downloadsDir.exists() && !downloadsDir.mkdirs()) {
                    throw new IllegalStateException("Android could not create the Downloads folder");
                }
                java.io.File file = new java.io.File(downloadsDir, safeFileName);
                try (java.io.FileOutputStream stream = new java.io.FileOutputStream(file)) {
                    stream.write(jsonText.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                }
                savedUri = Uri.fromFile(file);
                savedPath = file.getAbsolutePath();
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("path", savedPath);
            ret.put("uri", savedUri.toString());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to export backup file: " + e.getMessage());
        }
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
    // 8. MEETING MODE FOREGROUND RECORDING
    // ==========================================

    @PluginMethod
    public void startMeetingRecording(PluginCall call) {
        if (getPermissionState("recordAudio") != com.getcapacitor.PermissionState.GRANTED) {
            requestPermissionForAlias("recordAudio", call, "meetingRecordingPermissionCallback");
            return;
        }
        String meetingId = call.getString("meetingId", "meeting-" + System.currentTimeMillis());
        String title = call.getString("title", "Meeting");
        try {
            Intent intent = new Intent(getContext(), MeetingRecordingService.class)
                    .setAction(MeetingRecordingService.ACTION_START)
                    .putExtra("meetingId", meetingId)
                    .putExtra("title", title);
            ContextCompat.startForegroundService(getContext(), intent);
            JSObject result = new JSObject();
            result.put("meetingId", meetingId);
            result.put("title", title);
            result.put("status", "RECORDING");
            result.put("startedAtMillis", System.currentTimeMillis());
            result.put("durationSeconds", 0);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not start Meeting Mode: " + error.getMessage());
        }
    }

    @PermissionCallback
    private void meetingRecordingPermissionCallback(PluginCall call) {
        if (getPermissionState("recordAudio") == com.getcapacitor.PermissionState.GRANTED) {
            startMeetingRecording(call);
        } else {
            call.reject("Microphone permission was denied. No meeting recording was started.");
        }
    }

    @PluginMethod
    public void pauseMeetingRecording(PluginCall call) {
        sendMeetingServiceAction(MeetingRecordingService.ACTION_PAUSE, call, "PAUSED");
    }

    @PluginMethod
    public void resumeMeetingRecording(PluginCall call) {
        sendMeetingServiceAction(MeetingRecordingService.ACTION_RESUME, call, "RECORDING");
    }

    @PluginMethod
    public void stopMeetingRecording(PluginCall call) {
        sendMeetingServiceAction(MeetingRecordingService.ACTION_STOP, call, "STOPPED");
    }

    @PluginMethod
    public void getMeetingRecordingState(PluginCall call) {
        call.resolve(readMeetingRecordingStateForBridge());
    }

    @PluginMethod
    public void deleteMeetingAudio(PluginCall call) {
        String audioPath = call.getString("audioPath", "");
        try {
            File meetingsDirectory = new File(getContext().getFilesDir(), "meetings").getCanonicalFile();
            File target = new File(audioPath).getCanonicalFile();
            if (!target.getPath().startsWith(meetingsDirectory.getPath() + File.separator)) {
                call.reject("Refused to delete a file outside DayTrace meeting storage");
                return;
            }
            JSObject result = new JSObject();
            result.put("deleted", !target.exists() || target.delete());
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not delete meeting audio: " + error.getMessage());
        }
    }

    private void sendMeetingServiceAction(String action, PluginCall call, String expectedStatus) {
        try {
            Intent intent = new Intent(getContext(), MeetingRecordingService.class).setAction(action);
            ContextCompat.startForegroundService(getContext(), intent);
            JSObject result = readMeetingRecordingStateForBridge();
            result.put("status", expectedStatus);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Meeting Mode action failed: " + error.getMessage());
        }
    }

    /** Converts the recorder's JSONObject without invoking JSObject(String),
     * whose constructor exposes a checked JSONException to Java callers. */
    private JSObject readMeetingRecordingStateForBridge() {
        JSONObject state = MeetingRecordingService.readState(getContext());
        JSObject result = new JSObject();
        result.put("meetingId", state.optString("meetingId", ""));
        result.put("title", state.optString("title", ""));
        result.put("status", state.optString("status", "IDLE"));
        result.put("startedAtMillis", state.optLong("startedAtMillis", 0L));
        result.put("endedAtMillis", state.optLong("endedAtMillis", 0L));
        result.put("durationSeconds", state.optLong("durationSeconds", 0L));
        result.put("audioPath", state.optString("audioPath", ""));
        result.put("error", state.optString("error", ""));
        return result;
    }

    // ==========================================
    // 9. INSTALLED APP IDENTITY (release/update diagnostics)
    // ==========================================

    /**
     * Returns the identity Google Cloud must register for this exact installed
     * APK. Exposing the fingerprint is diagnostic only; it is a public
     * certificate digest and never exposes the signing key.
     */
    @PluginMethod
    public void getAppIdentity(PluginCall call) {
        try {
            PackageManager packageManager = getContext().getPackageManager();
            String packageName = getContext().getPackageName();
            PackageInfo packageInfo;
            Signature[] signatures;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                packageInfo = packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES);
                signatures = packageInfo.signingInfo != null
                        ? packageInfo.signingInfo.getApkContentsSigners()
                        : new Signature[0];
            } else {
                //noinspection deprecation
                packageInfo = packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNATURES);
                //noinspection deprecation
                signatures = packageInfo.signatures;
            }
            if (signatures == null || signatures.length == 0) {
                call.reject("The installed APK signing certificate could not be read");
                return;
            }

            byte[] digest = MessageDigest.getInstance("SHA-1").digest(signatures[0].toByteArray());
            StringBuilder fingerprint = new StringBuilder();
            for (byte value : digest) {
                if (fingerprint.length() > 0) fingerprint.append(':');
                fingerprint.append(String.format(Locale.US, "%02X", value & 0xFF));
            }

            JSObject result = new JSObject();
            result.put("packageName", packageName);
            result.put("sha1", fingerprint.toString());
            result.put("versionName", packageInfo.versionName != null ? packageInfo.versionName : "");
            result.put("versionCode", Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? packageInfo.getLongVersionCode()
                    : packageInfo.versionCode);
            boolean isDebuggable = (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
            result.put("buildType", isDebuggable ? "debug" : "release");
            call.resolve(result);
        } catch (Exception error) {
            call.reject("The installed APK identity could not be read: " + error.getMessage());
        }
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
        super.handleOnDestroy();
    }
}
