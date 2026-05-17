export type PageStatus = 'active' | 'complete' | 'parked' | 'deprecated';

export interface WikiPage {
  slug: string;
  category: string;
  path: string;
  title: string;
  status: PageStatus | null;
  updated: string | null;
  summary: string;
  anchors: string[];
  keyDecisions: string[];
  edgeCases: string[];
  bodyText: string;
}

export interface ExtractedWikiQuery {
  toolName: string;
  paths: string[];
  symbols: string[];
  freeText: string;
  terms: string[];
}

export interface ScoredWikiQuery {
  terms: string[];
}

export interface WikiScoreBreakdown {
  filename: number;
  heading: number;
  keyDecision: number;
  body: number;
  status: number;
  staleness: number;
}

export interface WikiHit {
  slug: string;
  category: string;
  path: string;
  score: number;
  breakdown: WikiScoreBreakdown;
  page: WikiPage;
}

export interface WikiLedger {
  sessionId: string;
  startedAt: string;
  injected: Record<string, string>;
}
