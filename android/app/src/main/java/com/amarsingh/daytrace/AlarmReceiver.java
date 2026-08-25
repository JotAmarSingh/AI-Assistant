package com.amarsingh.daytrace;

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
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class AlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "DayTraceAlarmReceiver";
    public static final String CHANNEL_ID = "daytrace_reminders_channel";
    public static final String CHANNEL_NAME = "DayTrace Reminders & Alarms (Audible)";
    public static final String SILENT_CHANNEL_ID = "daytrace_silent_channel";
    public static final String SILENT_CHANNEL_NAME = "DayTrace Reminders (Silent Heads-Up)";

    @Override
    public void onReceive(Context context, Intent intent) {
        String reminderId = intent.getStringExtra("reminderId");
        String title = intent.getStringExtra("title");
        String message = intent.getStringExtra("message");
        String locationName = intent.getStringExtra("locationName");

        if (title == null || title.isEmpty()) {
            title = "DayTrace Reminder";
        }
        if (message == null || message.isEmpty()) {
            message = "Scheduled accountability reminder";
        }

        Log.d(TAG, "Alarm triggered for reminderId: " + reminderId + " message: " + message);

        createNotificationChannels(context);

        SimpleDateFormat timeFormat = new SimpleDateFormat("HH:mm", Locale.getDefault());
        SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault());
        Date now = new Date();
        String timeStr = timeFormat.format(now);
        String dateStr = dateFormat.format(now);

        // Record pending timeline log for alarm trigger
        appendPendingTimelineLog(context, "EVENT", "⏰ Reminder: " + title, timeStr, dateStr, locationName, "REMINDER");

        // Smart Alert Mode:
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        boolean isInteractive = pm != null && pm.isInteractive();
        String targetChannelId = isInteractive ? SILENT_CHANNEL_ID : CHANNEL_ID;

        int notificationId = reminderId != null ? reminderId.hashCode() : (int) System.currentTimeMillis();

        // Launch MainActivity when user taps notification body
        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        launchIntent.putExtra("fromAlarm", true);
        launchIntent.putExtra("reminderId", reminderId);
        launchIntent.putExtra("message", message);
        launchIntent.putExtra("locationName", locationName);

        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                notificationId,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Action 1: DONE Intent via BroadcastReceiver
        Intent doneIntent = new Intent(context, NotificationActionReceiver.class);
        doneIntent.putExtra("action", "DONE");
        doneIntent.putExtra("reminderId", reminderId);
        doneIntent.putExtra("automationId", reminderId);
        doneIntent.putExtra("title", title);
        doneIntent.putExtra("locationName", locationName);
        doneIntent.putExtra("notificationId", notificationId);
        PendingIntent donePendingIntent = PendingIntent.getBroadcast(
                context,
                ("done_" + reminderId).hashCode(),
                doneIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Action 2: SNOOZE Intent via BroadcastReceiver
        Intent snoozeIntent = new Intent(context, NotificationActionReceiver.class);
        snoozeIntent.putExtra("action", "SNOOZE");
        snoozeIntent.putExtra("reminderId", reminderId);
        snoozeIntent.putExtra("automationId", reminderId);
        snoozeIntent.putExtra("title", title);
        snoozeIntent.putExtra("locationName", locationName);
        snoozeIntent.putExtra("notificationId", notificationId);
        PendingIntent snoozePendingIntent = PendingIntent.getBroadcast(
                context,
                ("snooze_" + reminderId).hashCode(),
                snoozeIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, targetChannelId)
                .setSmallIcon(R.drawable.ic_stat_daytrace)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .addAction(android.R.drawable.checkbox_on_background, "DONE", donePendingIntent)
                .addAction(android.R.drawable.ic_lock_idle_alarm, "SNOOZE", snoozePendingIntent);

        if (!isInteractive) {
            // Case A: Screen off -> Alarm style with sound and vibration
            Uri alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            builder.setCategory(NotificationCompat.CATEGORY_ALARM)
                   .setSound(alarmSound)
                   .setVibrate(new long[]{0, 500, 200, 500});
        } else {
            // Case B: Screen on -> Silent heads-up notification without disruptive chime
            builder.setCategory(NotificationCompat.CATEGORY_REMINDER)
                   .setSilent(true);
        }

        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.notify(notificationId, builder.build());
        }

        // Clean up alarm from persistent scheduled alarms store once fired
        if (reminderId != null) {
            SharedPreferences prefs = context.getSharedPreferences(DayTraceNativePlugin.PREFS_ALARMS, Context.MODE_PRIVATE);
            prefs.edit().remove(reminderId).apply();
        }
    }

    private void appendPendingTimelineLog(Context context, String type, String description, String time, String date, String location, String source) {
        SharedPreferences prefs = context.getSharedPreferences(DayTraceNativePlugin.PREFS_PENDING_LOGS, Context.MODE_PRIVATE);
        String existing = prefs.getString("pending_logs", "[]");

        try {
            JSONArray arr = new JSONArray(existing);
            JSONObject log = new JSONObject();
            log.put("id", "native-alarm-" + System.currentTimeMillis() + "-" + (int)(Math.random() * 1000));
            log.put("type", type);
            log.put("description", description);
            log.put("time", time);
            log.put("date", date);
            log.put("location", location != null ? location : "");
            log.put("source", source != null ? source : "REMINDER");
            log.put("syncStatus", "PENDING");
            log.put("createdAt", System.currentTimeMillis());
            arr.put(log);

            prefs.edit().putString("pending_logs", arr.toString()).apply();
        } catch (Exception e) {
            Log.e(TAG, "Error appending pending timeline log", e);
        }
    }

    public static void createNotificationChannels(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                // 1. Audible High-Priority Channel for Screen-Off
                NotificationChannel audibleChannel = notificationManager.getNotificationChannel(CHANNEL_ID);
                if (audibleChannel == null) {
                    audibleChannel = new NotificationChannel(
                            CHANNEL_ID,
                            CHANNEL_NAME,
                            NotificationManager.IMPORTANCE_HIGH
                    );
                    audibleChannel.setDescription("High-priority audible reminders for DayTrace when screen is off");
                    audibleChannel.enableVibration(true);
                    audibleChannel.setShowBadge(true);
                    notificationManager.createNotificationChannel(audibleChannel);
                }

                // 2. Silent High-Priority Channel for Screen-On
                NotificationChannel silentChannel = notificationManager.getNotificationChannel(SILENT_CHANNEL_ID);
                if (silentChannel == null) {
                    silentChannel = new NotificationChannel(
                            SILENT_CHANNEL_ID,
                            SILENT_CHANNEL_NAME,
                            NotificationManager.IMPORTANCE_HIGH
                    );
                    silentChannel.setDescription("Silent heads-up reminders for DayTrace when device is in active use");
                    silentChannel.enableVibration(false);
                    silentChannel.setSound(null, null);
                    silentChannel.setShowBadge(true);
                    notificationManager.createNotificationChannel(silentChannel);
                }
            }
        }
    }

    public static void createNotificationChannel(Context context) {
        createNotificationChannels(context);
    }
}
