package com.amarsingh.daytrace;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofenceStatusCodes;
import com.google.android.gms.location.GeofencingEvent;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class GeofenceBroadcastReceiver extends BroadcastReceiver {
    private static final String TAG = "DayTraceGeofenceRec";

    @Override
    public void onReceive(Context context, Intent intent) {
        GeofencingEvent geofencingEvent = GeofencingEvent.fromIntent(intent);
        if (geofencingEvent == null) {
            Log.w(TAG, "GeofencingEvent is null");
            return;
        }

        if (geofencingEvent.hasError()) {
            String errorMessage = GeofenceStatusCodes.getStatusCodeString(geofencingEvent.getErrorCode());
            Log.e(TAG, "Geofence event error: " + errorMessage);
            return;
        }

        int geofenceTransition = geofencingEvent.getGeofenceTransition();
        List<Geofence> triggeringGeofences = geofencingEvent.getTriggeringGeofences();

        if (triggeringGeofences == null || triggeringGeofences.isEmpty()) {
            return;
        }

        SimpleDateFormat timeFormat = new SimpleDateFormat("HH:mm", Locale.getDefault());
        SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault());
        Date now = new Date();
        String timeStr = timeFormat.format(now);
        String dateStr = dateFormat.format(now);

        for (Geofence geofence : triggeringGeofences) {
            String locationKey = geofence.getRequestId();
            String transitionTypeStr;
            String requiredTriggerType;
            String actionVerb;

            if (geofenceTransition == Geofence.GEOFENCE_TRANSITION_ENTER) {
                transitionTypeStr = "ENTER";
                requiredTriggerType = "GEOFENCE_ENTER";
                actionVerb = "Arrived at";
            } else if (geofenceTransition == Geofence.GEOFENCE_TRANSITION_EXIT) {
                transitionTypeStr = "EXIT";
                requiredTriggerType = "GEOFENCE_EXIT";
                actionVerb = "Departed from";
            } else {
                transitionTypeStr = "DWELL";
                requiredTriggerType = "GEOFENCE_ENTER";
                actionVerb = "At";
            }

            Log.d(TAG, "Geofence transition: " + transitionTypeStr + " for location: " + locationKey);

            // Clean location name (e.g. geo-office -> Office)
            String displayLocation = cleanLocationName(locationKey);

            // 1. Check Native Persistent Automations Store
            List<JSONObject> matchingAutomations = findMatchingAutomations(context, displayLocation, requiredTriggerType);

            if (!matchingAutomations.isEmpty()) {
                Log.d(TAG, "Found " + matchingAutomations.size() + " matching automations for " + displayLocation + " " + requiredTriggerType);

                for (JSONObject auto : matchingAutomations) {
                    String autoId = auto.optString("id");
                    String title = auto.optString("title", "DayTrace Task");
                    String reminderText = auto.optString("reminderText", title);

                    // Requirement 4: Set status to TRIGGERED (DO NOT MARK COMPLETE YET!)
                    updateAutomationToTriggered(context, autoId, now.getTime());

                    // Record pending timeline log
                    appendPendingTimelineLog(context, "EVENT", "⚡ Triggered: " + title, timeStr, dateStr, displayLocation, "AUTOMATION");

                    // Show High-Priority Interactive Notification with [ DONE ] [ SNOOZE ]
                    sendAutomationNotification(context, autoId, title, reminderText, displayLocation, transitionTypeStr);
                }
            } else {
                // No specific task automation registered -> log location change and show generic location update
                appendPendingTimelineLog(
                        context,
                        "EXIT".equals(transitionTypeStr) ? "DEPARTURE" : "ARRIVAL",
                        ("EXIT".equals(transitionTypeStr) ? "📍 Left " : "📍 Arrived at ") + displayLocation,
                        timeStr,
                        dateStr,
                        displayLocation,
                        "GEOFENCE"
                );

                sendGenericLocationNotification(context, displayLocation, actionVerb);
            }

            // Forward event to active native plugin if app is in memory
            DayTraceNativePlugin.notifyGeofenceEvent(locationKey, transitionTypeStr);
        }
    }

    private List<JSONObject> findMatchingAutomations(Context context, String locationName, String requiredTriggerType) {
        List<JSONObject> results = new ArrayList<>();
        SharedPreferences prefs = context.getSharedPreferences(DayTraceNativePlugin.PREFS_AUTOMATIONS, Context.MODE_PRIVATE);
        String jsonStr = prefs.getString("automations_list", "[]");

        try {
            JSONArray arr = new JSONArray(jsonStr);
            String locLower = locationName.toLowerCase().trim();

            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                String status = obj.optString("status", "PENDING");
                String triggerType = obj.optString("triggerType", "");
                String autoLoc = obj.optString("locationName", "").toLowerCase().trim();
                String autoLocId = obj.optString("locationId", "").toLowerCase().trim();

                // Only consider PENDING or SNOOZED tasks
                if (("PENDING".equalsIgnoreCase(status) || "SNOOZED".equalsIgnoreCase(status)) &&
                    triggerType.equalsIgnoreCase(requiredTriggerType)) {

                    if (autoLoc.isEmpty() || autoLoc.equals(locLower) || locLower.contains(autoLoc) || autoLoc.contains(locLower) ||
                        autoLocId.contains(locLower) || locLower.contains(autoLocId.replace("geo-", ""))) {
                        results.add(obj);
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error finding matching automations", e);
        }

        return results;
    }

    private void updateAutomationToTriggered(Context context, String automationId, long timestamp) {
        SharedPreferences prefs = context.getSharedPreferences(DayTraceNativePlugin.PREFS_AUTOMATIONS, Context.MODE_PRIVATE);
        String jsonStr = prefs.getString("automations_list", "[]");

        try {
            JSONArray arr = new JSONArray(jsonStr);
            JSONArray updated = new JSONArray();

            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                if (obj.optString("id").equals(automationId)) {
                    obj.put("status", "TRIGGERED");
                    obj.put("triggeredAt", timestamp);
                }
                updated.put(obj);
            }

            prefs.edit().putString("automations_list", updated.toString()).apply();
        } catch (Exception e) {
            Log.e(TAG, "Error updating automation to TRIGGERED", e);
        }
    }

    private void appendPendingTimelineLog(Context context, String type, String description, String time, String date, String location, String source) {
        SharedPreferences prefs = context.getSharedPreferences(DayTraceNativePlugin.PREFS_PENDING_LOGS, Context.MODE_PRIVATE);
        String existing = prefs.getString("pending_logs", "[]");

        try {
            JSONArray arr = new JSONArray(existing);
            JSONObject log = new JSONObject();
            log.put("id", "native-geo-" + System.currentTimeMillis() + "-" + (int)(Math.random() * 1000));
            log.put("type", type);
            log.put("description", description);
            log.put("time", time);
            log.put("date", date);
            log.put("location", location != null ? location : "");
            log.put("source", source != null ? source : "GEOFENCE");
            log.put("syncStatus", "PENDING");
            log.put("createdAt", System.currentTimeMillis());
            arr.put(log);

            prefs.edit().putString("pending_logs", arr.toString()).apply();
        } catch (Exception e) {
            Log.e(TAG, "Error appending pending timeline log", e);
        }
    }

    private void sendAutomationNotification(Context context, String automationId, String title, String reminderText, String locationName, String transition) {
        AlarmReceiver.createNotificationChannels(context);

        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        boolean isInteractive = pm != null && pm.isInteractive();
        String targetChannelId = isInteractive ? AlarmReceiver.SILENT_CHANNEL_ID : AlarmReceiver.CHANNEL_ID;

        int notificationId = ("auto_" + automationId).hashCode();

        // Launch app on tap
        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        launchIntent.putExtra("fromGeofence", true);
        launchIntent.putExtra("automationId", automationId);
        launchIntent.putExtra("locationName", locationName);

        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                notificationId,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Action 1: DONE Intent via Direct BroadcastReceiver
        Intent doneIntent = new Intent(context, NotificationActionReceiver.class);
        doneIntent.putExtra("action", "DONE");
        doneIntent.putExtra("automationId", automationId);
        doneIntent.putExtra("title", title);
        doneIntent.putExtra("locationName", locationName);
        doneIntent.putExtra("notificationId", notificationId);
        PendingIntent donePendingIntent = PendingIntent.getBroadcast(
                context,
                ("done_" + automationId).hashCode(),
                doneIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Action 2: SNOOZE Intent via Direct BroadcastReceiver
        Intent snoozeIntent = new Intent(context, NotificationActionReceiver.class);
        snoozeIntent.putExtra("action", "SNOOZE");
        snoozeIntent.putExtra("automationId", automationId);
        snoozeIntent.putExtra("title", title);
        snoozeIntent.putExtra("locationName", locationName);
        snoozeIntent.putExtra("notificationId", notificationId);
        PendingIntent snoozePendingIntent = PendingIntent.getBroadcast(
                context,
                ("snooze_" + automationId).hashCode(),
                snoozeIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String notifTitle = "⚡ " + title.toUpperCase(Locale.getDefault());
        String subtitle = ("EXIT".equals(transition) ? "Leaving " : "Arrived at ") + locationName + " • " + reminderText;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, targetChannelId)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(notifTitle)
                .setContentText(subtitle)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(subtitle))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .addAction(android.R.drawable.checkbox_on_background, "DONE", donePendingIntent)
                .addAction(android.R.drawable.ic_lock_idle_alarm, "SNOOZE", snoozePendingIntent);

        if (!isInteractive) {
            Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            builder.setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setSound(sound)
                    .setVibrate(new long[]{0, 500, 200, 500});
        } else {
            builder.setCategory(NotificationCompat.CATEGORY_REMINDER)
                    .setSilent(true);
        }

        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.notify(notificationId, builder.build());
        }
    }

    private void sendGenericLocationNotification(Context context, String locationName, String actionVerb) {
        AlarmReceiver.createNotificationChannels(context);

        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        boolean isInteractive = pm != null && pm.isInteractive();
        String targetChannelId = isInteractive ? AlarmReceiver.SILENT_CHANNEL_ID : AlarmReceiver.CHANNEL_ID;

        int notificationId = ("geo_" + locationName).hashCode();

        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        launchIntent.putExtra("fromGeofence", true);
        launchIntent.putExtra("locationName", locationName);

        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                notificationId,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent doneIntent = new Intent(context, NotificationActionReceiver.class);
        doneIntent.putExtra("action", "DONE");
        doneIntent.putExtra("locationName", locationName);
        doneIntent.putExtra("title", actionVerb + " " + locationName);
        doneIntent.putExtra("notificationId", notificationId);
        PendingIntent donePendingIntent = PendingIntent.getBroadcast(
                context,
                ("geo_done_" + locationName).hashCode(),
                doneIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent snoozeIntent = new Intent(context, NotificationActionReceiver.class);
        snoozeIntent.putExtra("action", "SNOOZE");
        snoozeIntent.putExtra("locationName", locationName);
        snoozeIntent.putExtra("title", actionVerb + " " + locationName);
        snoozeIntent.putExtra("notificationId", notificationId);
        PendingIntent snoozePendingIntent = PendingIntent.getBroadcast(
                context,
                ("geo_snooze_" + locationName).hashCode(),
                snoozeIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        String title = "📍 DayTrace Location Update";
        String message = actionVerb + " " + locationName + ". Timeline updated.";

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, targetChannelId)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(message)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .addAction(android.R.drawable.checkbox_on_background, "DONE", donePendingIntent)
                .addAction(android.R.drawable.ic_lock_idle_alarm, "SNOOZE", snoozePendingIntent);

        if (!isInteractive) {
            Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            builder.setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setSound(sound)
                    .setVibrate(new long[]{0, 400, 200, 400});
        } else {
            builder.setCategory(NotificationCompat.CATEGORY_REMINDER)
                    .setSilent(true);
        }

        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.notify(notificationId, builder.build());
        }
    }

    private String cleanLocationName(String raw) {
        if (raw == null) return "Location";
        String clean = raw.replace("geo-", "").trim();
        if (clean.isEmpty()) return "Location";
        return clean.substring(0, 1).toUpperCase(Locale.getDefault()) + clean.substring(1);
    }
}
