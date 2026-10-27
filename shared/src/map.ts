import type { NodeType } from './nodes';
import { GRID_SIZE, TOWNHALL_POS } from './rules';

// Zufall mit "Samen" (seed): Mit demselben seed kommt immer dieselbe Karte heraus.
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Verteilt Bäume und Felsen auf der Karte. Rund ums Rathaus bleibt Platz frei.
export function generateNodes(seed: number): { type: NodeType; x: number; y: number }[] {
  const rnd = seededRandom(seed);
  const nodes: { type: NodeType; x: number; y: number }[] = [];
  const mitte = (GRID_SIZE - 1) / 2;
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const nah = Math.max(Math.abs(x - TOWNHALL_POS.x), Math.abs(y - TOWNHALL_POS.y));
      if (nah <= 2) continue;
      // Am Rand wächst mehr Wald als in der Mitte
      const rand = Math.max(Math.abs(x - mitte), Math.abs(y - mitte)) / mitte; // 0 = Mitte, 1 = Rand
      const r = rnd();
      if (r < 0.1 + 0.28 * rand) nodes.push({ type: 'tree', x, y });
      else if (r < 0.15 + 0.3 * rand) nodes.push({ type: 'rock', x, y });
    }
  }
  return nodes;
}
