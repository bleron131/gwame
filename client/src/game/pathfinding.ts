import { GRID_SIZE } from '@empire/shared';
import { feldSchluessel } from './coords';

type Feld = { x: number; y: number };

// Breitensuche: findet den kürzesten Weg über freie Felder.
// Die Einwohner laufen so um Häuser und Bäume herum statt hindurch.
// Ein Ring von einem Feld um die Stadt herum ist auch begehbar.
export function wegFinden(belegt: Set<string>, start: Feld, ziel: Feld): Feld[] | null {
  const ok = (x: number, y: number) => x >= -1 && y >= -1 && x <= GRID_SIZE && y <= GRID_SIZE && !belegt.has(feldSchluessel(x, y));
  const startKey = feldSchluessel(start.x, start.y), zielKey = feldSchluessel(ziel.x, ziel.y);
  const vorher = new Map<string, string | null>([[startKey, null]]);
  const warteschlange: Feld[] = [start];
  while (warteschlange.length) {
    const f = warteschlange.shift()!;
    const key = feldSchluessel(f.x, f.y);
    if (key === zielKey) {
      const weg: Feld[] = [];
      let k: string | null = key;
      while (k) { const [x, y] = k.split(',').map(Number); weg.unshift({ x, y }); k = vorher.get(k) ?? null; }
      return weg;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = f.x + dx, ny = f.y + dy, nk = feldSchluessel(nx, ny);
      if (!vorher.has(nk) && (ok(nx, ny) || nk === zielKey)) { vorher.set(nk, key); warteschlange.push({ x: nx, y: ny }); }
    }
  }
  return null;
}
