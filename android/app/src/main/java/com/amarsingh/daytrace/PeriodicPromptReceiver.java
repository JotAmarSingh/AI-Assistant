package com.amarsingh.daytrace;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.RemoteInput;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;
import java.util.Date;
import java.util.UUID;

/** Manifest receiver for one-shot accountability alarms. */
public class PeriodicPromptReceiver extends BroadcastReceiver {
    private static final String TAG = "PeriodicPromptReceiver";

    public static final String CHANNEL_ID = "daytrace_accountability_v2";
    public static final String CHANNEL_NAME = "DayTrace Accountability Checks";
    public static final String PREFS_PROMPT_CONFIG = "daytrace_periodic_prompt_config";

    public static final int NOTIFICATION_ID = 9001;
    public static final int TEST_NOTIFICATION_ID = 9011;
    public static final int ALARM_REQUEST_CODE = 9002;
    public static final int TEST_ALARM_REQUEST_CODE = 9012;

    public static final String KEY_QUICK_UPDATE = "key_quick_update";
    public static final String ACTION_REGULAR_ALARM = "com.amarsingh.daytrace.ACTION_PERIODIC_PROMPT";
    public static final String ACTION_TEST_ALARM = "com.amarsingh.daytrace.ACTION_TEST_PERIODIC_PROMPT";
    public static final String ACTION_REPLY = "com.amarsingh.daytrace.ACTION_PROMPT_REPLY";
    public static final String ACTION_CONFIRM_TASK = "com.amarsingh.daytrace.ACTION_PROMPT_CONFIRM_TASK";
    public static final String ACTION_SNOOZE = "com.amarsingh.daytrace.ACTION_PROMPT_SNOOZE";

    @Override
    public void onReceive(Context context, Intent intent) {
        boolean isTest = intent != null && ACTION_TEST_ALARM.equals(intent.getAction());
        if (isTest) {
            showAccountabilityNotification(context, TEST_NOTIFICATION_ID, true);
            return;
        }

        SharedPreferences prefs = context.getSharedPreferences(PREFS_PROMPT_CONFIG, Context.MODE_PRIVATE);
        boolean configured = prefs.getBoolean("configured", false);
        boolean enabled = prefs.getBoolean("enabled", false);
        boolean gamingMode = prefs.getBoolean("gaming_mode", false);
        long snoozedUntil = prefs.getLong("snoozed_until", 0L);
        String wakeUpTime = prefs.getString("wake_up_time", "07:00");
        String bedTime = prefs.getString("bed_time", "23:30");
        long now = System.currentTimeMillis();

        if (!configured || !enabled || gamingMode) {
            Log.d(TAG, "Prompt suppressed because it is unconfigured, disabled, or in gaming mode");
            cancelPrompt(context);
            return;
        }
        if (snoozedUntil > now) {
            scheduleAlarmAtTime(context, snoozedUntil);
            return;
        }
        if (isSleepingHoursAt(now, wakeUpTime, bedTime)) {
            schedulePromptForWakeup(context, wakeUpTime);
            return;
        }

        showAccountabilityNotification(context, NOTIFICATION_ID, false);
        scheduleNextPrompt(context);
    }

    public static void showAccountabilityNotification(Context context) {
        showAccountabilityNotification(context, NOTIFICATION_ID, false);
    }

