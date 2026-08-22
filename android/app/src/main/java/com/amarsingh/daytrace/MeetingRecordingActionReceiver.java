package com.amarsingh.daytrace;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.content.ContextCompat;

public class MeetingRecordingActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        Intent serviceIntent = new Intent(context, MeetingRecordingService.class).setAction(intent.getAction());
        ContextCompat.startForegroundService(context, serviceIntent);
    }
}
