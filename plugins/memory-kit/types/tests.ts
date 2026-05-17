import type { WikiPage } from './wiki.js';

export interface MakeHitOverrides {
  page?: Partial<WikiPage>;
  slug?: string;
  category?: string;
  path?: string;
  score?: number;
}

export interface BuildWikiDirOpts {
  compiledPages?: Record<string, string>;
  inboxContent?: string | null;
}
