package com.amarsingh.daytrace;

import android.app.KeyguardManager;
import android.app.PendingIntent;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.Build;
import android.view.WindowManager;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    public interface GoogleAuthorizationResultCallback {
        void onResult(Intent data);
        void onCancelled();
    }

    private ActivityResultLauncher<IntentSenderRequest> googleAuthorizationLauncher;
    private GoogleAuthorizationResultCallback googleAuthorizationCallback;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DayTraceNativePlugin.class);
        super.onCreate(savedInstanceState);
        configureSystemInsets();
        googleAuthorizationLauncher = registerForActivityResult(
                new ActivityResultContracts.StartIntentSenderForResult(),
                result -> {
                    GoogleAuthorizationResultCallback callback = googleAuthorizationCallback;
                    googleAuthorizationCallback = null;
                    if (callback == null) return;
                    if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                        callback.onResult(result.getData());
                    } else {
                        callback.onCancelled();
                    }
                }
        );
        handleIncomingIntent(getIntent());
    }

    /**
     * Android 15+ renders edge-to-edge by default. Apply the real status and
     * navigation bar insets to the WebView so DayTrace content cannot sit
     * underneath Pixel system icons or gesture/navigation controls. IME space
     * remains controlled by adjustResize, allowing focused inputs to move above
     * the keyboard.
     */
    private void configureSystemInsets() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);
        getWindow().setNavigationBarColor(android.graphics.Color.TRANSPARENT);
        ViewCompat.getWindowInsetsController(getWindow().getDecorView()).setAppearanceLightStatusBars(false);
        ViewCompat.getWindowInsetsController(getWindow().getDecorView()).setAppearanceLightNavigationBars(false);

        ViewCompat.setOnApplyWindowInsetsListener(bridge.getWebView(), (view, windowInsets) -> {
            Insets systemBars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
            view.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
            return windowInsets;
        });
        ViewCompat.requestApplyInsets(bridge.getWebView());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent);
    }

    private void handleIncomingIntent(Intent intent) {
        if (intent == null) return;
        
        boolean fromPeriodicPrompt = intent.getBooleanExtra("fromPeriodicPrompt", false);
        if (fromPeriodicPrompt) {
            requestUnlockForAccountability();
            String promptInstanceId = intent.getStringExtra("promptInstanceId");
            if (promptInstanceId == null || promptInstanceId.isEmpty()) promptInstanceId = "legacy-open-" + System.currentTimeMillis();
            String eventId = "native-open-" + promptInstanceId;
            long nowMillis = System.currentTimeMillis();
            Date now = new Date(nowMillis);
            JSONObject openEvent = new JSONObject();
            try {
                openEvent.put("id", eventId);
                openEvent.put("nativeEventId", eventId);
                openEvent.put("actionType", "OPEN_PROMPT");
                openEvent.put("requestedInterface", "ACCOUNTABILITY_INPUT");
                openEvent.put("isTestPrompt", intent.getBooleanExtra("isTestPrompt", false));
                openEvent.put("time", new SimpleDateFormat("HH:mm", Locale.getDefault()).format(now));
                openEvent.put("date", new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(now));
                openEvent.put("source", "CHECK_IN");
                openEvent.put("syncStatus", "PENDING");
                openEvent.put("createdAt", nowMillis);
                NativeEventStore.append(getApplicationContext(), openEvent);
            } catch (Exception ignored) {}
            DayTraceNativePlugin.notifyNotificationAction("OPEN_PERIODIC_PROMPT", eventId, openEvent.toString());
            intent.removeExtra("fromPeriodicPrompt");
        }

        if (intent.getBooleanExtra("openMeetings", false)) {
            long nowMillis = System.currentTimeMillis();
            String eventId = "native-open-meetings-" + nowMillis;
            JSONObject event = new JSONObject();
            try {
                event.put("id", eventId);
                event.put("nativeEventId", eventId);
                event.put("actionType", "OPEN_MEETINGS");
                event.put("syncStatus", "PENDING");
                event.put("createdAt", nowMillis);
                NativeEventStore.append(getApplicationContext(), event);
            } catch (Exception ignored) {}
            DayTraceNativePlugin.notifyNotificationAction("OPEN_MEETINGS", eventId, "");
            intent.removeExtra("openMeetings");
        }

        String action = intent.getStringExtra("action");
        String reminderId = intent.getStringExtra("reminderId");
        String locationName = intent.getStringExtra("locationName");

        if (action != null && !action.isEmpty()) {
            DayTraceNativePlugin.notifyNotificationAction(action, reminderId, locationName);
        }
    }

    public void launchGoogleAuthorization(PendingIntent pendingIntent, GoogleAuthorizationResultCallback callback) {
        if (pendingIntent == null || googleAuthorizationLauncher == null) {
            callback.onCancelled();
            return;
        }
        googleAuthorizationCallback = callback;
        googleAuthorizationLauncher.launch(
                new IntentSenderRequest.Builder(pendingIntent.getIntentSender()).build()
        );
    }

    /**
     * Notification taps remain normal notification interactions. After the user
     * taps one while locked, Android presents the device credential UI; the
     * already-queued OPEN_PROMPT event makes the accountability modal appear as
     * soon as the activity resumes unlocked.
     */
    private void requestUnlockForAccountability() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager keyguardManager = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (keyguardManager != null && keyguardManager.isKeyguardLocked()) {
                getWindow().getDecorView().post(() -> keyguardManager.requestDismissKeyguard(
                        this,
                        new KeyguardManager.KeyguardDismissCallback() {
                            @Override
                            public void onDismissSucceeded() {
                                setShowWhenLocked(false);
                            }

                            @Override
                            public void onDismissCancelled() {
                                setShowWhenLocked(false);
                            }

                            @Override
                            public void onDismissError() {
                                setShowWhenLocked(false);
                            }
                        }
                ));
            } else {
                setShowWhenLocked(false);
            }
        } else {
            getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                            | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            );
        }
    }
}
