import { MeetingActionItem } from '../types';

export interface LocalMeetingProcessingResult {
  summary: string;
  actionItems: MeetingActionItem[];
}

/** Deterministic, fully local fallback for user-supplied or corrected transcripts. */
export const processMeetingTranscriptLocally = (transcript: string): LocalMeetingProcessingResult => {
  const sentences = transcript
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const decisions = sentences.filter((sentence) => /\b(decided|agreed|approved|confirmed|resolved|will proceed|final decision)\b/i.test(sentence));
  const actionSentences = sentences.filter((sentence) =>
    /\b(action item|need to|needs to|will|must|follow up|send|prepare|complete|schedule|call|share|deliver)\b/i.test(sentence),
  );
  const summarySentences = Array.from(new Set([...decisions, ...sentences])).slice(0, 4);
  const summary = summarySentences.length > 0
    ? summarySentences.join(' ')
    : 'No summary could be extracted from the transcript.';
  const actionItems = Array.from(new Set(actionSentences)).slice(0, 20).map((text, index) => ({
    id: `meeting-action-${Date.now()}-${index}`,
    text,
    selected: false,
  }));
  return { summary, actionItems };
};
