import { WELT } from '@empire/shared';
import { feldSchluessel } from './coords';

type Feld = { x: number; y: number };

// Der Weg für den Lieferwagen: vom Rand der Welt bis zum Ziel.
// Strassen sind "billig" (1), Wiese ist "teuer" (6), Häuser und Bäume gehen gar nicht.
// So fährt der Wagen so viel wie möglich auf deinen Strassen (Dijkstra-Suche).
export function strassenWeg(blockiert: Set<string>, strassen: Set<string>, ziel: Feld): Feld[] {
  const minX = WELT.minX - 1, maxX = WELT.maxX + 1, minY = WELT.minY - 1, maxY = WELT.maxY + 1;
  const breite = maxX - minX + 1;
  const index = (x: number, y: number) => (y - minY) * breite + (x - minX);
  const n = breite * (maxY - minY + 1);
  const kosten = new Float64Array(n).fill(Infinity);
  const vorher = new Int32Array(n).fill(-1);
  const offen = new Heap();
  // Start: alle Felder ganz am Rand (dort kommt der Wagen in die Welt)
  for (let x = minX; x <= maxX; x++) for (const y of [minY, maxY]) { kosten[index(x, y)] = 0; offen.rein(index(x, y), 0); }
  for (let y = minY; y <= maxY; y++) for (const x of [minX, maxX]) { kosten[index(x, y)] = 0; offen.rein(index(x, y), 0); }
  const zielI = index(ziel.x, ziel.y);
  const fertig = new Uint8Array(n);
  while (offen.groesse) {
    const i = offen.raus(); // das günstigste offene Feld
    if (fertig[i]) continue;
    fertig[i] = 1;
    if (i === zielI) break;
    const x = (i % breite) + minX, y = Math.floor(i / breite) + minY;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
      const key = feldSchluessel(nx, ny), j = index(nx, ny);
      if (blockiert.has(key) && j !== zielI) continue;
      const k = kosten[i] + (strassen.has(key) ? 1 : 6);
      if (k < kosten[j]) { kosten[j] = k; vorher[j] = i; offen.rein(j, k); }
    }
  }
  const weg: Feld[] = [];
  for (let i = zielI; i !== -1; i = vorher[i]) weg.unshift({ x: (i % breite) + minX, y: Math.floor(i / breite) + minY });
  return weg.length > 1 ? weg : [{ x: ziel.x, y: maxY }, ziel];
}

// Ein kleiner "Heap": gibt immer das Feld mit den kleinsten Kosten zuerst heraus.
// Die Kosten werden beim Hineinlegen gemerkt (alte Einträge werden später einfach übersprungen).
class Heap {
  private d: [number, number][] = []; // [Kosten, Feld]
  get groesse() { return this.d.length; }
  rein(i: number, k: number) {
    const d = this.d; d.push([k, i]);
    let n = d.length - 1;
    while (n > 0) {
      const o = (n - 1) >> 1;
      if (d[o][0] <= d[n][0]) break;
      [d[o], d[n]] = [d[n], d[o]]; n = o;
    }
  }
  raus(): number {
    const d = this.d, oben = d[0], letzter = d.pop()!;
    if (d.length) {
      d[0] = letzter;
      let n = 0;
      for (;;) {
        const l = 2 * n + 1, r = l + 1;
        let m = n;
        if (l < d.length && d[l][0] < d[m][0]) m = l;
        if (r < d.length && d[r][0] < d[m][0]) m = r;
        if (m === n) break;
        [d[m], d[n]] = [d[n], d[m]]; n = m;
      }
    }
    return oben[1];
  }
}
