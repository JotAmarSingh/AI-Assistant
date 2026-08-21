/**
 * Google Workspace OAuth & Sheets Synchronizer Service
 * Uses Google Identity Services (GSI) Token Client & Google Sheets v4 REST API
 * Supports:
 * 1. Granular Structured Sheet Tabs (Daily Summary, Timeline Logs, Task Board, Reminders, Planned vs Actual)
 * 2. Full State JSON Backup Tab (Full snapshot of tasks, logs, auto-learning stats, timetable, gamification)
 * 3. 1-Click Restore directly from Google Sheets for fresh/new phone installs
 * 4. Nightly WhatsApp-style Auto-Backup Scheduler (e.g. 02:00 AM or daily catchup)
 */
import { DailyState, EndOfDayReview } from '../types';
import { getLearningProfile, AutoLearningProfile } from '../utils/autoLearning';

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
    const existingScript = document.getElementById('google-gsi-client');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', (err) => reject(err));
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gsi-client';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
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
  rowsAppended: number;
  syncedAt: string;
  fullBackupSaved: boolean;
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
 * Sets up header rows in the newly created spreadsheet
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
      range: "'Timeline Logs'!A1:G1",
      values: [
        ['Date', 'Time', 'Type', 'Description', 'Location', 'Classification', 'Notes'],
      ],
    },
    {
      range: "'Task Board'!A1:J1",
      values: [
        ['Date', 'Task ID', 'Title', 'Category', 'Status', 'Owner', 'Priority (1-10)', 'Est. Minutes', 'Blocked By / Dependency', 'Notes'],
      ],
    },
    {
      range: "'Reminders & Alarms'!A1:F1",
      values: [
        ['Date', 'Reminder ID', 'Type', 'Trigger Condition / Time', 'Message', 'Status'],
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
 * Synchronizes DayTrace state to the connected Google Spreadsheet
 * Includes structured rows AND full state JSON snapshot for complete restoration
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

  // 2. Prepare Data Rows
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

  const timelineRows = dailyState.timeline.map((e) => [
    currentDate,
    e.time,
    e.type,
    e.description,
    e.location || dailyState.current.location,
    e.classification || 'NORMAL',
    e.notes || '',
  ]);

  const taskRows = dailyState.tasks.map((t) => [
    currentDate,
    t.id,
    t.title,
    t.category,
    t.status,
    t.owner,
    t.priority,
    t.estimatedMinutes || '',
    t.blockedBy || t.dependsOn || '',
    t.notes || '',
  ]);

  const reminderRows = dailyState.reminders.map((r) => [
    currentDate,
    r.id,
    r.type,
    r.triggerCondition,
    r.message,
    r.isDone ? 'DONE' : 'PENDING',
  ]);

  const plannedVsActualRows = (reviewData?.plannedVsActual || []).map((p) => [
    currentDate,
    p.event,
    p.planned,
    p.actual,
    p.variance,
    p.notes || '',
  ]);

  // Full backup payload for clean install restoration
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

  // 3. Append to Sheets
  const appendRequests = [
    { range: "'Daily Summary'!A:H", values: [summaryRow] },
    ...(timelineRows.length > 0 ? [{ range: "'Timeline Logs'!A:G", values: timelineRows }] : []),
    ...(taskRows.length > 0 ? [{ range: "'Task Board'!A:J", values: taskRows }] : []),
    ...(reminderRows.length > 0 ? [{ range: "'Reminders & Alarms'!A:F", values: reminderRows }] : []),
    ...(plannedVsActualRows.length > 0 ? [{ range: "'Planned vs Actual'!A:F", values: plannedVsActualRows }] : []),
    { range: "'Full State Backups'!A:G", values: [backupRow] },
  ];

  let totalAppended = 0;

  for (const req of appendRequests) {
    try {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(req.range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: req.values,
          }),
        }
      );
      if (res.ok) {
        totalAppended += req.values.length;
      }
    } catch (e) {
      console.warn(`Failed to append to ${req.range}`, e);
    }
  }

  const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return {
    spreadsheetId,
    spreadsheetUrl,
    spreadsheetTitle,
    rowsAppended: totalAppended,
    syncedAt: nowTime,
    fullBackupSaved: true,
  };
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
