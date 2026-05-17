export interface BashAllowlist {
  mode: 'denylist' | 'allowlist';
  patterns: string[];
}

export interface WikiConfig {
  injectMinScore: number;
  debug: boolean;
  injectMarginRatio: number;
  injectMaxResults: number;
  minQueryTokens: number;
  cacheEnabled: boolean;
  bashAllowlist: BashAllowlist;
  stopwords: string[];
}

export interface Settings {
  wiki?: Partial<WikiConfig>;
}
