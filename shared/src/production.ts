import { RESOURCE_IDS, type Amounts, type Stock } from './resources';
import type { CityStats } from './rules';

// Rechnet aus, wie viel nach "seconds" Sekunden im Lager ist.
//
// Weil es Produktionsketten gibt (Getreide -> Mehl -> Brot), rechnen wir in kleinen
// Zeitschritten von höchstens 10 Sekunden. In jedem Schritt arbeiten die Gebäude der
// Reihe nach (erst Rohstoffe, dann Verarbeitung). Ein Gebäude arbeitet nur so viel,
// wie es Zutaten hat – und nur so viel, wie ins Lager passt (dann verbraucht es auch nichts).
//
// Diese Funktion benutzt der Server (die echte Rechnung) und der Browser
// (damit die Zahlen oben flüssig hochzählen).
export function produce(stock: Stock, stats: CityStats, seconds: number): Stock {
  const s = { ...stock };
  let rest = Math.max(0, seconds);
  while (rest > 1e-9) {
    const dt = Math.min(10, rest);
    rest -= dt;
    const min = dt / 60; // Minuten in diesem Schritt
    for (const p of stats.produzenten) {
      let anteil = 1;
      for (const r of RESOURCE_IDS) {
        const braucht = (p.ein[r] ?? 0) * min;
        if (braucht > 0) anteil = Math.min(anteil, s[r] / braucht);
      }
      for (const r of RESOURCE_IDS) {
        const macht = (p.aus[r] ?? 0) * min;
        const cap = stats.capacity[r];
        if (macht > 0 && cap !== null) anteil = Math.min(anteil, Math.max(0, cap - s[r]) / macht);
      }
      anteil = Math.max(0, Math.min(1, anteil));
      if (anteil === 0) continue;
      for (const r of RESOURCE_IDS) {
        s[r] = Math.max(0, s[r] - (p.ein[r] ?? 0) * min * anteil) + (p.aus[r] ?? 0) * min * anteil;
      }
    }
    // Steuern, und Bonus von den Einwohnern, die Brot bekommen haben
    const brotBedarf = stats.brotProMinute * min;
    const gegessen = Math.min(brotBedarf, s.bread);
    s.bread -= gegessen;
    const satt = brotBedarf > 0 ? gegessen / brotBedarf : 0;
    s.gold += (stats.steuerProMinute + stats.sattBonusProMinute * satt) * min;
  }
  for (const r of RESOURCE_IDS) if (s[r] < 1e-9) s[r] = 0;
  return s;
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
