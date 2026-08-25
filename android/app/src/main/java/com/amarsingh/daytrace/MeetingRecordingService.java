package com.amarsingh.daytrace;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.IBinder;
import android.os.StatFs;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.io.File;
import java.util.UUID;

public class MeetingRecordingService extends Service {
    private static final String TAG = "MeetingRecording";
    public static final String CHANNEL_ID = "daytrace_meeting_recording";
    public static final int NOTIFICATION_ID = 42002;
    public static final String PREFS = "daytrace_meeting_recording";
    public static final String ACTION_START = "com.amarsingh.daytrace.meeting.START";
    public static final String ACTION_PAUSE = "com.amarsingh.daytrace.meeting.PAUSE";
    public static final String ACTION_RESUME = "com.amarsingh.daytrace.meeting.RESUME";
    public static final String ACTION_STOP = "com.amarsingh.daytrace.meeting.STOP";

    private MediaRecorder recorder;
    private String meetingId = "";
    private String title = "Meeting";
    private String audioPath = "";
    private long startedAtMillis;
    private long pausedAtMillis;
    private long totalPausedMillis;
    private boolean manualStop;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (action == null) {
            recoverInterruptedRecordingIfNeeded();
        } else if (ACTION_START.equals(action)) {
            startRecording(intent);
        } else if (ACTION_PAUSE.equals(action)) {
            pauseRecording();
        } else if (ACTION_RESUME.equals(action)) {
            resumeRecording();
        } else if (ACTION_STOP.equals(action)) {
            stopRecording("STOPPED");
        }
        return recorder != null ? START_STICKY : START_NOT_STICKY;
    }

    private void recoverInterruptedRecordingIfNeeded() {
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        String savedStatus = prefs.getString("status", "IDLE");
        if (!"RECORDING".equals(savedStatus) && !"PAUSED".equals(savedStatus)) {
            stopSelf();
            return;
        }
        meetingId = prefs.getString("meetingId", "meeting-recovered-" + System.currentTimeMillis());
        title = prefs.getString("title", "Recovered meeting");
        audioPath = prefs.getString("audioPath", "");
        startedAtMillis = prefs.getLong("startedAtMillis", System.currentTimeMillis());
        totalPausedMillis = prefs.getLong("totalPausedMillis", 0L);
        long endedAt = System.currentTimeMillis();
        startForeground(NOTIFICATION_ID, buildNotification("Recovering interrupted recording…", false));
        persistState("INTERRUPTED", endedAt, "Android restarted the recorder process; the partial audio was preserved.");
        appendStoppedEvent("INTERRUPTED", endedAt);
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    private void startRecording(Intent intent) {
        if (recorder != null) return;
        meetingId = intent.getStringExtra("meetingId");
        if (meetingId == null || meetingId.isEmpty()) meetingId = "meeting-" + UUID.randomUUID();
        title = intent.getStringExtra("title");
        if (title == null || title.trim().isEmpty()) title = "Meeting";
        startedAtMillis = System.currentTimeMillis();
        totalPausedMillis = 0L;
        manualStop = false;

        startForeground(NOTIFICATION_ID, buildNotification("Starting recording…", false));
        try {
            File directory = new File(getFilesDir(), "meetings");
            if (!directory.exists() && !directory.mkdirs()) {
                throw new IllegalStateException("Could not create the private meeting audio folder");
            }
            StatFs storage = new StatFs(directory.getAbsolutePath());
            if (storage.getAvailableBytes() < 10L * 1024L * 1024L) {
                throw new IllegalStateException("Less than 10 MB of private storage is available");
            }
            File output = new File(directory, meetingId + ".m4a");
            audioPath = output.getAbsolutePath();
            recorder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? new MediaRecorder(this) : new MediaRecorder();
            recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            recorder.setAudioEncodingBitRate(128_000);
            recorder.setAudioSamplingRate(44_100);
            recorder.setOutputFile(audioPath);
            recorder.setOnErrorListener((mediaRecorder, what, extra) -> stopRecording("INTERRUPTED"));
            recorder.prepare();
            recorder.start();
            persistState("RECORDING", 0L, null);
            updateNotification("Recording in progress", false);
        } catch (Exception error) {
            Log.e(TAG, "Could not start meeting recording", error);
            releaseRecorder();
            persistState("FAILED", System.currentTimeMillis(), error.getMessage());
            appendStoppedEvent("FAILED", System.currentTimeMillis());
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
        }
    }

    private void pauseRecording() {
        if (recorder == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return;
        try {
            recorder.pause();
            pausedAtMillis = System.currentTimeMillis();
            persistState("PAUSED", 0L, null);
            updateNotification("Recording paused", true);
        } catch (Exception error) {
            Log.w(TAG, "Pause failed", error);
        }
    }

    private void resumeRecording() {
        if (recorder == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return;
        try {
            recorder.resume();
            if (pausedAtMillis > 0) totalPausedMillis += System.currentTimeMillis() - pausedAtMillis;
            pausedAtMillis = 0L;
            persistState("RECORDING", 0L, null);
            updateNotification("Recording in progress", false);
        } catch (Exception error) {
            Log.w(TAG, "Resume failed", error);
        }
    }

    private void stopRecording(String finalStatus) {
        if (recorder == null) {
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return;
        }
        manualStop = true;
        long endedAt = System.currentTimeMillis();
        try {
            recorder.stop();
            releaseRecorder();
            persistState(finalStatus, endedAt, null);
            appendStoppedEvent(finalStatus, endedAt);
        } catch (Exception error) {
            Log.e(TAG, "Meeting recording stop failed", error);
            releaseRecorder();
            persistState("INTERRUPTED", endedAt, error.getMessage());
            appendStoppedEvent("INTERRUPTED", endedAt);
        } finally {
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
        }
    }

    private void releaseRecorder() {
        if (recorder == null) return;
        try { recorder.reset(); } catch (Exception ignored) {}
        try { recorder.release(); } catch (Exception ignored) {}
        recorder = null;
    }

    private long durationSeconds(long endMillis) {
        if (startedAtMillis <= 0) return 0L;
        long activeMillis = endMillis - startedAtMillis - totalPausedMillis;
        if (pausedAtMillis > 0) activeMillis -= endMillis - pausedAtMillis;
        return Math.max(0L, activeMillis / 1000L);
    }

    private void persistState(String status, long endedAtMillis, String error) {
        SharedPreferences.Editor editor = getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                .putString("meetingId", meetingId)
                .putString("title", title)
                .putString("status", status)
                .putLong("startedAtMillis", startedAtMillis)
                .putLong("endedAtMillis", endedAtMillis)
                .putLong("durationSeconds", durationSeconds(endedAtMillis > 0 ? endedAtMillis : System.currentTimeMillis()))
                .putLong("totalPausedMillis", totalPausedMillis + (pausedAtMillis > 0 ? System.currentTimeMillis() - pausedAtMillis : 0L))
                .putString("audioPath", audioPath);
        if (error == null) editor.remove("error"); else editor.putString("error", error);
        editor.commit();
    }

    private void appendStoppedEvent(String status, long endedAtMillis) {
        try {
            JSONObject event = new JSONObject();
            String eventId = "native-meeting-" + meetingId + "-" + endedAtMillis;
            event.put("id", eventId);
            event.put("nativeEventId", eventId);
            event.put("actionType", "MEETING_STOPPED");
            event.put("meetingId", meetingId);
            event.put("meetingTitle", title);
            event.put("meetingStatus", status);
            event.put("startedAtMillis", startedAtMillis);
            event.put("endedAtMillis", endedAtMillis);
            event.put("durationSeconds", durationSeconds(endedAtMillis));
            event.put("audioPath", audioPath);
            event.put("syncStatus", "PENDING");
            event.put("createdAt", endedAtMillis);
            NativeEventStore.append(getApplicationContext(), event);
        } catch (Exception error) {
            Log.w(TAG, "Could not queue stopped meeting event", error);
        }
    }

    private Notification buildNotification(String message, boolean paused) {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.putExtra("openMeetings", true);
        openIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPendingIntent = PendingIntent.getActivity(this, 42020, openIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent stopIntent = new Intent(this, MeetingRecordingActionReceiver.class).setAction(ACTION_STOP);
        PendingIntent stopPendingIntent = PendingIntent.getBroadcast(this, 42021, stopIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent toggleIntent = new Intent(this, MeetingRecordingActionReceiver.class).setAction(paused ? ACTION_RESUME : ACTION_PAUSE);
        PendingIntent togglePendingIntent = PendingIntent.getBroadcast(this, 42022, toggleIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_daytrace)
                .setContentTitle(title)
                .setContentText(message)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setContentIntent(openPendingIntent)
                .addAction(0, paused ? "Resume" : "Pause", togglePendingIntent)
                .addAction(0, "Stop", stopPendingIntent)
                .build();
    }

    private void updateNotification(String message, boolean paused) {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager != null) manager.notify(NOTIFICATION_ID, buildNotification(message, paused));
    }

    public static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Active meeting recording", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Visible only while DayTrace is actively recording a confirmed meeting");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(channel);
    }

    public static JSONObject readState(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSONObject result = new JSONObject();
        try {
            result.put("meetingId", prefs.getString("meetingId", ""));
            result.put("title", prefs.getString("title", ""));
            result.put("status", prefs.getString("status", "IDLE"));
            result.put("startedAtMillis", prefs.getLong("startedAtMillis", 0L));
            result.put("endedAtMillis", prefs.getLong("endedAtMillis", 0L));
            long duration = prefs.getLong("durationSeconds", 0L);
            String status = prefs.getString("status", "IDLE");
            if (("RECORDING".equals(status) || "PAUSED".equals(status)) && prefs.getLong("startedAtMillis", 0L) > 0L) {
                duration = Math.max(duration, (System.currentTimeMillis() - prefs.getLong("startedAtMillis", 0L)) / 1000L);
            }
            result.put("durationSeconds", duration);
            result.put("audioPath", prefs.getString("audioPath", ""));
            result.put("error", prefs.getString("error", ""));
        } catch (Exception ignored) {}
        return result;
    }

    @Override
    public void onDestroy() {
        if (recorder != null && !manualStop) stopRecording("INTERRUPTED");
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
