package com.amarsingh.daytrace;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class NotificationActionReceiver extends BroadcastReceiver {
    private static final String TAG = "DayTraceActionReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;

        String action = intent.getStringExtra("action");
        String automationId = intent.getStringExtra("automationId");
        String reminderId = intent.getStringExtra("reminderId");
        String title = intent.getStringExtra("title");
        String locationName = intent.getStringExtra("locationName");
        int notificationId = intent.getIntExtra("notificationId", 0);

        if (automationId == null && reminderId != null) {
            automationId = reminderId;
        }

        Log.d(TAG, "Received notification action: " + action + " for automation: " + automationId);

        // Cancel the notification
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null && notificationId != 0) {
            notificationManager.cancel(notificationId);
        }

        SimpleDateFormat timeFormat = new SimpleDateFormat("HH:mm", Locale.getDefault());
        SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault());
        Date now = new Date();
        String timeStr = timeFormat.format(now);
        String dateStr = dateFormat.format(now);

        if ("DONE".equalsIgnoreCase(action)) {
            // 1. Mark automation COMPLETED in persistent storage
            String resolvedTitle = updateAutomationStatus(context, automationId, "COMPLETED", now.getTime());
            if (resolvedTitle == null && title != null) {
                resolvedTitle = title;
            }
            if (resolvedTitle == null) {
                resolvedTitle = "Task";
            }

            // 2. Append completed timeline entry to native pending logs
            appendPendingTimelineLog(context, "TASK_COMPLETED", "✓ Completed: " + resolvedTitle, timeStr, dateStr, locationName, "TASK_COMPLETION");

            // 3. Forward to plugin if in-memory
            DayTraceNativePlugin.notifyNotificationAction("DONE", automationId, locationName);

        } else if ("SNOOZE".equalsIgnoreCase(action)) {
            // 1. Mark automation SNOOZED in persistent storage
            String resolvedTitle = updateAutomationStatus(context, automationId, "SNOOZED", now.getTime());
            if (resolvedTitle == null && title != null) {
                resolvedTitle = title;
            }
            if (resolvedTitle == null) {
                resolvedTitle = "Reminder";
            }

            // 2. Reschedule AlarmManager for 10 minutes later
            long snoozeTriggerTime = System.currentTimeMillis() + (10 * 60 * 1000);
            rescheduleAlarm(context, automationId, resolvedTitle, "Snoozed: " + resolvedTitle, snoozeTriggerTime, locationName);

            // 3. Append snooze log to native pending logs
            appendPendingTimelineLog(context, "EVENT", "💤 Snoozed: " + resolvedTitle + " (10m)", timeStr, dateStr, locationName, "AUTOMATION");

            // 4. Forward to plugin if in-memory
            DayTraceNativePlugin.notifyNotificationAction("SNOOZE", automationId, locationName);
        }
    }

    private String updateAutomationStatus(Context context, String automationId, String newStatus, long timestamp) {
        if (automationId == null) return null;
        SharedPreferences prefs = context.getSharedPreferences(DayTraceNativePlugin.PREFS_AUTOMATIONS, Context.MODE_PRIVATE);
        String jsonStr = prefs.getString("automations_list", "[]");
        String foundTitle = null;

        try {
            JSONArray arr = new JSONArray(jsonStr);
            JSONArray updated = new JSONArray();

            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                String id = obj.optString("id");
                if (id.equals(automationId) || (automationId.startsWith("auto-") && id.contains(automationId))) {
                    obj.put("status", newStatus);
                    obj.put("updatedAt", timestamp);
                    if ("COMPLETED".equals(newStatus)) {
                        obj.put("completedAt", timestamp);
                    }
                    foundTitle = obj.optString("title", obj.optString("reminderText", ""));
                }
                updated.put(obj);
            }

            prefs.edit().putString("automations_list", updated.toString()).apply();
        } catch (Exception e) {
            Log.e(TAG, "Error updating automation status", e);
        }

        return foundTitle;
    }

    private void appendPendingTimelineLog(Context context, String type, String description, String time, String date, String location, String source) {
        SharedPreferences prefs = context.getSharedPreferences(DayTraceNativePlugin.PREFS_PENDING_LOGS, Context.MODE_PRIVATE);
        String existing = prefs.getString("pending_logs", "[]");

        try {
            JSONArray arr = new JSONArray(existing);
            JSONObject log = new JSONObject();
            log.put("id", "native-" + System.currentTimeMillis() + "-" + (int)(Math.random() * 1000));
            log.put("type", type);
            log.put("description", description);
            log.put("time", time);
            log.put("date", date);
            log.put("location", location != null ? location : "");
            log.put("source", source != null ? source : "AUTOMATION");
            log.put("syncStatus", "PENDING");
            log.put("createdAt", System.currentTimeMillis());
            arr.put(log);

            prefs.edit().putString("pending_logs", arr.toString()).apply();
            Log.d(TAG, "Appended pending native timeline log: " + description);
        } catch (Exception e) {
            Log.e(TAG, "Error saving pending timeline log", e);
        }
    }

    private void rescheduleAlarm(Context context, String reminderId, String title, String message, long triggerMillis, String locationName) {
        try {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) return;

            Intent intent = new Intent(context, AlarmReceiver.class);
            intent.putExtra("reminderId", reminderId);
            intent.putExtra("title", title);
            intent.putExtra("message", message);
            intent.putExtra("locationName", locationName);

            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    context,
                    reminderId.hashCode(),
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerMillis, pendingIntent);
                } else {
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerMillis, pendingIntent);
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerMillis, pendingIntent);
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerMillis, pendingIntent);
            }

            Log.d(TAG, "Rescheduled snooze alarm for " + reminderId + " at " + triggerMillis);
        } catch (Exception e) {
            Log.e(TAG, "Error rescheduling snooze alarm", e);
        }
    }
}
