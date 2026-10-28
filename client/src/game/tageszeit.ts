// Tag und Nacht: Ein Tag im Spiel dauert 12 echte Minuten.
// Um 6 Uhr geht die Sonne auf, um 20 Uhr unter. Nachts leuchten die Fenster.
export const TAG_DAUER_MS = 12 * 60 * 1000;

export interface Tageszeit {
  stunde: number;   // 0–24 (Kommazahl)
  hell: number;     // 0 = tiefe Nacht, 1 = heller Mittag
  abend: number;    // 0–1: wie stark das orange Abend-/Morgenlicht ist
}

const glatt = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Zum Ausprobieren: ?uhr=22 in der Adresse hält die Uhr auf 22 Uhr fest
const FEST = (() => {
  try { const u = new URLSearchParams(globalThis.location?.search ?? '').get('uhr'); return u === null ? null : Number(u); } catch { return null; }
})();

export function tageszeit(ms = Date.now()): Tageszeit {
  const phase = (ms % TAG_DAUER_MS) / TAG_DAUER_MS;
  const stunde = FEST !== null && !Number.isNaN(FEST) ? FEST % 24 : (8 + phase * 24) % 24;
  // Morgens zwischen 5 und 7 Uhr wird es hell, abends zwischen 19 und 21 Uhr dunkel
  const hell = stunde < 12 ? glatt(5, 7.5, stunde) : 1 - glatt(18.5, 21, stunde);
  const abend = Math.max(1 - Math.abs(stunde - 6.3) / 1.6, 1 - Math.abs(stunde - 19.7) / 1.6, 0);
  return { stunde, hell, abend };
}

export function uhrText(stunde: number): string {
  const h = Math.floor(stunde), m = Math.floor((stunde - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(Math.floor(m / 10) * 10).padStart(2, '0')}`;
}
