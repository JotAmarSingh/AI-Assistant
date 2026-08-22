/**
 * Google Workspace OAuth & Sheets Synchronizer Service
 * Uses Google Identity Services (GSI) Token Client & Google Sheets v4 REST API
 * Supports:
 * 1. Granular Structured Sheet Tabs (Daily Summary, Timeline Logs, Task Board, Reminders & Alarms, Planned vs Actual)
 * 2. Idempotent Upsert & Deduplication using stable unique record IDs
 * 3. Full State JSON Backup Tab (Versioned snapshots for 1-click restore)
 * 4. Unified Sync Status (PENDING -> SYNCED)
 */
import { DailyState, EndOfDayReview, TimelineEvent, TaskItem, ReminderItem } from '../types';
import { getLearningProfile, AutoLearningProfile } from '../utils/autoLearning';
import { isNativeAndroid, requestNativeGoogleSheetsAccess } from './nativeBridge';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
            error_callback?: (error: any) => void;
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void;
          };
        };
      };
    };
    gapi?: any;
  }
}

const OAUTH_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Loads the Google Identity Services script if not already present
 */
export async function loadGsiScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) {
    return;
  }
  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById('google-gsi-client') as HTMLScriptElement | null;
    if (existingScript) {
      if (existingScript.dataset.loaded === 'true' && window.google?.accounts?.oauth2) {
        resolve();
        return;
      }
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', (err) => reject(err));
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gsi-client';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

/**
 * Requests an OAuth access token using popup authentication
 */
export async function getGoogleAccessToken(forcePrompt = false): Promise<string> {
  if (cachedAccessToken && Date.now() < tokenExpiresAt && !forcePrompt) {
    return cachedAccessToken;
  }

  if (isNativeAndroid()) {
    try {
      cachedAccessToken = await requestNativeGoogleSheetsAccess();
      tokenExpiresAt = Date.now() + 50 * 60 * 1000;
      return cachedAccessToken;
    } catch (error: any) {
      throw new Error(`Google account authorization failed: ${error?.message || 'unknown Android authorization error'}`);
    }
  }

  if (!OAUTH_CLIENT_ID) {
    throw new Error('Google Sheets web sync is not configured. Set VITE_GOOGLE_CLIENT_ID for the web build.');
  }

  await loadGsiScript();

  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services SDK is unavailable.');
  }

  return new Promise((resolve, reject) => {
    try {
      const client = window.google!.accounts.oauth2.initTokenClient({
        client_id: OAUTH_CLIENT_ID,
        scope: SCOPES,
        callback: (resp) => {
          if (resp.error) {
            reject(new Error(`OAuth Authorization Error: ${resp.error}`));
            return;
          }
          if (resp.access_token) {
            cachedAccessToken = resp.access_token;
            // Token is typically valid for 3600 seconds
            tokenExpiresAt = Date.now() + 3500 * 1000;
            resolve(resp.access_token);
          } else {
            reject(new Error('No access token returned by Google Sign-In.'));
          }
        },
        error_callback: (err) => {
          reject(new Error(`OAuth Initialization Failed: ${err?.message || JSON.stringify(err)}`));
        },
      });

      client.requestAccessToken({ prompt: forcePrompt ? 'consent' : '' });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Checks if we have an active or cached Google token
 */
export function hasGoogleAuth(): boolean {
  return Boolean(cachedAccessToken && Date.now() < tokenExpiresAt);
}

/**
 * Signs out / clears cached token
 */
export function disconnectGoogle(): void {
  cachedAccessToken = null;
  tokenExpiresAt = 0;
}

export interface SyncSheetsResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  spreadsheetTitle: string;
  newEntriesSynced: number;
  recordsUpdated: number;
  rowsAppended: number;
  syncedAt: string;
  fullBackupSaved: boolean;
  updatedTimeline?: TimelineEvent[];
}

export interface FullBackupSnapshot {
  timestamp: string;
  date: string;
  version: string;
  state: DailyState;
  learningProfile: AutoLearningProfile;
  stats: {
    totalTasks: number;
    completedTasks: number;
    timelineEvents: number;
    points: number;
    learningInteractions: number;
  };
}

/**
 * Creates a structured Google Spreadsheet for DayTrace with pre-formatted sheets
 */
export async function createDayTraceSpreadsheet(
  token: string,
  title = 'DayTrace Productivity & Accountability Journal'
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const payload = {
    properties: {
      title,
    },
    sheets: [
      { properties: { title: 'Daily Summary', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'Timeline Logs', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'Task Board', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'Reminders & Alarms', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'Planned vs Actual', gridProperties: { frozenRowCount: 1 } } },
      { properties: { title: 'Full State Backups', gridProperties: { frozenRowCount: 1 } } },
    ],
  };

  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to create spreadsheet: ${errText}`);
  }

  const data = await response.json();
  const spreadsheetId = data.spreadsheetId;
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Initialize Header Rows for each tab
  await initializeSheetHeaders(token, spreadsheetId);

  return { spreadsheetId, spreadsheetUrl };
}

/**
 * Sets up header rows in the spreadsheet
 */
async function initializeSheetHeaders(token: string, spreadsheetId: string): Promise<void> {
  const valueRanges = [
    {
      range: "'Daily Summary'!A1:H1",
      values: [
        ['Date', 'Energy Level', 'Location', 'Completed Tasks', 'Pending Tasks', 'Waiting Tasks', 'Blocked Tasks', 'Review Narrative / Synthesis'],
      ],
    },
    {
      range: "'Timeline Logs'!A1:I1",
      values: [
        ['Entry ID', 'Date', 'Time', 'Type', 'Description', 'Location', 'Source', 'Classification', 'Notes'],
      ],
    },
    {
      range: "'Task Board'!A1:J1",
      values: [
        ['Task ID', 'Date', 'Title', 'Category', 'Status', 'Owner', 'Priority (1-10)', 'Est. Minutes', 'Blocked By / Dependency', 'Notes'],
      ],
    },
    {
      range: "'Reminders & Alarms'!A1:F1",
      values: [
        ['Reminder ID', 'Date', 'Type', 'Trigger Condition / Time', 'Message', 'Status'],
      ],
    },
    {
      range: "'Planned vs Actual'!A1:F1",
      values: [
        ['Date', 'Event / Milestone', 'Planned Time', 'Actual Time', 'Variance', 'Notes / Context'],
      ],
    },
    {
      range: "'Full State Backups'!A1:G1",
      values: [
        ['Backup Timestamp', 'Date', 'App Version', 'Total Tasks', 'Timeline Events', 'Learned Shortcuts', 'Full JSON State Snapshot'],
      ],
    },
  ];

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: valueRanges,
    }),
  });
}

/**
 * Helper to fetch values from a specific tab range
 */
async function fetchSheetValues(token: string, spreadsheetId: string, range: string): Promise<any[][]> {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.values || [];
  } catch (e) {
    console.warn(`Could not fetch range ${range}:`, e);
    return [];
  }
}

/**
 * Synchronizes DayTrace state to the connected Google Spreadsheet with true IDEMPOTENCY.
 * 
 * Rules:
 * 1. Matches stable record IDs for Timeline Logs, Task Board, and Reminders & Alarms.
 * 2. If record ID already exists in the Sheet, it updates the row if properties changed (e.g. status DONE), and DOES NOT append a duplicate.
 * 3. Appends only new/unseen record IDs.
 * 4. Daily Summary updates today's row if present, or appends if new.
 * 5. Full State Backups appends a timestamped snapshot.
 */
export async function syncStateToGoogleSheets(
  dailyState: DailyState,
  existingSpreadsheetId?: string | null,
  reviewData?: Partial<EndOfDayReview> | null
): Promise<SyncSheetsResult> {
  const token = await getGoogleAccessToken();
  let spreadsheetId = existingSpreadsheetId;
  let spreadsheetUrl = '';
  let spreadsheetTitle = 'DayTrace Productivity & Accountability Journal';

  // 1. Verify or create spreadsheet
  if (!spreadsheetId) {
    const created = await createDayTraceSpreadsheet(token, spreadsheetTitle);
    spreadsheetId = created.spreadsheetId;
    spreadsheetUrl = created.spreadsheetUrl;
  } else {
    spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  }

  const currentDate = dailyState.date || new Date().toISOString().split('T')[0];
  const learningProfile = getLearningProfile();

  let newEntriesSynced = 0;
  let recordsUpdated = 0;
  let totalRowsAppended = 0;

  const batchUpdateValues: Array<{ range: string; values: any[][] }> = [];

  // ========================================================
  // 1. TIMELINE LOGS (Idempotent by Entry ID)
  // ========================================================
  const existingTimelineRows = await fetchSheetValues(token, spreadsheetId, "'Timeline Logs'!A:I");
  const existingTimelineMap = new Map<string, { rowIndex: number; row: any[] }>();

  // Determine if header has Entry ID at col A (1-based index)
  let timelineIdColIndex = 0;
  if (existingTimelineRows.length > 0) {
    const header = existingTimelineRows[0];
    if (header[0] !== 'Entry ID') {
      // If old format (where Date was col A), ensure header is updated
      batchUpdateValues.push({
        range: "'Timeline Logs'!A1:I1",
        values: [['Entry ID', 'Date', 'Time', 'Type', 'Description', 'Location', 'Source', 'Classification', 'Notes']],
      });
    }

    for (let r = 1; r < existingTimelineRows.length; r++) {
      const row = existingTimelineRows[r];
      const entryId = row[0] ? String(row[0]).trim() : '';
      if (entryId) {
        existingTimelineMap.set(entryId, { rowIndex: r + 1, row });
      }
    }
  }

  const newTimelineRowsToAppend: any[][] = [];
  const updatedTimelineList: TimelineEvent[] = dailyState.timeline.map((e) => {
    const entryId = e.id;
    const expectedRow = [
      entryId,
      e.date || currentDate,
      e.time,
      e.type,
      e.description,
      e.location || dailyState.current.location,
      e.source || 'MANUAL',
      e.classification || 'NORMAL',
      e.notes || '',
    ];

    if (existingTimelineMap.has(entryId)) {
      const existing = existingTimelineMap.get(entryId)!;
      // Check if values changed
      const hasChanged = expectedRow.some((val, idx) => String(val || '') !== String(existing.row[idx] || ''));
      if (hasChanged) {
        batchUpdateValues.push({
          range: `'Timeline Logs'!A${existing.rowIndex}:I${existing.rowIndex}`,
          values: [expectedRow],
        });
        recordsUpdated++;
      }
    } else {
      newTimelineRowsToAppend.push(expectedRow);
      newEntriesSynced++;
    }

    return {
      ...e,
      syncStatus: 'SYNCED',
    };
  });

  // ========================================================
  // 2. TASK BOARD (Idempotent by Task ID)
  // ========================================================
  const existingTaskRows = await fetchSheetValues(token, spreadsheetId, "'Task Board'!A:J");
  const existingTaskMap = new Map<string, { rowIndex: number; row: any[] }>();

  if (existingTaskRows.length > 0) {
    const header = existingTaskRows[0];
    if (header[0] !== 'Task ID') {
      batchUpdateValues.push({
        range: "'Task Board'!A1:J1",
        values: [['Task ID', 'Date', 'Title', 'Category', 'Status', 'Owner', 'Priority (1-10)', 'Est. Minutes', 'Blocked By / Dependency', 'Notes']],
      });
    }

    for (let r = 1; r < existingTaskRows.length; r++) {
      const row = existingTaskRows[r];
      const taskId = row[0] ? String(row[0]).trim() : '';
      if (taskId) {
        existingTaskMap.set(taskId, { rowIndex: r + 1, row });
      }
    }
  }

  const newTaskRowsToAppend: any[][] = [];
  dailyState.tasks.forEach((t) => {
    const expectedRow = [
      t.id,
      t.date || currentDate,
      t.title,
      t.category,
      t.status,
      t.owner,
      t.priority,
      t.estimatedMinutes || '',
      t.blockedBy || t.dependsOn || '',
      t.notes || '',
    ];

    if (existingTaskMap.has(t.id)) {
      const existing = existingTaskMap.get(t.id)!;
      const hasChanged = expectedRow.some((val, idx) => String(val || '') !== String(existing.row[idx] || ''));
      if (hasChanged) {
        batchUpdateValues.push({
          range: `'Task Board'!A${existing.rowIndex}:J${existing.rowIndex}`,
          values: [expectedRow],
        });
        recordsUpdated++;
      }
    } else {
      newTaskRowsToAppend.push(expectedRow);
      newEntriesSynced++;
    }
  });

  // ========================================================
  // 3. REMINDERS & ALARMS (Idempotent by Reminder ID)
  // ========================================================
  const existingReminderRows = await fetchSheetValues(token, spreadsheetId, "'Reminders & Alarms'!A:F");
  const existingReminderMap = new Map<string, { rowIndex: number; row: any[] }>();

  if (existingReminderRows.length > 0) {
    const header = existingReminderRows[0];
    if (header[0] !== 'Reminder ID') {
      batchUpdateValues.push({
        range: "'Reminders & Alarms'!A1:F1",
        values: [['Reminder ID', 'Date', 'Type', 'Trigger Condition / Time', 'Message', 'Status']],
      });
    }

    for (let r = 1; r < existingReminderRows.length; r++) {
      const row = existingReminderRows[r];
      const remId = row[0] ? String(row[0]).trim() : '';
      if (remId) {
        existingReminderMap.set(remId, { rowIndex: r + 1, row });
      }
    }
  }

  const newReminderRowsToAppend: any[][] = [];
  dailyState.reminders.forEach((r) => {
    const expectedRow = [
      r.id,
      r.date || currentDate,
      r.type,
      r.triggerCondition,
      r.message,
      r.isDone ? 'DONE' : 'PENDING',
    ];

    if (existingReminderMap.has(r.id)) {
      const existing = existingReminderMap.get(r.id)!;
      const hasChanged = expectedRow.some((val, idx) => String(val || '') !== String(existing.row[idx] || ''));
      if (hasChanged) {
        batchUpdateValues.push({
          range: `'Reminders & Alarms'!A${existing.rowIndex}:F${existing.rowIndex}`,
          values: [expectedRow],
        });
        recordsUpdated++;
      }
    } else {
      newReminderRowsToAppend.push(expectedRow);
      newEntriesSynced++;
    }
  });

  // ========================================================
  // 4. DAILY SUMMARY (Upsert today's summary)
  // ========================================================
  const existingSummaryRows = await fetchSheetValues(token, spreadsheetId, "'Daily Summary'!A:H");
  let todaySummaryRowIndex = -1;

  for (let r = 1; r < existingSummaryRows.length; r++) {
    if (existingSummaryRows[r][0] === currentDate) {
      todaySummaryRowIndex = r + 1;
      break;
    }
  }

  const completedTasks = dailyState.tasks.filter((t) => t.status === 'DONE');
  const pendingTasks = dailyState.tasks.filter((t) => t.status === 'NEXT' || t.status === 'ACTIVE' || t.status === 'CAPTURED');
  const waitingTasks = dailyState.tasks.filter((t) => t.status === 'WAITING');
  const blockedTasks = dailyState.tasks.filter((t) => t.status === 'BLOCKED');

  const summaryRow = [
    currentDate,
    dailyState.current.energy,
    dailyState.current.location,
    completedTasks.length,
    pendingTasks.length,
    waitingTasks.length,
    blockedTasks.length,
    reviewData?.summaryNarrative || `Logged ${dailyState.timeline.length} timeline events. Current focus: ${dailyState.current.activity}`,
  ];

  if (todaySummaryRowIndex > 0) {
    batchUpdateValues.push({
      range: `'Daily Summary'!A${todaySummaryRowIndex}:H${todaySummaryRowIndex}`,
      values: [summaryRow],
    });
    recordsUpdated++;
  } else {
    // Append new daily summary
    const res = await appendToSheet(token, spreadsheetId, "'Daily Summary'!A:H", [summaryRow]);
    if (res) totalRowsAppended++;
  }

  // ========================================================
  // 5. PLANNED VS ACTUAL (Upsert by Event/Milestone)
  // ========================================================
  const plannedVsActualItems = reviewData?.plannedVsActual || [];
  if (plannedVsActualItems.length > 0) {
    const existingPvaRows = await fetchSheetValues(token, spreadsheetId, "'Planned vs Actual'!A:F");
    const pvaKeyMap = new Map<string, number>();

    for (let r = 1; r < existingPvaRows.length; r++) {
      const rowDate = existingPvaRows[r][0];
      const rowEvent = existingPvaRows[r][1];
      if (rowDate && rowEvent) {
        pvaKeyMap.set(`${rowDate}:::${rowEvent}`, r + 1);
      }
    }

    const newPvaRows: any[][] = [];
    plannedVsActualItems.forEach((p) => {
      const key = `${currentDate}:::${p.event}`;
      const row = [currentDate, p.event, p.planned, p.actual, p.variance, p.notes || ''];
      if (pvaKeyMap.has(key)) {
        const rowIndex = pvaKeyMap.get(key)!;
        batchUpdateValues.push({
          range: `'Planned vs Actual'!A${rowIndex}:F${rowIndex}`,
          values: [row],
        });
      } else {
        newPvaRows.push(row);
      }
    });

    if (newPvaRows.length > 0) {
      const res = await appendToSheet(token, spreadsheetId, "'Planned vs Actual'!A:F", newPvaRows);
      if (res) totalRowsAppended += newPvaRows.length;
    }
  }

  // ========================================================
  // 6. FULL STATE BACKUPS (Versioned Snapshot per Requirement 7)
  // ========================================================
  const fullSnapshot: FullBackupSnapshot = {
    timestamp: new Date().toISOString(),
    date: currentDate,
    version: '1.0.0',
    state: dailyState,
    learningProfile,
    stats: {
      totalTasks: dailyState.tasks.length,
      completedTasks: completedTasks.length,
      timelineEvents: dailyState.timeline.length,
      points: dailyState.gamification?.points || 0,
      learningInteractions: learningProfile.totalLearnedInteractions || 0,
    },
  };

  const backupRow = [
    new Date().toISOString(),
    currentDate,
    'v1.0.0',
    dailyState.tasks.length,
    dailyState.timeline.length,
    learningProfile.totalLearnedInteractions || 0,
    JSON.stringify(fullSnapshot),
  ];

  await appendToSheet(token, spreadsheetId, "'Full State Backups'!A:G", [backupRow]);
  totalRowsAppended++;

  // Execute Appends for new items only
  if (newTimelineRowsToAppend.length > 0) {
    const res = await appendToSheet(token, spreadsheetId, "'Timeline Logs'!A:I", newTimelineRowsToAppend);
    if (res) totalRowsAppended += newTimelineRowsToAppend.length;
  }
  if (newTaskRowsToAppend.length > 0) {
    const res = await appendToSheet(token, spreadsheetId, "'Task Board'!A:J", newTaskRowsToAppend);
    if (res) totalRowsAppended += newTaskRowsToAppend.length;
  }
  if (newReminderRowsToAppend.length > 0) {
    const res = await appendToSheet(token, spreadsheetId, "'Reminders & Alarms'!A:F", newReminderRowsToAppend);
    if (res) totalRowsAppended += newReminderRowsToAppend.length;
  }

  // Execute Batch Updates for modified records
  if (batchUpdateValues.length > 0) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: batchUpdateValues,
      }),
    });
  }

  const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return {
    spreadsheetId,
    spreadsheetUrl,
    spreadsheetTitle,
    newEntriesSynced,
    recordsUpdated,
    rowsAppended: totalRowsAppended,
    syncedAt: nowTime,
    fullBackupSaved: true,
    updatedTimeline: updatedTimelineList,
  };
}

/**
 * Appends rows to a range
 */
async function appendToSheet(token: string, spreadsheetId: string, range: string, values: any[][]): Promise<boolean> {
  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
      }
    );
    return res.ok;
  } catch (e) {
    console.warn(`Failed to append to ${range}:`, e);
    return false;
  }
}

/**
 * Fetches the latest backup snapshot from Google Sheets for full state restoration
 */
export async function fetchLatestBackupFromGoogleSheets(
  spreadsheetId: string
): Promise<FullBackupSnapshot | null> {
  const token = await getGoogleAccessToken();
  const range = "'Full State Backups'!A2:G";

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to retrieve backup records from Google Sheets.');
  }

  const data = await response.json();
  const rows = data.values || [];
  if (rows.length === 0) {
    return null;
  }

  // Get the most recent row (last row)
  const latestRow = rows[rows.length - 1];
  const jsonString = latestRow[6];
  if (!jsonString) {
    throw new Error('No backup JSON found in the latest record.');
  }

  return JSON.parse(jsonString) as FullBackupSnapshot;
}

/** Returns the newest full-state backup for one calendar date. */
export async function fetchBackupForDateFromGoogleSheets(
  spreadsheetId: string,
  date: string
): Promise<FullBackupSnapshot | null> {
  const token = await getGoogleAccessToken();
  const range = "'Full State Backups'!A2:G";
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to retrieve ${date} from Google Sheets (${response.status}): ${detail.slice(0, 180)}`);
  }

  const data = await response.json();
  const rows: any[][] = data.values || [];
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (String(row?.[1] || '') !== date || !row?.[6]) continue;
    try {
      return JSON.parse(row[6]) as FullBackupSnapshot;
    } catch {
      throw new Error(`The Google Sheets backup for ${date} contains invalid JSON.`);
    }
  }
  return null;
}
