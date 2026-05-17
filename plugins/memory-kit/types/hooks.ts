import type { Settings } from './settings.js';
import type { WikiScoreBreakdown } from './wiki.js';

export interface DebugDecision {
  decision: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  sessionId?: string | null;
  score?: number;
  threshold?: number;
  slug?: string;
  reason?: string;
  breakdown?: WikiScoreBreakdown;
  top3?: Array<{ slug: string; score: number; breakdown: WikiScoreBreakdown }>;
  injectedSlugs?: string[];
}

export interface HookSpecificOutput {
  hookEventName: string;
  additionalContext: string;
}

export interface MainResponse {
  hookSpecificOutput?: HookSpecificOutput;
}

export interface WikiInjectStdin {
  tool_name: string;
  tool_input?: Record<string, unknown>;
  session_id?: string | null;
}

export interface WikiInjectOptions {
  wikiRoot?: string;
  settings?: Settings;
}

export interface InboxToolInput {
  type?: string;
  slug?: string;
  content?: string;
}

export interface InboxStdin {
  tool_name: string;
  tool_input: InboxToolInput;
}

export interface ExportStdin {
  transcript_path: string;
  session_id: string;
}
