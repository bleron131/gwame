import { RESOURCE_IDS, type Amounts, type Stock } from './resources';
import type { CityStats } from './rules';

// Rechnet aus, wie viel nach "seconds" Sekunden im Lager ist.
// Produktion = Rate pro Sekunde x vergangene Sekunden – aber nie über die Lagergrenze.
// Diese Funktion benutzt der Server (die echte Rechnung) und der Browser
// (damit die Zahlen oben flüssig hochzählen).
export function produce(stock: Stock, stats: CityStats, seconds: number): Stock {
  const out = { ...stock };
  const s = Math.max(0, seconds);
  for (const r of RESOURCE_IDS) {
    const now = stock[r] ?? 0;
    const perSecond = (stats.ratesPerMinute[r] ?? 0) / 60;
    let next = now + perSecond * s;
    const cap = stats.capacity[r];
    if (cap !== null) {
      // Wenn schon mehr drin ist als erlaubt (z. B. Lagerhaus abgerissen), bleibt es so – kommt nur nichts dazu
      next = now >= cap ? now : Math.min(cap, next);
    }
    out[r] = Math.max(0, next);
  }
  return out;
}

// Unterschied zwischen zwei Vorräten (nur was dazugekommen ist, gerundet)
export function gainedBetween(before: Stock, after: Stock): Amounts {
  const g: Amounts = {};
  for (const r of RESOURCE_IDS) {
    const d = Math.floor(after[r] - before[r]);
    if (d > 0) g[r] = d;
  }
  return g;
}
