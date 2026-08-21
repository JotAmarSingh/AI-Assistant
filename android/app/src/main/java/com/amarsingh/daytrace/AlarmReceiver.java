package com.amarsingh.daytrace;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

public class AlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "DayTraceAlarmReceiver";
    public static final String CHANNEL_ID = "daytrace_reminders_channel";
    public static final String CHANNEL_NAME = "DayTrace Reminders & Alarms";

    @Override
    public void onReceive(Context context, Intent intent) {
        String reminderId = intent.getStringExtra("reminderId");
        String title = intent.getStringExtra("title");
        String message = intent.getStringExtra("message");

        if (title == null || title.isEmpty()) {
            title = "DayTrace Reminder";
        }
        if (message == null || message.isEmpty()) {
            message = "Scheduled accountability reminder";
        }

        Log.d(TAG, "Alarm triggered for reminderId: " + reminderId + " message: " + message);

        createNotificationChannel(context);

        // Intent to launch MainActivity when user taps notification
        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        launchIntent.putExtra("fromAlarm", true);
        launchIntent.putExtra("reminderId", reminderId);

        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                reminderId != null ? reminderId.hashCode() : (int) System.currentTimeMillis(),
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Uri alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setAutoCancel(true)
                .setSound(alarmSound)
                .setContentIntent(pendingIntent);

        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            int notificationId = reminderId != null ? reminderId.hashCode() : (int) System.currentTimeMillis();
            notificationManager.notify(notificationId, builder.build());
        }

        // Clean up alarm from persistent store once fired
        if (reminderId != null) {
            SharedPreferences prefs = context.getSharedPreferences(DayTraceNativePlugin.PREFS_ALARMS, Context.MODE_PRIVATE);
            prefs.edit().remove(reminderId).apply();
        }
    }

    public static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                NotificationChannel existing = notificationManager.getNotificationChannel(CHANNEL_ID);
                if (existing == null) {
                    NotificationChannel channel = new NotificationChannel(
                            CHANNEL_ID,
                            CHANNEL_NAME,
                            NotificationManager.IMPORTANCE_HIGH
                    );
                    channel.setDescription("High-priority time and location based reminders for DayTrace");
                    channel.enableVibration(true);
                    channel.setShowBadge(true);
                    notificationManager.createNotificationChannel(channel);
                }
            }
        }
    }
}
