import { BUILDINGS, type BuildingType } from './buildings';
import { RESEARCH, type ResearchId } from './research';
import { RESOURCES, RESOURCE_IDS, emptyStock, type Amounts, type ResourceId, type Stock } from './resources';

// ===== Spielfeld =====
export const GRID_SIZE = 16;                 // die Stadt hat 16 x 16 Felder
export const TOWNHALL_POS = { x: 7, y: 7 };  // hier steht das Rathaus

// ===== Wirtschaft =====
export const BASE_STORAGE = 300;           // so viel passt ohne Lagerhaus hinein (pro Rohstoff, Gold unbegrenzt)
export const BASE_POPULATION = 5;          // diese Einwohner wohnen schon im Rathaus
export const TAX_PER_RESIDENT = 2;         // Gold pro Einwohner pro Minute
export const SATT_BONUS = 2;               // so viel Gold zahlt ein satter Einwohner zusätzlich
export const BROT_PRO_EINWOHNER = 0.1;     // so viel Brot isst ein Einwohner pro Minute
export const STRASSEN_BONUS = 0.5;         // +50 % für Gebäude, die per Strasse am Rathaus hängen
export const UPGRADE_FACTOR = 1.6;         // jede Verbesserung kostet 60 % mehr
export const DEMOLISH_REFUND = 0.5;        // beim Abreissen gibt es die Hälfte der Baukosten zurück
export const OFFLINE_LIMIT_SECONDS = 8 * 3600; // höchstens 8 Stunden werden nachgerechnet
export const HARVEST_COOLDOWN_MS = 300;    // so schnell kann der Bürgermeister zuschlagen

// ===== Erfahrung =====
export const XP = { build: 25, upgradePerLevel: 15, harvest: 2 };

export interface PlacedBuilding {
  id: number;
  type: BuildingType;
  x: number;
  y: number;
  level: number;
}

export function inGrid(x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE;
}

// Was kostet der Schritt von "level" auf "level + 1"? (level 0 = neu bauen)
export function upgradeCost(type: BuildingType, level: number): Amounts {
  const base = BUILDINGS[type].cost;
  const factor = Math.pow(UPGRADE_FACTOR, level === 0 ? 0 : level);
  const cost: Amounts = {};
  for (const r of RESOURCE_IDS) {
    const v = base[r];
    if (v) cost[r] = Math.ceil(v * factor);
  }
  return cost;
}

// Was fehlt noch, um "cost" zu bezahlen?
export function missing(stock: Stock, cost: Amounts): Amounts {
  const m: Amounts = {};
  for (const r of RESOURCE_IDS) {
    const need = cost[r] ?? 0;
    if (need > stock[r] + 1e-9) m[r] = Math.ceil(need - stock[r]);
  }
  return m;
}
export function canAfford(stock: Stock, cost: Amounts): boolean {
  return Object.keys(missing(stock, cost)).length === 0;
}
// "20 🪵 Holz, 5 🪨 Stein"
export function amountsText(a: Amounts): string {
  return RESOURCE_IDS.filter(r => a[r]).map(r => `${a[r]} ${RESOURCES[r].icon} ${RESOURCES[r].name}`).join(', ');
}

// Erfahrung, die man insgesamt für ein Level braucht
export function xpForLevel(level: number): number {
  return level <= 1 ? 0 : Math.round(80 * Math.pow(level - 1, 1.6));
}
export function levelForXp(xp: number): number {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  return level;
}

// ===== Strassen =====
const NACHBARN = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const key = (x: number, y: number) => `${x},${y}`;

// Welche Gebäude hängen über Strassen am Rathaus?
// Wir laufen vom Rathaus aus über alle Strassenfelder (Breitensuche).
// Ein Gebäude neben einer erreichten Strasse ist "verbunden".
export function verbundeneGebaeude(buildings: PlacedBuilding[]): Set<number> {
  const strassen = new Set(buildings.filter(b => b.type === 'road').map(b => key(b.x, b.y)));
  const erreicht = new Set<string>();
  const schlange: [number, number][] = [];
  for (const rathaus of buildings.filter(b => b.type === 'townhall')) {
    for (const [dx, dy] of NACHBARN) {
      const k = key(rathaus.x + dx, rathaus.y + dy);
      if (strassen.has(k) && !erreicht.has(k)) { erreicht.add(k); schlange.push([rathaus.x + dx, rathaus.y + dy]); }
    }
  }
  while (schlange.length) {
    const [x, y] = schlange.shift()!;
    for (const [dx, dy] of NACHBARN) {
      const k = key(x + dx, y + dy);
      if (strassen.has(k) && !erreicht.has(k)) { erreicht.add(k); schlange.push([x + dx, y + dy]); }
    }
  }
  const verbunden = new Set<number>();
  for (const b of buildings) {
    if (b.type === 'road') continue;
    if (b.type === 'townhall' || NACHBARN.some(([dx, dy]) => erreicht.has(key(b.x + dx, b.y + dy)))) verbunden.add(b.id);
  }
  return verbunden;
}

