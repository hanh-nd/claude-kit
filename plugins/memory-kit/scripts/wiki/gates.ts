import type { WikiHit } from '@types';

export function applyStrongSignalGate(hits: WikiHit[]): WikiHit[] {
  return hits.filter((h) => h.breakdown.strongSignal);
}

export function applyThresholdGate(hits: WikiHit[], minScore: number): WikiHit[] {
  return hits.filter((h) => h.score >= minScore);
}

export function applyMarginGate(hits: WikiHit[], marginRatio: number): WikiHit[] {
  if (hits.length < 2) return hits;
  if (hits[0].score / hits[1].score < marginRatio) return [];
  // hits[0] clearly leads hits[1]; return all — injectMaxResults (capped at 2) bounds the final count downstream
  return hits;
}
