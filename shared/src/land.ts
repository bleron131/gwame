import { BUILDINGS, type BuildingType } from './buildings';
import type { Amounts } from './resources';

// ===== Land =====
// Die Welt ist in "Parzellen" von 8 x 8 Feldern aufgeteilt.
// Am Anfang gehören dir die 4 Parzellen in der Mitte (16 x 16 Felder).
// Rundherum kannst du Land dazukaufen. Rechts daneben liegt das Industrie-Gebiet:
// Du siehst es von Anfang an, aber es ist gesperrt, bis deine Stadt gross genug ist.
export const PARZELLE = 8;

export type Gebiet = 'stadt' | 'industrie';
export interface Parzelle { px: number; py: number }

export const START_PARZELLEN: Parzelle[] = [{ px: 0, py: 0 }, { px: 1, py: 0 }, { px: 0, py: 1 }, { px: 1, py: 1 }];

// Welche Parzellen gibt es überhaupt?
const STADT_P = { minX: -1, maxX: 2, minY: -1, maxY: 2 };       // 4 x 4 Parzellen Stadt
const INDUSTRIE_P = { minX: 3, maxX: 4, minY: 0, maxY: 1 };     // 2 x 2 Parzellen Industrie, rechts daneben

export function gebietVon(px: number, py: number): Gebiet | null {
  if (px >= STADT_P.minX && px <= STADT_P.maxX && py >= STADT_P.minY && py <= STADT_P.maxY) return 'stadt';
  if (px >= INDUSTRIE_P.minX && px <= INDUSTRIE_P.maxX && py >= INDUSTRIE_P.minY && py <= INDUSTRIE_P.maxY) return 'industrie';
  return null;
}

export function alleParzellen(): (Parzelle & { gebiet: Gebiet })[] {
  const l: (Parzelle & { gebiet: Gebiet })[] = [];
  for (let py = STADT_P.minY; py <= STADT_P.maxY; py++) for (let px = STADT_P.minX; px <= INDUSTRIE_P.maxX; px++) {
    const gebiet = gebietVon(px, py);
    if (gebiet) l.push({ px, py, gebiet });
  }
  return l;
}

export const INDUSTRIE_PARZELLEN = alleParzellen().filter(p => p.gebiet === 'industrie');

// Die ganze Welt in Feldern (für Laufen, Wegsuche und Boden)
export const WELT = {
  minX: STADT_P.minX * PARZELLE, maxX: (INDUSTRIE_P.maxX + 1) * PARZELLE - 1,
  minY: STADT_P.minY * PARZELLE, maxY: (STADT_P.maxY + 1) * PARZELLE - 1
};

export const parzelleVon = (x: number, y: number): Parzelle => ({ px: Math.floor(x / PARZELLE), py: Math.floor(y / PARZELLE) });
export const parzellenSchluessel = (p: Parzelle) => `${p.px},${p.py}`;

// Gehört dieses Feld dir? Und in welchem Gebiet liegt es?
export function feldGebiet(x: number, y: number, besitz: Set<string>): Gebiet | null {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  const p = parzelleVon(x, y);
  return besitz.has(parzellenSchluessel(p)) ? gebietVon(p.px, p.py) : null;
}

// Kann man diese Stadt-Parzelle kaufen? (sie muss an dein Land grenzen)
export function kaufbar(p: Parzelle, besitz: Set<string>): boolean {
  if (gebietVon(p.px, p.py) !== 'stadt' || besitz.has(parzellenSchluessel(p))) return false;
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => besitz.has(parzellenSchluessel({ px: p.px + dx, py: p.py + dy })));
}

export const LAND_AB_LEVEL = 2;

// Jede weitere Parzelle kostet mehr. "gekauft" = wie viele du schon dazugekauft hast.
export function landPreis(gekauft: number): Amounts {
  return {
    gold: Math.ceil(400 * Math.pow(1.6, gekauft)),
    wood: Math.ceil(80 * Math.pow(1.4, gekauft)),
    stone: Math.ceil(40 * Math.pow(1.4, gekauft))
  };
}

// ===== Industrie freischalten =====
// Man muss weit genug sein: ein Level, genug Einwohner und eine funktionierende Stadt
export const INDUSTRIE = {
  level: 6,
  einwohner: 60,
  gebaeude: ['sawmill', 'bakery'] as const,
  preis: { gold: 3000, stone: 250, planks: 150 } as Amounts
};

// Was fehlt noch für die Industrie? (leere Liste = alles erfüllt)
export function industrieFehlt(level: number, einwohner: number, gebaut: BuildingType[]): string[] {
  const fehlt: string[] = [];
  if (level < INDUSTRIE.level) fehlt.push(`Level ${INDUSTRIE.level} (du hast ${level})`);
  if (einwohner < INDUSTRIE.einwohner) fehlt.push(`${INDUSTRIE.einwohner} Einwohner (du hast ${einwohner})`);
  for (const t of INDUSTRIE.gebaeude) if (!gebaut.includes(t)) fehlt.push(`${BUILDINGS[t].icon} ${BUILDINGS[t].name}`);
  return fehlt;
}
