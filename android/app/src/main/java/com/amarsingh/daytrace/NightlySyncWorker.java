package com.amarsingh.daytrace;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

public class NightlySyncWorker extends Worker {
    private static final String TAG = "NightlySyncWorker";
    public static final String WORK_NAME = "daytrace_nightly_sync";
    public static final String PREFS_SYNC = "daytrace_sync_state";

    public NightlySyncWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        Log.d(TAG, "Starting NightlySyncWorker execution (Local-First background sync)");

        try {
            SharedPreferences syncPrefs = context.getSharedPreferences(PREFS_SYNC, Context.MODE_PRIVATE);
            SharedPreferences logsPrefs = context.getSharedPreferences(DayTraceNativePlugin.PREFS_PENDING_LOGS, Context.MODE_PRIVATE);
            SharedPreferences queuePrefs = context.getSharedPreferences(DayTraceNativePlugin.PREFS_SYNC_QUEUE, Context.MODE_PRIVATE);

            String pendingLogsJson = logsPrefs.getString("pending_logs", "[]");
            String queueJson = queuePrefs.getString("pending_queue_json", "{}");
            String customEndpoint = syncPrefs.getString("sync_endpoint", "");
            String authToken = syncPrefs.getString("auth_token", "");

            JSONArray pendingLogs = new JSONArray(pendingLogsJson);
            JSONObject queueObj = new JSONObject(queueJson);
            JSONArray pendingTimeline = queueObj.optJSONArray("pendingTimeline");
            if (pendingTimeline == null) pendingTimeline = new JSONArray();

            int totalPendingCount = pendingLogs.length() + pendingTimeline.length();
            if (totalPendingCount == 0 && !queueObj.has("pendingTasks")) {
                Log.d(TAG, "No pending DayTrace entries to sync. Nightly sync completed.");
                syncPrefs.edit().putLong("last_nightly_sync_timestamp", System.currentTimeMillis()).putString("sync_status", "IDLE").apply();
                return Result.success();
            }

            Log.d(TAG, "Nightly sync found " + totalPendingCount + " total pending records in unified sync queue.");

            // Local-First verification: Check if background token/endpoint is available
            if (authToken.isEmpty() && customEndpoint.isEmpty()) {
                Log.d(TAG, "No background Google OAuth token available. Queued sync for next app launch without losing data.");
                syncPrefs.edit()
                        .putString("sync_status", "QUEUED_FOR_APP_LAUNCH")
                        .putBoolean("pending_sync_ready", true)
                        .putLong("last_check_timestamp", System.currentTimeMillis())
                        .apply();
                return Result.success();
            }

            // If an endpoint or webhook is configured, execute sync
            if (!customEndpoint.isEmpty()) {
                URL url = new URL(customEndpoint);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                if (!authToken.isEmpty()) {
                    conn.setRequestProperty("Authorization", "Bearer " + authToken);
                }
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(15000);
                conn.setDoOutput(true);

                JSONObject payload = new JSONObject();
                payload.put("deviceSyncTime", System.currentTimeMillis());
                payload.put("nativePendingLogs", pendingLogs);
                payload.put("queue", queueObj);

                try (OutputStream os = conn.getOutputStream()) {
                    byte[] input = payload.toString().getBytes("utf-8");
                    os.write(input, 0, input.length);
                }

                int responseCode = conn.getResponseCode();
                if (responseCode >= 200 && responseCode < 300) {
                    Log.d(TAG, "Nightly sync succeeded with HTTP " + responseCode);
                    syncPrefs.edit()
                            .putLong("last_nightly_sync_timestamp", System.currentTimeMillis())
                            .putString("sync_status", "SYNCED")
                            .putBoolean("pending_sync_ready", false)
                            .apply();
                    queuePrefs.edit().putString("sync_status", "SYNCED").apply();
                    return Result.success();
                } else {
                    Log.w(TAG, "Nightly sync endpoint returned HTTP " + responseCode + ". Data preserved locally.");
                    syncPrefs.edit().putString("sync_status", "RETRY_QUEUED").apply();
                    return Result.retry();
                }
            }

            return Result.success();
        } catch (Exception e) {
            Log.e(TAG, "Error in NightlySyncWorker. Data is safely preserved locally.", e);
            return Result.retry();
        }
    }

    /**
     * Schedules standard non-exact nightly periodic work with network constraints.
     */
    public static void scheduleNightlySync(Context context) {
        try {
            Constraints constraints = new Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build();

            // Calculate initial delay to 02:00 AM
            Calendar now = Calendar.getInstance();
            Calendar target = Calendar.getInstance();
            target.set(Calendar.HOUR_OF_DAY, 2);
            target.set(Calendar.MINUTE, 0);
            target.set(Calendar.SECOND, 0);

            if (target.before(now)) {
                target.add(Calendar.DAY_OF_YEAR, 1);
            }

            long initialDelay = target.getTimeInMillis() - now.getTimeInMillis();

            PeriodicWorkRequest syncRequest = new PeriodicWorkRequest.Builder(
                    NightlySyncWorker.class,
                    24, TimeUnit.HOURS,
                    2, TimeUnit.HOURS // 2 hour flex window
            )
                    .setConstraints(constraints)
                    .setInitialDelay(initialDelay, TimeUnit.MILLISECONDS)
                    .build();

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                    WORK_NAME,
                    ExistingPeriodicWorkPolicy.KEEP,
                    syncRequest
            );

            Log.d(TAG, "Scheduled NightlySyncWorker with initial delay: " + (initialDelay / 1000 / 60) + " minutes");
        } catch (Exception e) {
            Log.e(TAG, "Failed to schedule NightlySyncWorker", e);
        }
    }
}
