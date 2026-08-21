package com.amarsingh.daytrace;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

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
        String action = intent.getStringExtra("action");
        String reminderId = intent.getStringExtra("reminderId");
        String locationName = intent.getStringExtra("locationName");

        if (action != null && !action.isEmpty()) {
            DayTraceNativePlugin.notifyNotificationAction(action, reminderId, locationName);
        }
    }
}

