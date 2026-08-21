package com.amarsingh.daytrace;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DayTraceNativePlugin.class);
        super.onCreate(savedInstanceState);
        handleIncomingIntent(getIntent());
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

        String action = intent.getStringExtra("action");
        String reminderId = intent.getStringExtra("reminderId");
        String locationName = intent.getStringExtra("locationName");

        if (action != null && !action.isEmpty()) {
            DayTraceNativePlugin.notifyNotificationAction(action, reminderId, locationName);
        }
    }
}
