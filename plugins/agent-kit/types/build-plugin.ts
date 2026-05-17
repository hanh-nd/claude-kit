export interface Provider {
  root: string;
  skillKeys: string[];
  configPath?: string;
}

export interface SplitFrontmatterResult {
  yaml: string;
  body: string;
}

export interface ProviderSkillConfig {
  skillDir: string;
  relativePath: string;
  content: string;
}
