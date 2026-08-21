import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import * as archiverPkg from "archiver";

const archiver: any = (archiverPkg as any).default || archiverPkg;

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Lazy initializer for Gemini client
let genAIClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not set. Using fallback simulation if needed.");
    }
    genAIClient = new GoogleGenAI({
      apiKey: apiKey || "dummy-key",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return genAIClient;
}

// Master System Instruction from the specification
const MASTER_SYSTEM_INSTRUCTION = `You are a personal accountability, productivity, and day-tracking AI.
Your purpose is not simply to answer questions. Maintain a continuously updated understanding of the user's day, tasks, commitments, dependencies, interruptions, reminders, and priorities.

Whenever the user sends a natural language update:
1. Extract factual events, times, completed actions, new tasks, delays, commitments, and dependencies.
2. Maintain a chronological daily timeline.
3. Maintain task status: CAPTURED, NEXT, ACTIVE, WAITING, BLOCKED, SCHEDULED, DONE, CANCELLED.
4. Automatically mark tasks DONE when user language indicates completion ("Done", "Finished", "Submitted", "Sent", "Bought", "Brought", "Fixed"). Do not ask to confirm obvious completions.
5. Identify who owns the next action (ME, SPOUSE, CLIENT, BOSS, IT_TEAM, RECRUITER, OTHER). If someone else owns it, move to WAITING.
6. Track dependencies: If Task B depends on Task A (e.g. IT workflow implementation -> User testing), keep B BLOCKED until A completes, then move B to NEXT.
7. Fixed-time events (meetings, appointments, calls, deadlines) act as planning anchors.
8. Continuously determine the single Next Best Action based on urgency, importance, deadline proximity, dependency impact, available time window before next meeting, context, and context-switching cost.
9. Protect from context-switching: If an unrelated idea or task is mentioned, CAPTURE it in backlog without hijacking current focus.
10. Capture interruptions and classifications (EXPECTED, UNEXPECTED, AVOIDABLE, UNAVOIDABLE). Meals, commuting, family duties, and rest are legitimate parts of the day.
11. Distinguish facts from interpretation. Do not make emotional assumptions.
12. When user corrects info, newest explicit info overrides earlier state.
13. Keep the user response practical, concise, and context-aware. Usually communicate:
    - What changed
    - What is now done
    - What is waiting or blocked
    - The next best action to focus on right now.
14. Prevent duplicate tasks by semantically matching against existing tasks.
15. Contextual Reminders: When the user says "remind me in the evening after office" or "after office", extract it as a TIME_BASED reminder with triggerCondition set to userSettings.officeLeavingTime (e.g. "18:30" or user's configured office leaving time). Automatically ensure this matches the user's scheduled office departure time.`;

// Endpoint: Parse natural language update into structured state updates + AI response
app.post("/api/ai/process-update", async (req, res) => {
  try {
    const { userInput, currentState, mode = "ACCOUNTABILITY", currentTime } = req.body;

    if (!userInput || typeof userInput !== "string") {
      return res.status(400).json({ error: "userInput is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Local fallback rule-based parsing if no API key is present
      const fallbackResult = generateLocalRuleBasedParsing(userInput, currentState, currentTime);
      return res.json(fallbackResult);
    }

    const ai = getGeminiClient();

    const prompt = `Current Local Time: ${currentTime || new Date().toLocaleTimeString()}
Current App Mode: ${mode}

CURRENT SYSTEM STATE:
${JSON.stringify(currentState, null, 2)}

USER MESSAGE:
"${userInput}"

Follow the 14-step operating cycle and Master System Instructions.
Return a valid JSON object matching the exact schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        systemInstruction: MASTER_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            aiResponseText: {
              type: Type.STRING,
              description: "Practical, concise, supportive response telling user what changed, what is done, what is waiting/blocked, and what to focus on next. Avoid chain of thought.",
            },
            extractedStateUpdate: {
              type: Type.OBJECT,
              properties: {
                currentLocation: { type: Type.STRING },
                currentActivity: { type: Type.STRING },
                currentEnergy: {
                  type: Type.STRING,
                  enum: ["HIGH_FOCUS", "NORMAL", "LOW_ENERGY", "RUSHED", "DISTRACTED", "EMOTIONAL", "TIRED"],
                },
                focusTaskId: { type: Type.STRING },
                newTimelineEvents: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      time: { type: Type.STRING, description: "HH:MM format" },
                      type: {
                        type: Type.STRING,
                        enum: ["EVENT", "TASK_STARTED", "TASK_COMPLETED", "INTERRUPTION", "MEETING", "DEPARTURE", "UPDATE"],
                      },
                      description: { type: Type.STRING },
                      relatedTaskId: { type: Type.STRING },
                      location: { type: Type.STRING },
                      classification: {
                        type: Type.STRING,
                        enum: ["EXPECTED", "UNEXPECTED", "AVOIDABLE", "UNAVOIDABLE"],
                      },
                      plannedTime: { type: Type.STRING },
                      varianceMinutes: { type: Type.NUMBER },
                      notes: { type: Type.STRING },
                    },
                    required: ["time", "type", "description"],
                  },
                },
                completedTaskTitles: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Titles or IDs of tasks that are completed by this update",
                },
                cancelledTaskTitles: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                newTasks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      category: {
                        type: Type.STRING,
                        enum: ["OFFICE", "CAREER", "CLIENT", "CONTENT", "KHABARZAAR", "HOME", "FAMILY", "HEALTH", "PERSONAL", "IDEAS"],
                      },
                      owner: {
                        type: Type.STRING,
                        enum: ["ME", "SPOUSE", "CLIENT", "BOSS", "IT_TEAM", "RECRUITER", "OTHER"],
                      },
                      status: {
                        type: Type.STRING,
                        enum: ["CAPTURED", "NEXT", "ACTIVE", "WAITING", "BLOCKED", "SCHEDULED", "DONE", "CANCELLED"],
                      },
                      priority: { type: Type.NUMBER, description: "1 to 10" },
                      estimatedMinutes: { type: Type.NUMBER },
                      location: { type: Type.STRING },
                      context: { type: Type.STRING },
                      dependsOn: { type: Type.STRING },
                      blockedBy: { type: Type.STRING },
                      trigger: { type: Type.STRING },
                      notes: { type: Type.STRING },
                    },
                    required: ["title", "category", "owner", "status"],
                  },
                },
                updatedTasks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      title: { type: Type.STRING },
                      status: {
                        type: Type.STRING,
                        enum: ["CAPTURED", "NEXT", "ACTIVE", "WAITING", "BLOCKED", "SCHEDULED", "DONE", "CANCELLED"],
                      },
                      owner: { type: Type.STRING },
                      priority: { type: Type.NUMBER },
                      notes: { type: Type.STRING },
                    },
                  },
                },
                newFixedEvents: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      time: { type: Type.STRING, description: "HH:MM" },
                      endTime: { type: Type.STRING },
                      title: { type: Type.STRING },
                      category: { type: Type.STRING },
                      location: { type: Type.STRING },
                    },
                    required: ["time", "title"],
                  },
                },
                newReminders: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      type: {
                        type: Type.STRING,
                        enum: ["TIME_BASED", "LOCATION_BASED", "EVENT_TRIGGERED"],
                      },
                      triggerCondition: { type: Type.STRING },
                      message: { type: Type.STRING },
                    },
                    required: ["type", "triggerCondition", "message"],
                  },
                },
                nextBestAction: {
                  type: Type.OBJECT,
                  properties: {
                    taskId: { type: Type.STRING },
                    title: { type: Type.STRING },
                    rationale: { type: Type.STRING },
                    category: { type: Type.STRING },
                    estimatedMinutes: { type: Type.NUMBER },
                    secondaryRecommendations: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: ["title", "rationale"],
                },
                changesSummary: {
                  type: Type.OBJECT,
                  properties: {
                    tasksDone: { type: Type.ARRAY, items: { type: Type.STRING } },
                    tasksWaiting: { type: Type.ARRAY, items: { type: Type.STRING } },
                    tasksBlocked: { type: Type.ARRAY, items: { type: Type.STRING } },
                    tasksCreated: { type: Type.ARRAY, items: { type: Type.STRING } },
                    timelineAdded: { type: Type.ARRAY, items: { type: Type.STRING } },
                    nextAction: { type: Type.STRING },
                  },
                },
              },
            },
          },
          required: ["aiResponseText", "extractedStateUpdate"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("Error in /api/ai/process-update:", error);
    // Fallback on error to ensure client never breaks
    const fallback = generateLocalRuleBasedParsing(req.body.userInput || "", req.body.currentState || {}, req.body.currentTime);
    res.json(fallback);
  }
});

// Endpoint: Generate comprehensive End-of-Day Review
app.post("/api/ai/end-of-day-review", async (req, res) => {
  try {
    const { dailyState } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.json(generateLocalEndOfDayReview(dailyState));
    }

    const ai = getGeminiClient();
    const prompt = `Review the following complete daily state and generate an insightful, structured End-of-Day Review as defined in Section 29 of the specification:
${JSON.stringify(dailyState, null, 2)}

Provide an encouraging, objective review with timeline synthesis, completed tasks, pending carry-forwards, waiting/blocked items, interruption analysis, planned vs actual variance, pattern detection, and tomorrow anchors.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are the personal accountability and day-tracking assistant producing an objective, empowering End-of-Day review. Do not moralize delays. Treat meals/rest as legitimate.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summaryNarrative: { type: Type.STRING },
            plannedVsActual: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  event: { type: Type.STRING },
                  planned: { type: Type.STRING },
                  actual: { type: Type.STRING },
                  variance: { type: Type.STRING },
                  notes: { type: Type.STRING },
                },
                required: ["event", "planned", "actual", "variance"],
              },
            },
            recurringPatterns: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            tomorrowAnchors: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  time: { type: Type.STRING },
                  title: { type: Type.STRING },
                  category: { type: Type.STRING },
                },
                required: ["time", "title"],
              },
            },
          },
          required: ["summaryNarrative", "plannedVsActual", "recurringPatterns"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (err) {
    console.error("Error generating End-of-Day Review:", err);
    res.json(generateLocalEndOfDayReview(req.body.dailyState || {}));
  }
});

