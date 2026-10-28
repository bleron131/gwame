import type { BlackjackStand } from './blackjack';
import type { Parzelle } from './land';
import type { Bestellung } from './shop';
import type { BuildingType } from './buildings';
import type { NodeType } from './nodes';
import type { ResearchId } from './research';
import type { Amounts, Stock } from './resources';
import type { CityStats, PlacedBuilding } from './rules';

// So sieht der Spielstand aus, den der Server an den Browser schickt.

export interface SaveInfo {
  id: number;
  cityName: string;
  level: number;
  experience: number;
  lastCalculatedAt: number; // Zeitpunkt (ms), bis zu dem die Produktion berechnet ist
}

export interface MapNode {
  id: number;
  type: NodeType;
  x: number;
  y: number;
  hitsLeft: number;
}

export interface ForschungsStand {
  fertig: ResearchId[];
  aktiv: ResearchId | null;
  endetAm: number; // ms
}

export interface AufgabenStand {
  nummer: number;       // Index in QUESTS (= Anzahl erledigter Aufgaben)
  id: string | null;    // null = alle erledigt
  zaehler: number;      // mitgezählte Bäume/Felsen
}

export interface GameState {
  save: SaveInfo;
  resources: Stock;
  buildings: PlacedBuilding[];
  nodes: MapNode[];
  stats: CityStats;
  forschung: ForschungsStand;
  aufgabe: AufgabenStand;
  blackjack: BlackjackStand;        // die letzte (oder laufende) Runde und die Statistik
  land: { parzellen: Parzelle[]; industrie: boolean };
  personal: { bauarbeiter: number };
  shop: { bestellungen: Bestellung[]; bausaetze: Partial<Record<BuildingType, number>>; bestellt: number };
  serverTime: number;
}

// Besondere Ereignisse nach einer Aktion (für Meldungen im Browser)
export interface GameEvents {
  levelUp?: number;
  bauEnde?: number;           // ein Bau hat begonnen und ist dann fertig
  unlocked?: BuildingType[];
  gained?: Amounts;
}

export interface OfflineReport {
  seconds: number;
  gained: Amounts;
}

export interface GameResponse {
  state: GameState;
  events?: GameEvents;
  offline?: OfflineReport;
}

export interface ApiErrorBody {
  error: string;
  message: string;
}
