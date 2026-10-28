import type { NodeType } from './nodes';
import { PARZELLE, type Parzelle } from './land';
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

// Bäume und Felsen für eine neu gekaufte Parzelle (am Rand dichter Wald)
export function parzellenNodes(seed: number, p: Parzelle): { type: NodeType; x: number; y: number }[] {
  const rnd = seededRandom(seed + p.px * 7919 + p.py * 104729);
  const nodes: { type: NodeType; x: number; y: number }[] = [];
  for (let y = p.py * PARZELLE; y < (p.py + 1) * PARZELLE; y++) {
    for (let x = p.px * PARZELLE; x < (p.px + 1) * PARZELLE; x++) {
      const r = rnd();
      if (r < 0.22) nodes.push({ type: 'tree', x, y });
      else if (r < 0.29) nodes.push({ type: 'rock', x, y });
    }
  }
  return nodes;
}

// Wo darf ein neuer Baum wachsen? Ein zufälliges freies Feld – am liebsten weit weg vom Rathaus,
// damit die Bäume nicht mitten in der Stadt im Weg stehen.
export function nachwachsPlatz(freie: { x: number; y: number }[], zufall: () => number): { x: number; y: number } | null {
  if (!freie.length) return null;
  let bester: { x: number; y: number } | null = null, weit = -1;
  for (let k = 0; k < 5; k++) {
    const f = freie[Math.floor(zufall() * freie.length)];
    const d = Math.max(Math.abs(f.x - TOWNHALL_POS.x), Math.abs(f.y - TOWNHALL_POS.y));
    if (d > weit) { weit = d; bester = f; }
  }
  return bester;
}