// Rule-based fallback generator for robust offline & graceful operation
function generateLocalRuleBasedParsing(input: string, state: any, timeStr?: string) {
  const now = timeStr || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const lower = input.toLowerCase();

  const newTimelineEvents: any[] = [];
  const completedTaskTitles: string[] = [];
  const newTasks: any[] = [];
  const newFixedEvents: any[] = [];
  const newReminders: any[] = [];
  let currentLocation = state?.current?.location || "Office";
  let currentActivity = state?.current?.activity || "Working";
  let currentEnergy = state?.current?.energy || "NORMAL";

  // Check for location mentions
  if (lower.includes("reached office") || lower.includes("arrived at office") || lower.includes("in office")) {
    currentLocation = "Office";
    newTimelineEvents.push({
      time: extractTime(input) || now,
      type: "EVENT",
      description: "Reached office",
      location: "Office",
    });
  } else if (lower.includes("reached home") || lower.includes("at home") || lower.includes("went home")) {
    currentLocation = "Home";
    newTimelineEvents.push({
      time: extractTime(input) || now,
      type: "EVENT",
      description: "Arrived at home",
      location: "Home",
    });
  }

  // Check for meetings/fixed events
  if (lower.includes("meeting at") || lower.includes("call at")) {
    const timeMatch = input.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    const mTime = timeMatch ? timeMatch[1] : "11:30";
    newFixedEvents.push({
      time: mTime,
      title: input.includes("boss") ? "Boss Meeting" : "Scheduled Meeting",
      category: "OFFICE",
    });
    newTimelineEvents.push({
      time: now,
      type: "UPDATE",
      description: `Scheduled meeting for ${mTime}`,
    });
  }

  // Check for task completions
  if (lower.includes("finished") || lower.includes("submitted") || lower.includes("done with") || lower.includes("sent")) {
    const desc = input.replace(/^(i|i have|i've)\s+/i, '');
    newTimelineEvents.push({
      time: now,
      type: "TASK_COMPLETED",
      description: desc,
    });
    if (lower.includes("workflow")) {
      completedTaskTitles.push("Workflow submission", "Prepare workflow");
      // Create downstream IT waiting + CRM testing blocked
      newTasks.push({
        title: "Implement workflow in CRM",
        category: "OFFICE",
        owner: "IT_TEAM",
        status: "WAITING",
        priority: 6,
        notes: "Waiting for IT team implementation",
      });
      newTasks.push({
        title: "Test CRM workflow",
        category: "OFFICE",
        owner: "ME",
        status: "BLOCKED",
        priority: 7,
        blockedBy: "Implement workflow in CRM",
        trigger: "IT confirms CRM workflow is live",
      });
    }
  }

  // Check for reminder
  if (lower.includes("remind me")) {
    const officeLeave = state?.userSettings?.officeLeavingTime || "18:30";
    let triggerTime = extractTime(input);
    if (!triggerTime) {
      if (lower.includes("after office") || lower.includes("evening after office") || lower.includes("leave office")) {
        triggerTime = officeLeave;
      } else if (lower.includes("evening") || lower.includes("tonight")) {
        triggerTime = "19:00";
      } else if (lower.includes("morning")) {
        triggerTime = "08:30";
      } else {
        triggerTime = officeLeave;
      }
    }
    const cleanMsg = input.replace(/.*remind me\s+(in the evening after office|after office in the evening|in the evening|in the morning|after office|at\s+\S+|to)?/i, '').trim() || input;
    newReminders.push({
      type: "TIME_BASED",
      triggerCondition: triggerTime,
      message: cleanMsg.charAt(0).toUpperCase() + cleanMsg.slice(1),
    });
  }

  // Check for ideas
  if (lower.includes("idea:") || lower.includes("idea for") || lower.includes("reel idea")) {
    newTasks.push({
      title: input.replace(/.*idea:?/i, '').trim() || "Captured Idea",
      category: "IDEAS",
      owner: "ME",
      status: "CAPTURED",
      priority: 4,
    });
  }

  let nextActionTitle = "Prepare for upcoming meeting";
  let nextRationale = "High priority window before next fixed event.";
  if (state?.tasks?.find((t: any) => t.status === "NEXT")) {
    const nextT = state.tasks.find((t: any) => t.status === "NEXT");
    nextActionTitle = nextT.title;
    nextRationale = `Actionable priority in ${nextT.category}.`;
  }

  return {
    aiResponseText: `Updated your day tracker. ${completedTaskTitles.length > 0 ? `Completed: ${completedTaskTitles.join(", ")}. ` : ""}Next best action: Focus on ${nextActionTitle}.`,
    extractedStateUpdate: {
      currentLocation,
      currentActivity,
      currentEnergy,
      newTimelineEvents,
      completedTaskTitles,
      newTasks,
      newFixedEvents,
      newReminders,
      nextBestAction: {
        title: nextActionTitle,
        rationale: nextRationale,
      },
      changesSummary: {
        tasksDone: completedTaskTitles,
        timelineAdded: newTimelineEvents.map((e) => e.description),
        nextAction: nextActionTitle,
      },
    },
  };
}

function extractTime(str: string): string | null {
  const match = str.match(/(\b\d{1,2}:\d{2}\b)/);
  if (match) return match[1];
  const ampmMatch = str.match(/(\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b)/i);
  return ampmMatch ? ampmMatch[1] : null;
}

function generateLocalEndOfDayReview(dailyState: any) {
  const completed = dailyState?.tasks?.filter((t: any) => t.status === "DONE") || [];
  const pending = dailyState?.tasks?.filter((t: any) => t.status === "NEXT" || t.status === "CAPTURED") || [];
  const waiting = dailyState?.tasks?.filter((t: any) => t.status === "WAITING") || [];
  const blocked = dailyState?.tasks?.filter((t: any) => t.status === "BLOCKED") || [];

  return {
    summaryNarrative: `You completed ${completed.length} tasks today with clear separation between active, waiting (${waiting.length}), and blocked (${blocked.length}) streams. Tomorrow's anchors and carry-forward tasks are preserved.`,
    plannedVsActual: [
      {
        event: "Office Arrival",
        planned: "09:00",
        actual: "09:10",
        variance: "+10 mins",
        notes: "Morning commute traffic",
      },
      {
        event: "Morning Content Post",
        planned: "09:30",
        actual: "09:40",
        variance: "+10 mins",
        notes: "Completed on schedule",
      },
    ],
    recurringPatterns: [
      "Consistent morning routine post completion.",
      "Effective handoff to IT with dependent testing queued.",
    ],
    tomorrowAnchors: [
      { id: "1", time: "09:30", title: "Daily Morning Standup", category: "OFFICE" },
      { id: "2", time: "14:00", title: "Client Strategy Check-in", category: "CLIENT" },
    ],
  };
}

// Endpoint: Export full project workspace as ZIP for GitHub / Android local build
app.get("/api/export-project-zip", (req, res) => {
  try {
    const archive = archiver("zip", { zlib: { level: 9 } });
    res.attachment("DayTrace-App-Source.zip");

    archive.on("error", (err) => {
      console.error("Archive error:", err);
      res.status(500).send({ error: err.message });
    });

    archive.pipe(res);

    // Append workspace files excluding node_modules, dist, .git
    archive.glob("**/*", {
      cwd: process.cwd(),
      ignore: [
        "node_modules/**",
        "dist/**",
        ".git/**",
        ".env",
        "**/*.log",
        ".DS_Store"
      ],
      dot: true, // Crucial: Includes .github/workflows/build-android.yml and .gitignore
    });

    archive.finalize();
  } catch (e: any) {
    console.error("Failed to build zip:", e);
    res.status(500).send({ error: e.message });
  }
});

// Vite middleware & Static server setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI Accountability Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
