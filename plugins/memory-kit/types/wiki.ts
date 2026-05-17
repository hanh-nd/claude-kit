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
  termFreq: Record<string, number>;
  bodyLength: number;
}

export interface ExtractedWikiQuery {
  toolName: string;
  paths: string[];
  pathPrefixes: string[];
  symbols: string[];
  freeText: string;
  freeTextTokens: string[];
  terms: string[];
}

export interface ScoredWikiQuery {
  toolName: string;
  paths: string[];
  pathPrefixes: string[];
  symbols: string[];
  terms: string[];
}

export interface WikiScoreBreakdown {
  anchorExactPath: number;
  anchorExactSymbol: number;
  filenameBM25: number;
  headingBM25: number;
  keyDecisionBM25: number;
  bodyBM25: number;
  statusBoost: number;
  stalenessPenalty: number;
  strongSignal: boolean;
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

export interface ParsedPageCacheEntry {
  slug: string;
  path: string;
  mtimeMs: number;
  page: WikiPage;
}

export interface CorpusIndex {
  schemaVersion: 1;
  stopwordsHash: string;
  pages: ParsedPageCacheEntry[];
  idf: Record<string, number>;
  avgBodyLength: number;
  avgSlugLen: number;
  avgHeadingLen: number;
  avgKdLen: number;
  builtAt: string;
}
