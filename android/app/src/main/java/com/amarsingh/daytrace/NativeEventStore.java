package com.amarsingh.daytrace;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;

/**
 * Durable, idempotent hand-off queue from manifest receivers to the React app.
 * Events stay in SharedPreferences until React explicitly acknowledges them.
 */
public final class NativeEventStore {
    private static final String TAG = "NativeEventStore";
    private static final String KEY_PENDING_EVENTS = "pending_logs";

    private NativeEventStore() {}

    public static synchronized boolean append(Context context, JSONObject event) {
        String eventId = event.optString("nativeEventId", event.optString("id", ""));
        if (eventId.isEmpty()) {
            Log.e(TAG, "Refusing to persist a native event without an ID");
            return false;
        }

        SharedPreferences prefs = context.getSharedPreferences(
                DayTraceNativePlugin.PREFS_PENDING_LOGS,
                Context.MODE_PRIVATE
        );

        try {
            JSONArray pending = new JSONArray(prefs.getString(KEY_PENDING_EVENTS, "[]"));
            for (int i = 0; i < pending.length(); i++) {
                JSONObject existing = pending.optJSONObject(i);
                if (existing == null) continue;
                String existingId = existing.optString(
                        "nativeEventId",
                        existing.optString("id", "")
                );
                if (eventId.equals(existingId)) {
                    return true;
                }
            }

            event.put("nativeEventId", eventId);
            pending.put(event);
            boolean committed = prefs.edit()
                    .putString(KEY_PENDING_EVENTS, pending.toString())
                    .commit();
            if (!committed) {
                Log.e(TAG, "SharedPreferences commit failed for native event " + eventId);
            }
            return committed;
        } catch (Exception e) {
            Log.e(TAG, "Failed to append native event " + eventId, e);
            return false;
        }
    }

    public static synchronized JSONArray getPending(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(
                DayTraceNativePlugin.PREFS_PENDING_LOGS,
                Context.MODE_PRIVATE
        );
        try {
            return new JSONArray(prefs.getString(KEY_PENDING_EVENTS, "[]"));
        } catch (Exception e) {
            Log.e(TAG, "Pending native event queue was invalid JSON", e);
            return new JSONArray();
        }
    }

    public static synchronized int acknowledge(Context context, JSONArray eventIds) {
        Set<String> ids = new HashSet<>();
        for (int i = 0; i < eventIds.length(); i++) {
            String id = eventIds.optString(i, "");
            if (!id.isEmpty()) ids.add(id);
        }
        if (ids.isEmpty()) return 0;

        SharedPreferences prefs = context.getSharedPreferences(
                DayTraceNativePlugin.PREFS_PENDING_LOGS,
                Context.MODE_PRIVATE
        );
        JSONArray kept = new JSONArray();
        int removed = 0;

        try {
            JSONArray pending = new JSONArray(prefs.getString(KEY_PENDING_EVENTS, "[]"));
            for (int i = 0; i < pending.length(); i++) {
                JSONObject event = pending.optJSONObject(i);
                if (event == null) continue;
                String eventId = event.optString("nativeEventId", event.optString("id", ""));
                if (ids.contains(eventId)) {
                    removed++;
                } else {
                    kept.put(event);
                }
            }
            prefs.edit().putString(KEY_PENDING_EVENTS, kept.toString()).commit();
        } catch (Exception e) {
            Log.e(TAG, "Failed to acknowledge native events", e);
            return 0;
        }
        return removed;
    }
}
