function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s/-]/g, ' ')
    .split(/[\s/\\.,;:()[\]{}<>'"=`@#!?%*&^~]+/)
    .filter((t) => t.length >= 3 && !/^\d+$/.test(t));
}

function extractPaths(toolInput) {
  const paths = [];
  if (typeof toolInput.file_path === 'string') paths.push(toolInput.file_path);
  if (typeof toolInput.path === 'string') paths.push(toolInput.path);
  if (Array.isArray(toolInput.paths)) {
    for (const p of toolInput.paths) if (typeof p === 'string') paths.push(p);
  }
  // Patch-format files: "*** Update/Create/Delete File: <path>"
  const patchText = typeof toolInput.command === 'string' ? toolInput.command : '';
  for (const m of patchText.matchAll(/\*\*\* (?:Update|Create|Delete) File: (.+)/g)) {
    paths.push(m[1].trim());
  }
  return paths;
}

function extractFreeText(toolInput) {
  const parts = [];
  if (typeof toolInput.new_string === 'string') parts.push(toolInput.new_string.slice(0, 200));
  if (typeof toolInput.content === 'string') parts.push(toolInput.content.slice(0, 200));
  if (typeof toolInput.pattern === 'string') parts.push(toolInput.pattern);
  if (typeof toolInput.command === 'string') parts.push(toolInput.command.slice(0, 200));
  if (typeof toolInput.cmd === 'string') parts.push(toolInput.cmd.slice(0, 200));
  return parts.join(' ');
}

export function extractQuery(toolName, toolInput) {
  const safeInput = toolInput && typeof toolInput === 'object' ? toolInput : {};

  try {
    const paths = extractPaths(safeInput);
    const freeText = extractFreeText(safeInput);

    const allText = [...paths, freeText].join(' ');
    const allTokens = tokenize(allText);

    const symbols = paths.flatMap((p) => {
      const base = (p.split(/[/\\]/).pop() ?? '').replace(/\.[^.]+$/, '');
      return tokenize(base);
    });

    const termSet = new Set([...allTokens]);
    const terms = [...termSet];

    return { toolName, paths, symbols, freeText, terms };
  } catch {
    return { toolName, paths: [], symbols: [], freeText: '', terms: [] };
  }
}
