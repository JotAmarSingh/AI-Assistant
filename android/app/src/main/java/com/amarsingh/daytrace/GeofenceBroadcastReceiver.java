package com.amarsingh.daytrace;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofenceStatusCodes;
import com.google.android.gms.location.GeofencingEvent;

import java.util.List;

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

        for (Geofence geofence : triggeringGeofences) {
            String locationId = geofence.getRequestId();
            String transitionTypeStr;
            String actionVerb;

            if (geofenceTransition == Geofence.GEOFENCE_TRANSITION_ENTER) {
                transitionTypeStr = "ENTER";
                actionVerb = "Arrived at";
            } else if (geofenceTransition == Geofence.GEOFENCE_TRANSITION_EXIT) {
                transitionTypeStr = "EXIT";
                actionVerb = "Departed from";
            } else {
                transitionTypeStr = "DWELL";
                actionVerb = "At";
            }

            Log.d(TAG, "Geofence transition: " + transitionTypeStr + " for location: " + locationId);

            // Send notification to user
            sendGeofenceNotification(context, locationId, actionVerb);

            // Forward event to active native plugin if app is in memory
            DayTraceNativePlugin.notifyGeofenceEvent(locationId, transitionTypeStr);
        }
    }

    private void sendGeofenceNotification(Context context, String locationName, String actionVerb) {
        AlarmReceiver.createNotificationChannel(context);

        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        launchIntent.putExtra("fromGeofence", true);
        launchIntent.putExtra("locationName", locationName);

        PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                ("geo_" + locationName).hashCode(),
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        String title = "📍 DayTrace Location Update";
        String message = actionVerb + " " + locationName + ". Timeline updated.";

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, AlarmReceiver.CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(message)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_EVENT)
                .setAutoCancel(true)
                .setSound(sound)
                .setContentIntent(pendingIntent);

        NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.notify(("geo_" + locationName).hashCode(), builder.build());
        }
    }
}
