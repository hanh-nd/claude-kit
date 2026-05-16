import * as path from 'path';

export function isBlockedFilename(name, policy) {
  const lower = name.toLowerCase();
  if (policy.forbiddenFiles.some((f) => lower === f)) return true;
  if (policy.forbiddenRegexes.some((re) => re.test(name))) return true;
  return false;
}

export function isInForbiddenDir(filePath, policy) {
  const segments = filePath.split(/[/\\]+/);
  return segments.find((s) => policy.forbiddenDirs.includes(s.toLowerCase())) ?? null;
}
