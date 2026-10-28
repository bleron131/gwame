import type { Amounts } from './resources';

// Die Gebäude-Definitionen: Hier stehen alle Spielwerte.
// Ein neues Gebäude = ein neuer Eintrag hier + ein 3D-Bauplan im Client.
//
// - cost:        Baukosten (Level 0 -> 1). Jede Verbesserung kostet mehr (siehe rules.ts).
// - production:  was es pro Minute herstellt (bei Level 1; Level 2 = doppelt so viel …)
// - consumes:    was es dafür pro Minute verbraucht (Produktionskette!)
// - stufe:       Reihenfolge in der Kette: erst Rohstoffe (0), dann Verarbeitung (1, 2, 3)
// - population:  Einwohner pro Level (oder genau: einwohnerProLevel)
// - storage:     zusätzlicher Lagerplatz pro Level (für alles ausser Gold)
// - unlockLevel: ab diesem Stadt-Level kann man es bauen
// - xp:          Erfahrung fürs Bauen (sonst XP.build)
// - bauzeit:     so viele Sekunden dauert der Bau von Level 1 (jedes Level etwas länger)
// - gebiet:      wo man es bauen darf: in der Stadt, in der Industrie oder überall
// - arbeitsplaetze: so viele Arbeiter kann man hier anstellen (jeder bringt +25 %)
// - ausbau:      neue Namen und Zusatzkosten ab einem Level (Wohnhaus → Mehrfamilienhaus → Wohnblock)
export interface Ausbaustufe {
  ab: number;          // ab diesem Level
  name: string;
  icon: string;
  extra?: Amounts;     // diese Kosten kommen bei jeder Verbesserung dazu
}

export interface BuildingDef {
  name: string;
  icon: string;
  description: string;
  category: 'zentrum' | 'produktion' | 'wohnen' | 'lager' | 'weg' | 'freizeit' | 'industrie';
  cost: Amounts;
  production?: Amounts;
  consumes?: Amounts;
  stufe?: number;
  population?: number;
  einwohnerProLevel?: number[];
  storage?: number;
  maxLevel: number;
  unlockLevel: number;
  buildable: boolean;
  xp?: number;
  bauzeit: number;
  gebiet: 'stadt' | 'industrie' | 'ueberall';
  arbeitsplaetze?: number;
  ausbau?: Ausbaustufe[];
}

