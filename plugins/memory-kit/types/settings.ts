export interface WikiConfig {
  injectMinScore: number;
  debug: boolean;
}

export interface Settings {
  wiki?: Partial<WikiConfig>;
}
