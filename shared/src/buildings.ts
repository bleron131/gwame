import type { Amounts } from './resources';

// Die Gebäude-Definitionen: Hier stehen alle Spielwerte.
// Ein neues Gebäude = ein neuer Eintrag hier + ein 3D-Modell im Client.
//
// - cost:        Baukosten (Level 0 -> 1). Jede Verbesserung kostet mehr (siehe rules.ts).
// - production:  Produktion pro Minute bei Level 1 (bei Level 2 doppelt so viel usw.)
// - population:  Einwohner pro Level
// - storage:     zusätzlicher Lagerplatz pro Level (für Holz und Stein)
// - unlockLevel: ab diesem Stadt-Level kann man es bauen
export interface BuildingDef {
  name: string;
  icon: string;
  description: string;
  category: 'zentrum' | 'produktion' | 'wohnen' | 'lager';
  cost: Amounts;
  production?: Amounts;
  population?: number;
  storage?: number;
  maxLevel: number;
  unlockLevel: number;
  buildable: boolean;
}

export const BUILDINGS = {
  townhall: {
    name: 'Rathaus',
    icon: '🏛️',
    description: 'Das Herz deiner Stadt. Bringt Gold und etwas Lagerplatz.',
    category: 'zentrum',
    cost: { gold: 500, wood: 250, stone: 200 }, // nur für Verbesserungen
    production: { gold: 10 },
    storage: 100,
    maxLevel: 5,
    unlockLevel: 1,
    buildable: false
  },
  lumberjack: {
    name: 'Holzfäller',
    icon: '🪓',
    description: 'Fällt Bäume und bringt dir regelmässig Holz.',
    category: 'produktion',
    cost: { gold: 50, wood: 10 },
    production: { wood: 12 },
    maxLevel: 10,
    unlockLevel: 1,
    buildable: true
  },
  house: {
    name: 'Wohnhaus',
    icon: '🏠',
    description: 'Hier wohnen Einwohner. Sie zahlen Steuern in Gold.',
    category: 'wohnen',
    cost: { gold: 80, wood: 40, stone: 5 },
    population: 6,
    maxLevel: 5,
    unlockLevel: 1,
    buildable: true
  },
  quarry: {
    name: 'Steinbruch',
    icon: '⛏️',
    description: 'Baut Stein ab – den brauchst du für bessere Gebäude.',
    category: 'produktion',
    cost: { gold: 120, wood: 60 },
    production: { stone: 8 },
    maxLevel: 10,
    unlockLevel: 2,
    buildable: true
  },
  warehouse: {
    name: 'Lagerhaus',
    icon: '🏚️',
    description: 'Mehr Platz für Holz und Stein.',
    category: 'lager',
    cost: { gold: 150, wood: 80, stone: 40 },
    storage: 250,
    maxLevel: 10,
    unlockLevel: 3,
    buildable: true
  }
} satisfies Record<string, BuildingDef>;

export type BuildingType = keyof typeof BUILDINGS;
export const BUILDING_TYPES = Object.keys(BUILDINGS) as BuildingType[];

export function isBuildingType(value: unknown): value is BuildingType {
  return typeof value === 'string' && value in BUILDINGS;
}

export function buildingDef(type: BuildingType): BuildingDef {
  return BUILDINGS[type];
}
