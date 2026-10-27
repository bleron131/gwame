// Alle Rohstoffe im Spiel.
// Einen neuen Rohstoff fügst du einfach hier hinzu – die Datenbank
// speichert jeden Rohstoff als eigene Zeile, sie muss nicht geändert werden.
export const RESOURCES = {
  gold: { name: 'Gold', icon: '🪙' },
  wood: { name: 'Holz', icon: '🪵' },
  stone: { name: 'Stein', icon: '🪨' }
} as const;

export type ResourceId = keyof typeof RESOURCES;
export const RESOURCE_IDS = Object.keys(RESOURCES) as ResourceId[];

// "Stock" = der komplette Vorrat (jeder Rohstoff hat einen Wert)
export type Stock = Record<ResourceId, number>;
// "Amounts" = eine Menge, bei der nicht jeder Rohstoff vorkommen muss (z. B. Kosten)
export type Amounts = Partial<Record<ResourceId, number>>;

// Damit startet eine neue Stadt
export const START_RESOURCES: Stock = { gold: 300, wood: 60, stone: 20 };

export function emptyStock(): Stock {
  const s = {} as Stock;
  for (const r of RESOURCE_IDS) s[r] = 0;
  return s;
}
