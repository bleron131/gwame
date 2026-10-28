import type { BuildingType } from './buildings';
import type { Amounts } from './resources';

// Forschung: kostet Rohstoffe, dauert eine Weile und macht die Stadt dauerhaft besser.
// Es läuft immer nur eine Forschung gleichzeitig (auch während du offline bist).
//
// effekt.produktion: Gebäude arbeiten schneller (0.5 = +50 %)
// effekt.strasse:    zusätzlicher Strassen-Bonus
// effekt.lager:      mehr Lagerplatz (0.5 = +50 %)
// effekt.steuer:     mehr Gold pro Einwohner
// effekt.ernte:      mehr Holz pro Schlag des Bürgermeisters
export interface ResearchDef {
  name: string;
  icon: string;
  text: string;
  cost: Amounts;
  seconds: number;
  unlockLevel: number;
  effekt: {
    produktion?: Partial<Record<BuildingType, number>>;
    strasse?: number;
    lager?: number;
    steuer?: number;
    ernte?: number;
  };
}

export type ResearchId =
  'axt' | 'werkzeug' | 'fruchtfolge' | 'saege' | 'muehlstein' | 'pflaster' | 'lagertechnik' | 'ofen' | 'steuern';

export const RESEARCH: Record<ResearchId, ResearchDef> = {
  axt: { name: 'Schärfere Äxte', icon: '🪓', text: 'Holzfäller +50 % – und du bekommst +2 Holz pro Schlag.', cost: { gold: 150, wood: 50 }, seconds: 60, unlockLevel: 2, effekt: { produktion: { lumberjack: 0.5 }, ernte: 2 } },
  werkzeug: { name: 'Bessere Werkzeuge', icon: '⛏️', text: 'Steinbrüche +50 %.', cost: { gold: 200, wood: 80 }, seconds: 90, unlockLevel: 2, effekt: { produktion: { quarry: 0.5 } } },
  fruchtfolge: { name: 'Fruchtfolge', icon: '🌾', text: 'Bauernhöfe +50 %.', cost: { gold: 250, wood: 60 }, seconds: 120, unlockLevel: 3, effekt: { produktion: { farm: 0.5 } } },
  saege: { name: 'Kreissäge', icon: '🪚', text: 'Sägewerke +50 %.', cost: { gold: 250, stone: 60 }, seconds: 120, unlockLevel: 3, effekt: { produktion: { sawmill: 0.5 } } },
  muehlstein: { name: 'Mühlsteine', icon: '⚙️', text: 'Windmühlen +50 %.', cost: { gold: 300, stone: 60 }, seconds: 150, unlockLevel: 3, effekt: { produktion: { windmill: 0.5 } } },
  pflaster: { name: 'Pflastersteine', icon: '🛣️', text: 'Strassen-Bonus +100 % statt +50 %.', cost: { gold: 250, stone: 80 }, seconds: 120, unlockLevel: 3, effekt: { strasse: 0.5 } },
  lagertechnik: { name: 'Lagertechnik', icon: '📦', text: '+50 % Lagerplatz für alles.', cost: { gold: 300, planks: 50 }, seconds: 150, unlockLevel: 3, effekt: { lager: 0.5 } },
  ofen: { name: 'Steinofen', icon: '🔥', text: 'Bäckereien +50 %.', cost: { gold: 400, planks: 60 }, seconds: 180, unlockLevel: 4, effekt: { produktion: { bakery: 0.5 } } },
  steuern: { name: 'Steuerreform', icon: '📜', text: '+1 🪙 pro Einwohner und Minute.', cost: { gold: 500, planks: 40 }, seconds: 240, unlockLevel: 4, effekt: { steuer: 1 } }
};

export const RESEARCH_IDS = Object.keys(RESEARCH) as ResearchId[];

export function isResearchId(value: unknown): value is ResearchId {
  return typeof value === 'string' && value in RESEARCH;
}
