import type { BuildingType } from './buildings';
import type { Amounts } from './resources';

// ===== Innenräume =====
// In diese Gebäude kann der Bürgermeister hineingehen.
export const MIT_INNENRAUM: BuildingType[] = ['house', 'farm', 'casino', 'bakery', 'townhall', 'warehouse'];
export const hatInnenraum = (t: BuildingType) => MIT_INNENRAUM.includes(t);

// ===== Möbel (zum Einrichten der Wohnhäuser) =====
// gemuetlichkeit: macht das Haus gemütlicher – gemütliche Häuser ziehen mehr Einwohner an
// aktion:         was man mit dem Möbelstück machen kann
// modelle:        Teile aus dem Kenney Furniture Kit (relativ zueinander verschoben)
export type MoebelAktion = 'essen' | 'lesen' | 'umziehen' | 'fernsehen' | 'pc' | 'sitzen';

export interface MoebelDef {
  name: string;
  icon: string;
  kosten: Amounts;
  gemuetlichkeit: number;
  aktion?: MoebelAktion;
  modelle: { m: string; p?: [number, number, number]; r?: number }[];
}

export type MoebelId =
  | 'teppich' | 'pflanze' | 'stehlampe' | 'stuhl' | 'tisch' | 'couchtisch' | 'sofa' | 'sessel' | 'kueche' | 'kuehlschrank'
  | 'buecherregal' | 'fernseher' | 'kleiderschrank' | 'schreibtisch' | 'designsofa' | 'designsessel';

export const MOEBEL: Record<MoebelId, MoebelDef> = {
  teppich: { name: 'Teppich', icon: '🟫', kosten: { gold: 20, planks: 2 }, gemuetlichkeit: 1, modelle: [{ m: 'rugRectangle' }] },
  pflanze: { name: 'Zimmerpflanze', icon: '🪴', kosten: { gold: 30 }, gemuetlichkeit: 1, modelle: [{ m: 'pottedPlant' }] },
  stehlampe: { name: 'Stehlampe', icon: '💡', kosten: { gold: 40, planks: 2 }, gemuetlichkeit: 1, modelle: [{ m: 'lampRoundFloor' }] },
  stuhl: { name: 'Stuhl', icon: '🪑', kosten: { planks: 6 }, gemuetlichkeit: 1, aktion: 'sitzen', modelle: [{ m: 'chair' }] },
  tisch: { name: 'Esstisch mit Stühlen', icon: '🍽️', kosten: { planks: 18 }, gemuetlichkeit: 2,
    modelle: [{ m: 'table' }, { m: 'chair', p: [-0.25, 0, -0.5], r: 0 }, { m: 'chair', p: [0.25, 0, 0.5], r: Math.PI }] },
  couchtisch: { name: 'Couchtisch', icon: '☕', kosten: { planks: 10 }, gemuetlichkeit: 1, modelle: [{ m: 'tableCoffee' }] },
  sofa: { name: 'Sofa', icon: '🛋️', kosten: { planks: 20, gold: 60 }, gemuetlichkeit: 3, aktion: 'sitzen', modelle: [{ m: 'loungeSofa' }] },
  sessel: { name: 'Sessel', icon: '💺', kosten: { planks: 12, gold: 30 }, gemuetlichkeit: 2, aktion: 'sitzen', modelle: [{ m: 'loungeChair' }] },
  kueche: { name: 'Küche', icon: '🍳', kosten: { planks: 25, stone: 10, gold: 80 }, gemuetlichkeit: 2, aktion: 'essen',
    modelle: [{ m: 'kitchenStove' }, { m: 'kitchenCabinet', p: [0.45, 0, 0] }, { m: 'kitchenSink', p: [-0.45, 0, 0] }] },
  kuehlschrank: { name: 'Kühlschrank', icon: '🧊', kosten: { gold: 120 }, gemuetlichkeit: 1, aktion: 'essen', modelle: [{ m: 'kitchenFridge' }] },
  buecherregal: { name: 'Bücherregal', icon: '📚', kosten: { planks: 20 }, gemuetlichkeit: 2, aktion: 'lesen',
    modelle: [{ m: 'bookcaseOpen' }, { m: 'books', p: [0, 0.35, 0] }] },
  fernseher: { name: 'Fernseher', icon: '📺', kosten: { gold: 200, planks: 8 }, gemuetlichkeit: 3, aktion: 'fernsehen',
    modelle: [{ m: 'cabinetTelevision' }, { m: 'televisionModern', p: [0, 0.31, -0.02] }] },
  kleiderschrank: { name: 'Kleiderschrank', icon: '👔', kosten: { planks: 25 }, gemuetlichkeit: 1, aktion: 'umziehen',
    modelle: [{ m: 'bookcaseClosedDoors' }] },
  schreibtisch: { name: 'Schreibtisch mit PC', icon: '🖥️', kosten: { gold: 250, planks: 15 }, gemuetlichkeit: 2, aktion: 'pc',
    modelle: [{ m: 'desk' }, { m: 'computerScreen', p: [0, 0.38, -0.05] }, { m: 'computerKeyboard', p: [0, 0.38, 0.12] }, { m: 'chairDesk', p: [0, 0, 0.45], r: Math.PI }] },
  designsofa: { name: 'Design-Sofa', icon: '✨', kosten: { furniture: 4, gold: 150 }, gemuetlichkeit: 6, aktion: 'sitzen', modelle: [{ m: 'loungeDesignSofa' }] },
  designsessel: { name: 'Design-Sessel', icon: '🌟', kosten: { furniture: 2, gold: 80 }, gemuetlichkeit: 4, aktion: 'sitzen', modelle: [{ m: 'loungeDesignChair' }] }
};