export type BuildingType =
  | 'townhall' | 'road' | 'lumberjack' | 'house' | 'quarry' | 'farm' | 'sawmill' | 'windmill' | 'warehouse' | 'bakery' | 'casino'
  | 'mine' | 'steelworks' | 'factory' | 'furnitureworks' | 'company';

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  townhall: {
    name: 'Rathaus', icon: '🏛️', category: 'zentrum',
    description: 'Das Herz deiner Stadt. Bringt Gold und etwas Lagerplatz.',
    cost: { gold: 400, wood: 150, stone: 100 }, // nur für Verbesserungen
    production: { gold: 10 }, stufe: 0, storage: 100, maxLevel: 5, unlockLevel: 1, buildable: false,
    bauzeit: 20, gebiet: 'stadt'
  },
  road: {
    name: 'Strasse', icon: '🛣️', category: 'weg',
    description: 'Verbinde Gebäude mit dem Rathaus: Sie arbeiten dann 50 % mehr. Auf Strassen läuft man schneller.',
    cost: { gold: 5, stone: 2 }, maxLevel: 1, unlockLevel: 1, buildable: true, xp: 2, bauzeit: 0, gebiet: 'ueberall'
  },
  lumberjack: {
    name: 'Holzfäller', icon: '🪓', category: 'produktion',
    description: 'Fällt Bäume und bringt dir regelmässig Holz.',
    cost: { gold: 50, wood: 10 }, production: { wood: 12 }, stufe: 0, maxLevel: 10, unlockLevel: 1, buildable: true,
    bauzeit: 6, gebiet: 'stadt', arbeitsplaetze: 3
  },
  house: {
    name: 'Wohnhaus', icon: '🏠', category: 'wohnen',
    description: 'Hier wohnen Einwohner. Sie zahlen Steuern – und satte Einwohner doppelt. Wird zum Mehrfamilienhaus und zum Wohnblock!',
    cost: { gold: 80, wood: 40, stone: 5 }, population: 6,
    einwohnerProLevel: [6, 12, 18, 26, 40, 54, 70, 95, 120, 150],
    maxLevel: 10, unlockLevel: 1, buildable: true, bauzeit: 8, gebiet: 'stadt',
    ausbau: [
      { ab: 1, name: 'Wohnhaus', icon: '🏠' },
      { ab: 5, name: 'Mehrfamilienhaus', icon: '🏘️', extra: { planks: 30 } },
      { ab: 8, name: 'Wohnblock', icon: '🏢', extra: { planks: 60, machines: 8 } }
    ]
  },
  quarry: {
    name: 'Steinbruch', icon: '⛏️', category: 'produktion',
    description: 'Baut Stein ab – den brauchst du für bessere Gebäude.',
    cost: { gold: 120, wood: 60 }, production: { stone: 8 }, stufe: 0, maxLevel: 10, unlockLevel: 2, buildable: true,
    bauzeit: 12, gebiet: 'stadt', arbeitsplaetze: 3
  },
  farm: {
    name: 'Bauernhof', icon: '🌾', category: 'produktion',
    description: 'Baut Getreide an. Daraus macht die Windmühle Mehl.',
    cost: { gold: 100, wood: 50 }, production: { grain: 10 }, stufe: 0, maxLevel: 10, unlockLevel: 2, buildable: true,
    bauzeit: 10, gebiet: 'stadt', arbeitsplaetze: 3
  },
  sawmill: {
    name: 'Sägewerk', icon: '🪚', category: 'produktion',
    description: 'Sägt aus Holz Bretter – für Häuser, Bäckerei, Forschung und mehr.',
    cost: { gold: 180, wood: 60, stone: 30 }, consumes: { wood: 12 }, production: { planks: 6 }, stufe: 1,
    maxLevel: 10, unlockLevel: 3, buildable: true, bauzeit: 20, gebiet: 'stadt', arbeitsplaetze: 3
  },
  windmill: {
    name: 'Windmühle', icon: '🌬️', category: 'produktion',
    description: 'Mahlt Getreide zu Mehl.',
    cost: { gold: 200, wood: 80, stone: 40 }, consumes: { grain: 10 }, production: { flour: 6 }, stufe: 1,
    maxLevel: 10, unlockLevel: 3, buildable: true, bauzeit: 25, gebiet: 'stadt', arbeitsplaetze: 3
  },
  warehouse: {
    name: 'Lagerhaus', icon: '🏚️', category: 'lager',
    description: 'Mehr Platz für alle Rohstoffe.',
    cost: { gold: 150, wood: 80, stone: 40 }, storage: 250, maxLevel: 10, unlockLevel: 3, buildable: true,
    bauzeit: 15, gebiet: 'ueberall'
  },
  bakery: {
    name: 'Bäckerei', icon: '🥖', category: 'produktion',
    description: 'Backt aus Mehl Brot. Einwohner mit Brot zahlen doppelt Steuern.',
    cost: { gold: 300, stone: 60, planks: 40 }, consumes: { flour: 6 }, production: { bread: 8 }, stufe: 2,
    maxLevel: 10, unlockLevel: 4, buildable: true, bauzeit: 30, gebiet: 'stadt', arbeitsplaetze: 3
  },
  casino: {
    name: 'Spielhalle', icon: '🃏', category: 'freizeit',
    description: 'Hier spielst du Blackjack gegen die Bank – mit Gold oder Rohstoffen. Höheres Level = höhere Einsätze.',
    cost: { gold: 250, wood: 80, stone: 30 }, maxLevel: 5, unlockLevel: 2, buildable: true, bauzeit: 20, gebiet: 'stadt'
  },

  // ===== Industrie (nur im Industrie-Gebiet) =====
  mine: {
    name: 'Erzmine', icon: '⛰️', category: 'industrie',
    description: 'Fördert Erz aus dem Berg. Daraus macht das Stahlwerk Stahl.',
    cost: { gold: 600, wood: 150, stone: 150 }, production: { ore: 10 }, stufe: 0, maxLevel: 10, unlockLevel: 6,
    buildable: true, bauzeit: 40, gebiet: 'industrie', arbeitsplaetze: 3, xp: 60
  },
  steelworks: {
    name: 'Stahlwerk', icon: '🏭', category: 'industrie',
    description: 'Schmilzt Erz mit Holz zu Stahl.',
    cost: { gold: 900, stone: 250, planks: 80 }, consumes: { ore: 10, wood: 6 }, production: { steel: 5 }, stufe: 1,
    maxLevel: 10, unlockLevel: 6, buildable: true, bauzeit: 60, gebiet: 'industrie', arbeitsplaetze: 3, xp: 80
  },
  factory: {
    name: 'Maschinenfabrik', icon: '⚙️', category: 'industrie',
    description: 'Baut aus Stahl und Brettern Maschinen – für Wohnblöcke und Firmen.',
    cost: { gold: 1500, stone: 300, steel: 40 }, consumes: { steel: 4, planks: 4 }, production: { machines: 2 }, stufe: 2,
    maxLevel: 10, unlockLevel: 7, buildable: true, bauzeit: 90, gebiet: 'industrie', arbeitsplaetze: 3, xp: 100
  },
  furnitureworks: {
    name: 'Möbelfirma', icon: '🪑', category: 'industrie',
    description: 'Eine Firma, die aus Brettern Möbel macht.',
    cost: { gold: 800, planks: 120, steel: 20 }, consumes: { planks: 8 }, production: { furniture: 4 }, stufe: 2,
    maxLevel: 10, unlockLevel: 7, buildable: true, bauzeit: 60, gebiet: 'industrie', arbeitsplaetze: 3, xp: 80
  },
  company: {
    name: 'Handelsfirma', icon: '🏢', category: 'industrie',
    description: 'Deine eigene Firma: verkauft Möbel und Maschinen in die ganze Welt – das bringt viel Gold.',
    cost: { gold: 2500, planks: 150, steel: 60, machines: 5 }, consumes: { furniture: 2, machines: 1 }, production: { gold: 150 }, stufe: 3,
    maxLevel: 10, unlockLevel: 8, buildable: true, bauzeit: 120, gebiet: 'industrie', arbeitsplaetze: 3, xp: 150
  }
};

export const BUILDING_TYPES = Object.keys(BUILDINGS) as BuildingType[];

export function isBuildingType(value: unknown): value is BuildingType {
  return typeof value === 'string' && value in BUILDINGS;
}

export function buildingDef(type: BuildingType): BuildingDef {
  return BUILDINGS[type];
}

// Welche Ausbaustufe hat ein Gebäude auf diesem Level? (z. B. Wohnhaus Level 6 = Mehrfamilienhaus)
export function ausbaustufe(type: BuildingType, level: number): Ausbaustufe {
  const def = BUILDINGS[type];
  const stufen = def.ausbau ?? [{ ab: 1, name: def.name, icon: def.icon }];
  return [...stufen].reverse().find(s => level >= s.ab) ?? stufen[0];
}
