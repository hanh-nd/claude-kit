export const DEFAULT_K1 = 1.5;
export const DEFAULT_B = 0.75;

export function bm25Score(
  queryTerms: string[],
  docTermFreq: Record<string, number>,
  docLength: number,
  avgDocLength: number,
  idf: Readonly<Record<string, number>>,
  k1: number = DEFAULT_K1,
  b: number = DEFAULT_B,
): number {
  if (queryTerms.length === 0 || avgDocLength === 0) return 0;

  let score = 0;
  for (const term of queryTerms) {
    const tf = docTermFreq[term] ?? 0;
    if (tf === 0) continue;
    const idfValue = idf[term] ?? 0;
    const numerator = tf * (k1 + 1);
    const denominator = tf + k1 * (1 - b + b * (docLength / avgDocLength));
    score += idfValue * (numerator / denominator);
  }
  return score;
}
