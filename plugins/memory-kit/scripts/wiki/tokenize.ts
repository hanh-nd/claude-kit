export function splitCamelSnake(word: string): string[] {
  // Split on underscore (snake_case) and camelCase/PascalCase boundaries
  const snakeParts = word.split('_').filter(Boolean);
  const result: string[] = [];
  for (const part of snakeParts) {
    // Split camelCase: insert boundary before uppercase letters preceded by lowercase
    const camelParts = part.replace(/([a-z])([A-Z])/g, '$1 $2').split(' ');
    for (const cp of camelParts) {
      if (cp) result.push(cp.toLowerCase());
    }
  }
  return result.length > 0 ? result : [word.toLowerCase()];
}

export function lightStem(word: string): string {
  // Skip double-s endings (class, pass, process, access) — stripping would corrupt the root
  if (word.endsWith('ss')) return word;
  if (word.length >= 4 && word.endsWith('s')) {
    return word.slice(0, -1);
  }
  return word;
}

export function tokenize(text: string, stopwords: ReadonlySet<string>): string[] {
  if (!text) return [];

  // Split on whitespace, path separators, and non-word punctuation (hyphen included)
  // Do NOT lowercase yet — preserve case for camelCase splitting
  const rawTokens = text
    .split(/[\s/\\.,;:()[\]{}<>'"=`@#!?%*&^~|+\-]+/)
    .filter(Boolean);

  const result: string[] = [];
  for (const raw of rawTokens) {
    // Each raw token may be camelCase or snake_case; split into parts
    const parts = splitCamelSnake(raw);
    for (const part of parts) {
      const stemmed = lightStem(part);
      if (stemmed.length < 3) continue;
      if (/^\d+$/.test(stemmed)) continue;
      if (stopwords.has(stemmed)) continue;
      result.push(stemmed);
    }
  }

  return result;
}
