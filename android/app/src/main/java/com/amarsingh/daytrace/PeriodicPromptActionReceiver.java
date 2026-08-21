package com.amarsingh.daytrace;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.RemoteInput;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Handles accountability actions without requiring an Activity or WebView process. */
public class PeriodicPromptActionReceiver extends BroadcastReceiver {
    private static final String TAG = "PromptActionReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;

        String action = intent.getAction();
        int notificationId = intent.getIntExtra("notificationId", PeriodicPromptReceiver.NOTIFICATION_ID);
        String promptInstanceId = intent.getStringExtra("promptInstanceId");
        if (promptInstanceId == null || promptInstanceId.isEmpty()) {
            promptInstanceId = "legacy-" + System.currentTimeMillis();
        }
        boolean isTest = intent.getBooleanExtra("isTestPrompt", false);
        long nowMillis = System.currentTimeMillis();
        Date now = new Date(nowMillis);
        String time = new SimpleDateFormat("HH:mm", Locale.getDefault()).format(now);
        String date = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(now);
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        if (PeriodicPromptReceiver.ACTION_REPLY.equals(action)) {
            Bundle results = RemoteInput.getResultsFromIntent(intent);
            CharSequence entered = results != null
                    ? results.getCharSequence(PeriodicPromptReceiver.KEY_QUICK_UPDATE)
                    : null;
            if (entered == null || entered.toString().trim().isEmpty()) return;

            // Preserve the user's exact RemoteInput text; trim is used only for validation.
            String exactText = entered.toString();
            String eventId = "native-written-update-" + promptInstanceId;
            JSONObject event = baseEvent(eventId, "WRITTEN_UPDATE", "UPDATE", exactText, time, date, nowMillis);
            try {
                event.put("currentActivity", exactText);
                event.put("isTestPrompt", isTest);
            } catch (Exception ignored) {}

            if (NativeEventStore.append(context, event)) {
                showConfirmation(context, notificationManager, notificationId, "Activity logged", exactText);
                notifyReact("ACCOUNTABILITY_EVENT", eventId, event);
                restartCountdownAfterAction(context, nowMillis, isTest);
            }
            return;
        }

        if (PeriodicPromptReceiver.ACTION_CONFIRM_TASK.equals(action)) {
            String taskId = intent.getStringExtra("taskId");
            String taskTitle = intent.getStringExtra("taskTitle");
            if (taskId == null || taskId.isEmpty() || taskTitle == null || taskTitle.isEmpty()) {
                Log.w(TAG, "Ignored task action without a stable task ID and title");
                return;
            }

            String activity = "Working on: " + taskTitle;
            String eventId = "native-task-started-" + promptInstanceId + "-" + taskId;
            JSONObject event = baseEvent(eventId, "TASK_SELECTED", "TASK_STARTED", activity, time, date, nowMillis);
            try {
                event.put("relatedTaskId", taskId);
                event.put("taskTitle", taskTitle);
                event.put("requestedTaskStatus", "ACTIVE");
                event.put("makeCurrentFocus", true);
                event.put("currentActivity", activity);
                event.put("isTestPrompt", isTest);
            } catch (Exception ignored) {}

            if (NativeEventStore.append(context, event)) {
                showConfirmation(context, notificationManager, notificationId, "Task active", activity);
                notifyReact("ACCOUNTABILITY_EVENT", eventId, event);
                restartCountdownAfterAction(context, nowMillis, isTest);
            }
            return;
        }

        if (PeriodicPromptReceiver.ACTION_SNOOZE.equals(action)) {
            if (notificationManager != null) notificationManager.cancel(notificationId);
            if (isTest) return;

            int snoozeMinutes = Math.max(1, intent.getIntExtra("snoozeMinutes", 30));
            long snoozedUntilMillis = nowMillis + snoozeMinutes * 60_000L;
            String eventId = "native-snooze-" + promptInstanceId;
            JSONObject event = baseEvent(
                    eventId,
                    "SNOOZE",
                    "CONFIG_CHANGE",
                    "Accountability check snoozed for " + snoozeMinutes + "m",
                    time,
                    date,
                    nowMillis
            );
            try {
                event.put("snoozedUntilMillis", snoozedUntilMillis);
            } catch (Exception ignored) {}

            if (NativeEventStore.append(context, event)) {
                SharedPreferences prefs = context.getSharedPreferences(
                        PeriodicPromptReceiver.PREFS_PROMPT_CONFIG,
                        Context.MODE_PRIVATE
                );
                prefs.edit()
                        .putLong("snoozed_until", snoozedUntilMillis)
                        .putString("native_snooze_event_id", eventId)
                        .commit();
                PeriodicPromptReceiver.scheduleAlarmAtTime(context, snoozedUntilMillis);
                notifyReact("ACCOUNTABILITY_EVENT", eventId, event);
            }
        }
    }

    private static JSONObject baseEvent(
            String eventId,
            String actionType,
            String type,
            String description,
            String time,
            String date,
            long createdAt
    ) {
        JSONObject event = new JSONObject();
        try {
            event.put("id", eventId);
            event.put("nativeEventId", eventId);
            event.put("actionType", actionType);
            event.put("type", type);
            event.put("description", description);
            event.put("time", time);
            event.put("date", date);
            event.put("location", "");
            event.put("source", "CHECK_IN");
            event.put("syncStatus", "PENDING");
            event.put("createdAt", createdAt);
        } catch (Exception ignored) {}
        return event;
    }

    private static void restartCountdownAfterAction(Context context, long nowMillis, boolean isTest) {
        if (isTest) return;
        SharedPreferences prefs = context.getSharedPreferences(
                PeriodicPromptReceiver.PREFS_PROMPT_CONFIG,
                Context.MODE_PRIVATE
        );
        prefs.edit()
                .putLong("last_activity_time", nowMillis)
                .putLong("snoozed_until", 0L)
                .commit();
        PeriodicPromptReceiver.scheduleNextPrompt(context);
    }

    private static void showConfirmation(
            Context context,
            NotificationManager manager,
            int notificationId,
            String title,
            String message
    ) {
        if (manager == null) return;
        NotificationCompat.Builder confirmation = new NotificationCompat.Builder(context, PeriodicPromptReceiver.CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(message)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setTimeoutAfter(3000L)
                .setAutoCancel(true)
                .setOnlyAlertOnce(true);
        try {
            manager.notify(notificationId, confirmation.build());
        } catch (SecurityException e) {
            Log.w(TAG, "Could not display action confirmation", e);
        }
    }

    private static void notifyReact(String action, String eventId, JSONObject event) {
        DayTraceNativePlugin.notifyNotificationAction(action, eventId, event.toString());
    }
}
