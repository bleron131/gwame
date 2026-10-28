import type { Amounts } from './resources';

// Die Gebäude-Definitionen: Hier stehen alle Spielwerte.
// Ein neues Gebäude = ein neuer Eintrag hier + ein 3D-Bauplan im Client.
//
// - cost:        Baukosten (Level 0 -> 1). Jede Verbesserung kostet mehr (siehe rules.ts).
// - production:  was es pro Minute herstellt (bei Level 1; Level 2 = doppelt so viel …)
// - consumes:    was es dafür pro Minute verbraucht (Produktionskette!)
// - stufe:       Reihenfolge in der Kette: erst Rohstoffe (0), dann Verarbeitung (1, 2)
// - population:  Einwohner pro Level
// - storage:     zusätzlicher Lagerplatz pro Level (für alles ausser Gold)
// - unlockLevel: ab diesem Stadt-Level kann man es bauen
// - xp:          Erfahrung fürs Bauen (sonst XP.build)
export interface BuildingDef {
  name: string;
  icon: string;
  description: string;
  category: 'zentrum' | 'produktion' | 'wohnen' | 'lager' | 'weg';
  cost: Amounts;
  production?: Amounts;
  consumes?: Amounts;
  stufe?: number;
  population?: number;
  storage?: number;
  maxLevel: number;
  unlockLevel: number;
  buildable: boolean;
  xp?: number;
}

export type BuildingType =
  'townhall' | 'road' | 'lumberjack' | 'house' | 'quarry' | 'farm' | 'sawmill' | 'windmill' | 'warehouse' | 'bakery';

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  townhall: {
    name: 'Rathaus', icon: '🏛️', category: 'zentrum',
    description: 'Das Herz deiner Stadt. Bringt Gold und etwas Lagerplatz.',
    cost: { gold: 400, wood: 150, stone: 100 }, // nur für Verbesserungen
    production: { gold: 10 }, stufe: 0, storage: 100, maxLevel: 5, unlockLevel: 1, buildable: false
  },
  road: {
    name: 'Strasse', icon: '🛣️', category: 'weg',
    description: 'Verbinde Gebäude mit dem Rathaus: Sie arbeiten dann 50 % mehr. Auf Strassen läuft man schneller.',
    cost: { gold: 5, stone: 2 }, maxLevel: 1, unlockLevel: 1, buildable: true, xp: 2
  },
  lumberjack: {
    name: 'Holzfäller', icon: '🪓', category: 'produktion',
    description: 'Fällt Bäume und bringt dir regelmässig Holz.',
    cost: { gold: 50, wood: 10 }, production: { wood: 12 }, stufe: 0, maxLevel: 10, unlockLevel: 1, buildable: true
  },
  house: {
    name: 'Wohnhaus', icon: '🏠', category: 'wohnen',
    description: 'Hier wohnen Einwohner. Sie zahlen Steuern – und satte Einwohner doppelt.',
    cost: { gold: 80, wood: 40, stone: 5 }, population: 6, maxLevel: 5, unlockLevel: 1, buildable: true
  },
  quarry: {
    name: 'Steinbruch', icon: '⛏️', category: 'produktion',
    description: 'Baut Stein ab – den brauchst du für bessere Gebäude.',
    cost: { gold: 120, wood: 60 }, production: { stone: 8 }, stufe: 0, maxLevel: 10, unlockLevel: 2, buildable: true
  },
  farm: {
    name: 'Bauernhof', icon: '🌾', category: 'produktion',
    description: 'Baut Getreide an. Daraus macht die Windmühle Mehl.',
    cost: { gold: 100, wood: 50 }, production: { grain: 10 }, stufe: 0, maxLevel: 10, unlockLevel: 2, buildable: true
  },
  sawmill: {
    name: 'Sägewerk', icon: '🪚', category: 'produktion',
    description: 'Sägt aus Holz Bretter – für Bäckerei, Forschung und mehr.',
    cost: { gold: 180, wood: 60, stone: 30 }, consumes: { wood: 12 }, production: { planks: 6 }, stufe: 1,
    maxLevel: 10, unlockLevel: 3, buildable: true
  },
  windmill: {
    name: 'Windmühle', icon: '🌬️', category: 'produktion',
    description: 'Mahlt Getreide zu Mehl.',
    cost: { gold: 200, wood: 80, stone: 40 }, consumes: { grain: 10 }, production: { flour: 6 }, stufe: 1,
    maxLevel: 10, unlockLevel: 3, buildable: true
  },
  warehouse: {
    name: 'Lagerhaus', icon: '🏚️', category: 'lager',
    description: 'Mehr Platz für alle Rohstoffe.',
    cost: { gold: 150, wood: 80, stone: 40 }, storage: 250, maxLevel: 10, unlockLevel: 3, buildable: true
  },
  bakery: {
    name: 'Bäckerei', icon: '🥖', category: 'produktion',
    description: 'Backt aus Mehl Brot. Einwohner mit Brot zahlen doppelt Steuern.',
    cost: { gold: 300, stone: 60, planks: 40 }, consumes: { flour: 6 }, production: { bread: 8 }, stufe: 2,
    maxLevel: 10, unlockLevel: 4, buildable: true
  }
};

export const BUILDING_TYPES = Object.keys(BUILDINGS) as BuildingType[];

export function isBuildingType(value: unknown): value is BuildingType {
  return typeof value === 'string' && value in BUILDINGS;
}

export function buildingDef(type: BuildingType): BuildingDef {
  return BUILDINGS[type];
}