export const MOEBEL_IDS = Object.keys(MOEBEL) as MoebelId[];
export const isMoebelId = (v: unknown): v is MoebelId => typeof v === 'string' && v in MOEBEL;

// Eingerichtete Möbel eines Hauses: Stellplatz-Nummer -> Möbelstück
export type Einrichtung = Partial<Record<number, MoebelId>>;

// Wie gemütlich ist ein Haus? Jeder Punkt: +4 % Einwohner (höchstens +60 %)
export const GEMUETLICH_PRO_PUNKT = 0.04;
export const GEMUETLICH_MAX = 0.6;
export function gemuetlichkeit(e: Einrichtung | undefined): number {
  return Object.values(e ?? {}).reduce((s, id) => s + (id && MOEBEL[id] ? MOEBEL[id].gemuetlichkeit : 0), 0);
}
export const gemuetlichBonus = (e: Einrichtung | undefined) => Math.min(GEMUETLICH_MAX, gemuetlichkeit(e) * GEMUETLICH_PRO_PUNKT);
export const ABBAU_RUECKGABE = 0.5; // ein Möbelstück wegräumen: die Hälfte zurück

// ===== Räume und Stellplätze =====
// Der Raum hat die Tür vorne in der Mitte (Richtung +z). Masse in Einheiten der 3D-Welt.
// r = Drehung: 0 = schaut nach vorne (+z), π/2 = schaut nach rechts (+x), −π/2 = nach links
export interface Stellplatz { x: number; z: number; r: number }
export interface Raum { breit: number; tief: number; stellplaetze: Stellplatz[]; bett: Stellplatz }