// ===== Werte der ganzen Stadt =====
// Ein Glied der Produktionskette: verbraucht "ein" und stellt "aus" her (pro Minute)
export interface Produzent {
  id: number;
  stufe: number;
  ein: Amounts;
  aus: Amounts;
}

export interface CityStats {
  ratesPerMinute: Stock;                         // so viel kommt pro Minute dazu (wenn alles läuft)
  capacity: Record<ResourceId, number | null>;   // Lagergrenze (null = unbegrenzt)
  population: number;
  produzenten: Produzent[];                      // in der Reihenfolge der Kette
  steuerProMinute: number;                       // Grund-Steuern
  sattBonusProMinute: number;                    // so viel zusätzlich, wenn alle Brot haben
  brotProMinute: number;                         // so viel Brot essen die Einwohner
  verbunden: number[];                           // IDs der Gebäude mit Strassen-Anschluss
}

function mal(a: Amounts | undefined, f: number): Amounts {
  const r: Amounts = {};
  if (a) for (const k of RESOURCE_IDS) if (a[k]) r[k] = a[k]! * f;
  return r;
}

export function cityStats(buildings: PlacedBuilding[], forschung: ResearchId[] = []): CityStats {
  const verbunden = verbundeneGebaeude(buildings);
  const effekte = forschung.map(id => RESEARCH[id].effekt);
  const strassenBonus = STRASSEN_BONUS + effekte.reduce((s, e) => s + (e.strasse ?? 0), 0);
  const lagerBonus = 1 + effekte.reduce((s, e) => s + (e.lager ?? 0), 0);
  const steuerSatz = TAX_PER_RESIDENT + effekte.reduce((s, e) => s + (e.steuer ?? 0), 0);

  const produzenten: Produzent[] = [];
  let population = BASE_POPULATION;
  let extraStorage = 0;
  for (const b of buildings) {
    const def = BUILDINGS[b.type];
    const angeschlossen = verbunden.has(b.id) && b.type !== 'townhall';
    if (def.production) {
      const forschungBonus = effekte.reduce((s, e) => s + (e.produktion?.[b.type] ?? 0), 0);
      const f = b.level * (1 + forschungBonus + (angeschlossen ? strassenBonus : 0));
      produzenten.push({ id: b.id, stufe: def.stufe ?? 0, ein: mal(def.consumes, f), aus: mal(def.production, f) });
    }
    if (def.population) population += Math.round(def.population * b.level * (angeschlossen ? 1 + strassenBonus : 1));
    // Beim Rathaus zählt der Lagerplatz erst ab Level 2
    if (def.storage) extraStorage += def.storage * (b.type === 'townhall' ? b.level - 1 : b.level);
  }
  produzenten.sort((a, b) => a.stufe - b.stufe); // erst Rohstoffe, dann Verarbeitung

  const steuerProMinute = population * steuerSatz;
  const brotProMinute = population * BROT_PRO_EINWOHNER;
  const rates = emptyStock();
  for (const p of produzenten) {
    for (const r of RESOURCE_IDS) rates[r] += (p.aus[r] ?? 0) - (p.ein[r] ?? 0);
  }
  rates.gold += steuerProMinute;
  rates.bread -= brotProMinute;

  const capacity = {} as Record<ResourceId, number | null>;
  for (const r of RESOURCE_IDS) capacity[r] = r === 'gold' ? null : Math.round((BASE_STORAGE + extraStorage) * lagerBonus);
  return {
    ratesPerMinute: rates, capacity, population, produzenten,
    steuerProMinute, sattBonusProMinute: population * SATT_BONUS, brotProMinute, verbunden: [...verbunden]
  };
}
