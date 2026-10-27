import { BUILDINGS, type BuildingType } from './buildings';
import { RESOURCES, RESOURCE_IDS, emptyStock, type Amounts, type ResourceId, type Stock } from './resources';

// ===== Spielfeld =====
export const GRID_SIZE = 16;                 // die Stadt hat 16 x 16 Felder
export const TOWNHALL_POS = { x: 7, y: 7 };  // hier steht das Rathaus

// ===== Wirtschaft =====
export const BASE_STORAGE = 300;           // so viel Holz/Stein passt ohne Lagerhaus hinein
export const BASE_POPULATION = 5;          // diese Einwohner wohnen schon im Rathaus
export const TAX_PER_RESIDENT = 2;         // Gold pro Einwohner pro Minute
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
  const base = BUILDINGS[type].cost as Amounts;
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

// ===== Werte der ganzen Stadt =====
export interface CityStats {
  ratesPerMinute: Stock;                         // Produktion pro Minute
  capacity: Record<ResourceId, number | null>;   // Lagergrenze (null = unbegrenzt)
  population: number;
}

export function cityStats(buildings: PlacedBuilding[]): CityStats {
  const rates = emptyStock();
  let population = BASE_POPULATION;
  let extraStorage = 0;
  for (const b of buildings) {
    const def = BUILDINGS[b.type];
    if ('production' in def && def.production) {
      for (const r of RESOURCE_IDS) rates[r] += ((def.production as Amounts)[r] ?? 0) * b.level;
    }
    if ('population' in def && def.population) population += def.population * b.level;
    if ('storage' in def && def.storage) {
      // Beim Rathaus zählt der Lagerplatz erst ab Level 2
      extraStorage += def.storage * (b.type === 'townhall' ? b.level - 1 : b.level);
    }
  }
  rates.gold += population * TAX_PER_RESIDENT; // Steuern
  const capacity = {} as Record<ResourceId, number | null>;
  for (const r of RESOURCE_IDS) capacity[r] = r === 'gold' ? null : BASE_STORAGE + extraStorage;
  return { ratesPerMinute: rates, capacity, population };
}
