export type EnforcementMode = 'block' | 'audit';

export interface SecuritySettings {
  allowOutside?: boolean;
  allowedOutsidePaths?: string[];
  additionalSystemBinPaths?: string[];
  additionalForbiddenFiles?: string[];
  additionalForbiddenDirs?: string[];
  enforcementMode?: EnforcementMode;
}

export interface ProjectSettings {
  hasTests?: boolean;
  runTests?: boolean;
}

export interface AgentKitSettings {
  security?: SecuritySettings;
  project?: ProjectSettings;
}

export interface SecurityConfig {
  allowOutside: boolean;
  allowedOutsidePaths: string[];
  additionalSystemBinPaths: string[];
  additionalForbiddenFiles: string[];
  additionalForbiddenDirs: string[];
  enforcementMode: EnforcementMode;
}

export interface SecurityPolicy {
  enforcementMode: EnforcementMode;
  projectDir: string;
  homeDir: string;
  caseInsensitive: boolean;
  forbiddenFiles: readonly string[];
  forbiddenRegexes: readonly RegExp[];
  forbiddenDirs: readonly string[];
  allowedOutsidePaths: readonly string[];
  allowOutside: boolean;
  systemBinPaths: readonly string[];
  knownEnvVars: Readonly<Record<string, string>>;
}

export interface ShellCandidate {
  raw: string;
  expanded: string;
  unresolvedVars: readonly string[];
}

export interface ExpandedToken {
  expanded: string;
  unresolvedVars: string[];
}

export interface SecurityHookCall {
  method?: unknown;
  params?: unknown;
}

export interface SecurityHookPayload {
  prompt?: unknown;
  tool_name?: unknown;
  tool?: unknown;
  action?: unknown;
  name?: unknown;
  call?: SecurityHookCall;
  tool_input?: unknown;
  args?: unknown;
}