const P = Math.PI / 2;
export const RAEUME: Record<'klein' | 'mittel' | 'gross', Raum> = {
  // Wohnhaus (Level 1–4)
  klein: {
    breit: 6, tief: 5, bett: { x: -1.95, z: -1.25, r: 0 },
    stellplaetze: [
      { x: 0, z: -2.15, r: 0 }, { x: 2.2, z: -2.0, r: 0 }, { x: 2.65, z: 0, r: -P },
      { x: 0.4, z: 0.1, r: 0 }, { x: -2.65, z: 1.2, r: P }, { x: 2.3, z: 1.8, r: -P }
    ]
  },
  // Mehrfamilienhaus (Level 5–7)
  mittel: {
    breit: 8, tief: 6, bett: { x: -2.95, z: -1.75, r: 0 },
    stellplaetze: [
      { x: -0.8, z: -2.65, r: 0 }, { x: 1.2, z: -2.65, r: 0 }, { x: 3.2, z: -2.5, r: 0 }, { x: 3.65, z: -0.5, r: -P },
      { x: 3.65, z: 1.5, r: -P }, { x: 0.6, z: 0, r: 0 }, { x: -1.6, z: 0.6, r: 0 }, { x: -3.65, z: 1.4, r: P }, { x: 2, z: 2.3, r: Math.PI }
    ]
  },
  // Wohnblock (Level 8–10): eine grosse Wohnung
  gross: {
    breit: 10, tief: 7, bett: { x: -3.95, z: -2.25, r: 0 },
    stellplaetze: [
      { x: -1.8, z: -3.15, r: 0 }, { x: 0.2, z: -3.15, r: 0 }, { x: 2.2, z: -3.15, r: 0 }, { x: 4.2, z: -3, r: 0 },
      { x: 4.65, z: -1, r: -P }, { x: 4.65, z: 1.2, r: -P }, { x: 1.4, z: -0.6, r: 0 }, { x: -1.4, z: 0.4, r: 0 },
      { x: 1.4, z: 1.4, r: 0 }, { x: -4.65, z: 0.6, r: P }, { x: -4.65, z: 2.4, r: P }, { x: 3, z: 3, r: Math.PI }
    ]
  }
};

export function raumFuerHaus(level: number): Raum {
  return level >= 8 ? RAEUME.gross : level >= 5 ? RAEUME.mittel : RAEUME.klein;
}

// ===== Aktionen des Bürgermeisters (ausruhen, essen, lesen …) =====
export const AUSRUHEN = { minuten: 5, ertragFaktor: 2 };        // ausgeruht: doppelter Ertrag beim Fällen und Mithelfen
export const ESSEN = { minuten: 5, brot: 2, tempo: 1.3 };       // satt: 30 % schneller laufen
export const LESEN = { xp: 20, abstandMinuten: 3 };             // lesen bringt Erfahrung (alle 3 Minuten)
export const BAUERNHOF_ABFUELLEN = { getreideProLevel: 15, abstandSekunden: 120 };
export const BACKEN = { mehl: 4, brot: 6, abstandSekunden: 20 };

// Kleider für den Bürgermeister
export const JACKEN_FARBEN = ['#2c4a8c', '#8e2b2b', '#2e6b3a', '#5b3a7a', '#6b4a2b', '#1d1d24', '#c0862c', '#e8e2d4'];
export const HUETE = ['zylinder', 'kappe', 'tuch', 'keiner'] as const;
export type Hut = typeof HUETE[number];
export interface Outfit { jacke: string; hut: Hut; hutFarbe: string }
export const STANDARD_OUTFIT: Outfit = { jacke: '#2c4a8c', hut: 'zylinder', hutFarbe: '#1d1d24' };
export function isOutfit(v: unknown): v is Outfit {
  const o = v as Outfit;
  return !!o && typeof o === 'object' && JACKEN_FARBEN.includes(o.jacke) && (HUETE as readonly string[]).includes(o.hut) && JACKEN_FARBEN.includes(o.hutFarbe);
}

// Der Zustand des Bürgermeisters (für den Browser)
export interface Buergermeister {
  ausgeruhtBis: number;
  sattBis: number;
  gelesenAm: number;
  outfit: Outfit;
}

// ===== Rangliste am Blackjack-Tisch =====
// Ausgedachte Mitspieler aus der Gegend – kannst du sie überholen? (Bilanz in Gold)
export const RANGLISTE_MITSPIELER: { name: string; icon: string; bilanz: number }[] = [
  { name: 'Glücksritter Kurt', icon: '🎩', bilanz: 50000 },
  { name: 'Gräfin Adele', icon: '👑', bilanz: 18000 },
  { name: 'Bankier Moritz', icon: '💼', bilanz: 6000 },
  { name: 'Holzfäller Sepp', icon: '🪓', bilanz: 2000 },
  { name: 'Müllerin Lisa', icon: '🌾', bilanz: 800 },
  { name: 'Bäcker Hans', icon: '🥖', bilanz: 300 },
  { name: 'Greta', icon: '👩‍🌾', bilanz: 100 },
  { name: 'Pechvogel Paul', icon: '🙈', bilanz: -400 }
];
