package com.amarsingh.daytrace;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import org.json.JSONObject;
import java.util.Map;

public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "DayTraceBootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;

        String action = intent.getAction();
        boolean isRecoveryTrigger = 
            Intent.ACTION_BOOT_COMPLETED.equals(action) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(action) ||
            "com.htc.intent.action.QUICKBOOT_POWERON".equals(action) ||
            Intent.ACTION_MY_PACKAGE_REPLACED.equals(action) ||
            Intent.ACTION_TIME_CHANGED.equals(action) ||
            Intent.ACTION_TIMEZONE_CHANGED.equals(action) ||
            "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED".equals(action);

        if (isRecoveryTrigger) {
            Log.d(TAG, "Device recovery event (" + action + "). Restoring scheduled DayTrace alarms...");
            
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) return;

            SharedPreferences prefs = context.getSharedPreferences(DayTraceNativePlugin.PREFS_ALARMS, Context.MODE_PRIVATE);
            Map<String, ?> allAlarms = prefs.getAll();

            long now = System.currentTimeMillis();

            for (Map.Entry<String, ?> entry : allAlarms.entrySet()) {
                String reminderId = entry.getKey();
                String dataStr = (String) entry.getValue();

                try {
                    JSONObject json = new JSONObject(dataStr);
                    long triggerTimeMillis = json.getLong("triggerTimeMillis");
                    String title = json.getString("title");
                    String message = json.getString("message");

                    // Only reschedule if trigger time is still in future
                    if (triggerTimeMillis > now) {
                        Intent alarmIntent = new Intent(context, AlarmReceiver.class);
                        alarmIntent.putExtra("reminderId", reminderId);
                        alarmIntent.putExtra("title", title);
                        alarmIntent.putExtra("message", message);

                        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                                context,
                                reminderId.hashCode(),
                                alarmIntent,
                                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                        );

                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                            if (alarmManager.canScheduleExactAlarms()) {
                                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTimeMillis, pendingIntent);
                            } else {
                                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTimeMillis, pendingIntent);
                            }
                        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTimeMillis, pendingIntent);
                        } else {
                            alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerTimeMillis, pendingIntent);
                        }
                        Log.d(TAG, "Restored alarm for: " + reminderId + " at " + triggerTimeMillis);
                    } else {
                        // Expired alarm cleanup
                        prefs.edit().remove(reminderId).apply();
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error restoring alarm " + reminderId, e);
                }
            }

            // Restore periodic accountability prompt alarm
            try {
                PeriodicPromptReceiver.restorePromptSchedule(context);
                Log.d(TAG, "Restored periodic accountability prompt alarm on boot");
            } catch (Exception e) {
                Log.e(TAG, "Error restoring periodic prompt alarm", e);
            }
        }
    }
}