    public static void showAccountabilityNotification(Context context, int notificationId, boolean isTest) {
        createNotificationChannel(context);
        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
        if (!notificationManager.areNotificationsEnabled()) {
            Log.w(TAG, "Notification not shown because Android notifications are disabled");
            return;
        }

        SharedPreferences prefs = context.getSharedPreferences(PREFS_PROMPT_CONFIG, Context.MODE_PRIVATE);
        JSONArray suggestions;
        try {
            suggestions = new JSONArray(prefs.getString("suggested_tasks", "[]"));
        } catch (Exception e) {
            suggestions = new JSONArray();
        }

        String promptInstanceId = (isTest ? "test-" : "prompt-") + UUID.randomUUID();
        String contentText = buildContentText(suggestions);

        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        openAppIntent.putExtra("fromPeriodicPrompt", true);
        openAppIntent.putExtra("promptInstanceId", promptInstanceId);
        openAppIntent.putExtra("isTestPrompt", isTest);
        openAppIntent.setData(Uri.parse("daytrace://accountability/open/" + (isTest ? "test" : "recurring")));
        PendingIntent contentPendingIntent = PendingIntent.getActivity(
                context, notificationId, openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        RemoteInput remoteInput = new RemoteInput.Builder(KEY_QUICK_UPDATE)
                .setLabel("Write your current activity")
                .build();
        Intent replyIntent = new Intent(context, PeriodicPromptActionReceiver.class);
        replyIntent.setAction(ACTION_REPLY);
        addPromptIdentity(replyIntent, notificationId, promptInstanceId, isTest);
        replyIntent.setData(Uri.parse("daytrace://accountability/reply/" + (isTest ? "test" : "recurring")));
        int replyFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) replyFlags |= PendingIntent.FLAG_MUTABLE;
        PendingIntent replyPendingIntent = PendingIntent.getBroadcast(
                context, isTest ? 1103 : 1003, replyIntent, replyFlags
        );
        NotificationCompat.Action replyAction = new NotificationCompat.Action.Builder(
                android.R.drawable.ic_menu_send, "Write update", replyPendingIntent
        ).addRemoteInput(remoteInput).build();

        Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_daytrace)
                .setContentTitle("What are you working on?")
                .setContentText(contentText)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(contentText))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setContentIntent(contentPendingIntent)
                .setAutoCancel(true)
                .setSound(soundUri)
                .setVibrate(new long[]{0, 250, 150, 250});

        int taskCount = Math.min(2, suggestions.length());
        for (int i = 0; i < taskCount; i++) {
            JSONObject task = suggestions.optJSONObject(i);
            if (task == null) continue;
            String taskId = task.optString("id", "");
            String taskTitle = task.optString("title", "");
            if (taskId.isEmpty() || taskTitle.isEmpty()) continue;

            Intent taskIntent = new Intent(context, PeriodicPromptActionReceiver.class);
            taskIntent.setAction(ACTION_CONFIRM_TASK);
            taskIntent.putExtra("taskId", taskId);
            taskIntent.putExtra("taskTitle", taskTitle);
            addPromptIdentity(taskIntent, notificationId, promptInstanceId, isTest);
            taskIntent.setData(Uri.parse("daytrace://accountability/task/" + (isTest ? "test" : "recurring") + "/" + i));
            PendingIntent taskPendingIntent = PendingIntent.getBroadcast(
                    context, (isTest ? 1100 : 1000) + i, taskIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            String label = taskTitle.length() > 20 ? taskTitle.substring(0, 18) + "…" : taskTitle;
            builder.addAction(new NotificationCompat.Action.Builder(
                    android.R.drawable.checkbox_on_background, label, taskPendingIntent
            ).build());
        }

        builder.addAction(replyAction);
        
        Intent snooze30Intent = new Intent(context, PeriodicPromptActionReceiver.class);
        snooze30Intent.setAction(ACTION_SNOOZE);
        snooze30Intent.putExtra("snoozeMinutes", 30);
        addPromptIdentity(snooze30Intent, notificationId, promptInstanceId, isTest);
        snooze30Intent.setData(Uri.parse("daytrace://accountability/snooze30/" + (isTest ? "test" : "recurring")));
        PendingIntent snooze30PendingIntent = PendingIntent.getBroadcast(
                context, isTest ? 1104 : 1004, snooze30Intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        builder.addAction(new NotificationCompat.Action.Builder(
                android.R.drawable.ic_lock_idle_alarm, "Delay 30m", snooze30PendingIntent
        ).build());

        Intent snooze60Intent = new Intent(context, PeriodicPromptActionReceiver.class);
        snooze60Intent.setAction(ACTION_SNOOZE);
        snooze60Intent.putExtra("snoozeMinutes", 60);
        addPromptIdentity(snooze60Intent, notificationId, promptInstanceId, isTest);
        snooze60Intent.setData(Uri.parse("daytrace://accountability/snooze60/" + (isTest ? "test" : "recurring")));
        PendingIntent snooze60PendingIntent = PendingIntent.getBroadcast(
                context, isTest ? 1105 : 1005, snooze60Intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        builder.addAction(new NotificationCompat.Action.Builder(
                android.R.drawable.ic_lock_idle_alarm, "Delay 1h", snooze60PendingIntent
        ).build());

        try {
            notificationManager.notify(notificationId, builder.build());
        } catch (SecurityException e) {
            Log.w(TAG, "Notification permission is not available", e);
        }
    }

    private static void addPromptIdentity(Intent intent, int notificationId, String promptInstanceId, boolean isTest) {
        intent.putExtra("notificationId", notificationId);
        intent.putExtra("promptInstanceId", promptInstanceId);
        intent.putExtra("isTestPrompt", isTest);
    }

    private static String buildContentText(JSONArray suggestions) {
        JSONObject firstTask = suggestions.optJSONObject(0);
        JSONObject secondTask = suggestions.optJSONObject(1);
        String first = firstTask != null ? firstTask.optString("title", "") : "";
        String second = secondTask != null ? secondTask.optString("title", "") : "";
        if (!first.isEmpty() && !second.isEmpty()) return first + " • " + second;
        if (!first.isEmpty()) return first + " • or write an update";
        return "Choose a task or write an update from the lock screen.";
    }

    public static void scheduleNextPrompt(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_PROMPT_CONFIG, Context.MODE_PRIVATE);
        if (!prefs.getBoolean("configured", false)
                || !prefs.getBoolean("enabled", false)
                || prefs.getBoolean("gaming_mode", false)) {
            cancelPrompt(context);
            return;
        }

        long now = System.currentTimeMillis();
        long snoozedUntil = prefs.getLong("snoozed_until", 0L);
        if (snoozedUntil > now) {
            scheduleAlarmAtTime(context, snoozedUntil);
            return;
        }
        String wakeUpTime = prefs.getString("wake_up_time", "07:00");
        String bedTime = prefs.getString("bed_time", "23:30");
        if (isSleepingHoursAt(now, wakeUpTime, bedTime)) {
            schedulePromptForWakeup(context, wakeUpTime);
            return;
        }
        int intervalMinutes = Math.max(1, prefs.getInt("interval_minutes", 30));
        scheduleAlarmAtTime(context, now + intervalMinutes * 60_000L);
    }

    public static void ensurePromptScheduled(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_PROMPT_CONFIG, Context.MODE_PRIVATE);
        if (!prefs.getBoolean("configured", false)
                || !prefs.getBoolean("enabled", false)
                || prefs.getBoolean("gaming_mode", false)) {
            cancelPrompt(context);
            return;
        }
        if (prefs.getLong("next_scheduled_trigger", 0L) > System.currentTimeMillis()) return;
        scheduleNextPrompt(context);
    }

    public static void restorePromptSchedule(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_PROMPT_CONFIG, Context.MODE_PRIVATE);
        if (!prefs.getBoolean("configured", false)
                || !prefs.getBoolean("enabled", false)
                || prefs.getBoolean("gaming_mode", false)) {
            cancelPrompt(context);
            return;
        }
        scheduleNextPrompt(context);
    }

    public static void schedulePromptForWakeup(Context context, String wakeUpTime) {
        try {
            String[] parts = wakeUpTime.split(":");
            Calendar calendar = Calendar.getInstance();
            calendar.set(Calendar.HOUR_OF_DAY, Integer.parseInt(parts[0]));
            calendar.set(Calendar.MINUTE, Integer.parseInt(parts[1]));
            calendar.set(Calendar.SECOND, 0);
            calendar.set(Calendar.MILLISECOND, 0);
            if (calendar.getTimeInMillis() <= System.currentTimeMillis()) calendar.add(Calendar.DAY_OF_YEAR, 1);
            scheduleAlarmAtTime(context, calendar.getTimeInMillis());
        } catch (Exception e) {
            int intervalMinutes = Math.max(1, context.getSharedPreferences(PREFS_PROMPT_CONFIG, Context.MODE_PRIVATE)
                    .getInt("interval_minutes", 30));
            scheduleAlarmAtTime(context, System.currentTimeMillis() + intervalMinutes * 60_000L);
        }
    }

    public static void scheduleAlarmAtTime(Context context, long triggerTimeMillis) {
        scheduleAlarm(context, triggerTimeMillis, false);
    }

    public static void scheduleTestAlarmAtTime(Context context, long triggerTimeMillis) {
        scheduleAlarm(context, triggerTimeMillis, true);
    }

    private static void scheduleAlarm(Context context, long triggerTimeMillis, boolean isTest) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;
        Intent intent = new Intent(context, PeriodicPromptReceiver.class);
        intent.setAction(isTest ? ACTION_TEST_ALARM : ACTION_REGULAR_ALARM);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context, isTest ? TEST_ALARM_REQUEST_CODE : ALARM_REQUEST_CODE, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        if (!isTest) {
            context.getSharedPreferences(PREFS_PROMPT_CONFIG, Context.MODE_PRIVATE)
                    .edit().putLong("next_scheduled_trigger", triggerTimeMillis).apply();
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTimeMillis, pendingIntent);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTimeMillis, pendingIntent);
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerTimeMillis, pendingIntent);
            }
            Log.d(TAG, (isTest ? "Test" : "Recurring") + " alarm scheduled for " + new Date(triggerTimeMillis));
        } catch (SecurityException exactDenied) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTimeMillis, pendingIntent);
                Log.w(TAG, "Exact alarm denied; used allow-while-idle fallback", exactDenied);
            } else {
                alarmManager.set(AlarmManager.RTC_WAKEUP, triggerTimeMillis, pendingIntent);
            }
        }
    }

    public static void cancelPrompt(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) {
            alarmManager.cancel(buildAlarmPendingIntent(context, false));
            alarmManager.cancel(buildAlarmPendingIntent(context, true));
        }
        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.cancel(NOTIFICATION_ID);
            notificationManager.cancel(TEST_NOTIFICATION_ID);
        }
        context.getSharedPreferences(PREFS_PROMPT_CONFIG, Context.MODE_PRIVATE)
                .edit().putLong("next_scheduled_trigger", 0L).apply();
    }

    private static PendingIntent buildAlarmPendingIntent(Context context, boolean isTest) {
        Intent intent = new Intent(context, PeriodicPromptReceiver.class);
        intent.setAction(isTest ? ACTION_TEST_ALARM : ACTION_REGULAR_ALARM);
        return PendingIntent.getBroadcast(
                context, isTest ? TEST_ALARM_REQUEST_CODE : ALARM_REQUEST_CODE, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private static boolean isSleepingHoursAt(long timestamp, String wakeUpTime, String bedTime) {
        try {
            String[] wakeParts = wakeUpTime.split(":");
            String[] bedParts = bedTime.split(":");
            int wakeMinutes = Integer.parseInt(wakeParts[0]) * 60 + Integer.parseInt(wakeParts[1]);
            int bedMinutes = Integer.parseInt(bedParts[0]) * 60 + Integer.parseInt(bedParts[1]);
            Calendar now = Calendar.getInstance();
            now.setTimeInMillis(timestamp);
            int currentMinutes = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE);
            if (bedMinutes > wakeMinutes) return currentMinutes >= bedMinutes || currentMinutes < wakeMinutes;
            return currentMinutes >= bedMinutes && currentMinutes < wakeMinutes;
        } catch (Exception e) {
            return false;
        }
    }

    public static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        NotificationChannel channel = manager.getNotificationChannel(CHANNEL_ID);
        if (channel == null) {
            channel = new NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Interactive lock-screen accountability check-in prompts");
            channel.enableVibration(true);
            channel.setShowBadge(true);
        }
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(channel);
    }
}
