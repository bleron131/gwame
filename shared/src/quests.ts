import { BUILDINGS, type BuildingType } from './buildings';
import { RESEARCH, type ResearchId } from './research';
import { RESOURCES, type Amounts, type ResourceId, type Stock } from './resources';
import type { PlacedBuilding } from './rules';

// Die Aufgaben von Greta, der Beraterin. Sie kommen nacheinander und führen durchs Spiel.
// Eine neue Aufgabe = ein neuer Eintrag in der Liste.

export type Ziel =
  | { art: 'faellen'; anzahl: number }                       // Bäume fällen (wird mitgezählt)
  | { art: 'abbauen'; anzahl: number }                       // Felsen abbauen (wird mitgezählt)
  | { art: 'bauen'; typ: BuildingType; anzahl: number }      // so viele Gebäude haben
  | { art: 'level'; typ: BuildingType; level: number }       // ein Gebäude auf dieses Level bringen
  | { art: 'verbunden'; anzahl: number }                     // Gebäude mit Strassen-Anschluss
  | { art: 'forschung'; id: ResearchId }
  | { art: 'vorrat'; rohstoff: ResourceId; menge: number }
  | { art: 'einwohner'; anzahl: number };

export interface QuestDef {
  id: string;
  titel: string;
  text: string;        // was Greta sagt
  ziel: Ziel;
  belohnung: Amounts;
  xp: number;
}

export const QUESTS: QuestDef[] = [
  { id: 'holz', titel: 'Holz für den Anfang', ziel: { art: 'faellen', anzahl: 3 }, belohnung: { gold: 50 }, xp: 20,
    text: 'Willkommen, Bürgermeister! Ich bin Greta, deine Beraterin. Zuerst brauchen wir Holz. Lauf zu den Bäumen und fäll drei davon.' },
  { id: 'holzfaeller', titel: 'Ein Holzfäller', ziel: { art: 'bauen', typ: 'lumberjack', anzahl: 1 }, belohnung: { gold: 60, wood: 20 }, xp: 20,
    text: 'Gut gemacht! Aber du kannst nicht alles selbst fällen. Bau einen Holzfäller – dann kommt Holz von allein.' },
  { id: 'nachbarn', titel: 'Neue Nachbarn', ziel: { art: 'bauen', typ: 'house', anzahl: 2 }, belohnung: { gold: 100 }, xp: 30,
    text: 'Eine Stadt braucht Menschen! Bau zwei Wohnhäuser. Jeder Einwohner zahlt Steuern.' },
  { id: 'strassen', titel: 'Wege für alle', ziel: { art: 'bauen', typ: 'road', anzahl: 4 }, belohnung: { gold: 40, stone: 20 }, xp: 20,
    text: 'Bei Regen versinken alle im Matsch. Bau vier Strassenstücke – am besten direkt am Rathaus.' },
  { id: 'verbinden', titel: 'Gute Verbindung', ziel: { art: 'verbunden', anzahl: 3 }, belohnung: { gold: 120 }, xp: 30,
    text: 'Gebäude, die über Strassen mit dem Rathaus verbunden sind, arbeiten 50 % mehr. Verbinde drei Gebäude!' },
  { id: 'stein', titel: 'Stein auf Stein', ziel: { art: 'bauen', typ: 'quarry', anzahl: 1 }, belohnung: { gold: 100 }, xp: 30,
    text: 'Für grössere Gebäude brauchen wir Stein. Bau einen Steinbruch (ab Level 2).' },
  { id: 'felder', titel: 'Felder anlegen', ziel: { art: 'bauen', typ: 'farm', anzahl: 1 }, belohnung: { wood: 60 }, xp: 30,
    text: 'Bald haben die Leute Hunger. Bau einen Bauernhof – dort wächst Getreide.' },
  { id: 'rathaus', titel: 'Ein grösseres Rathaus', ziel: { art: 'level', typ: 'townhall', level: 2 }, belohnung: { gold: 200 }, xp: 50,
    text: 'Unser Rathaus ist zu klein. Verbessere es auf Level 2 – das bringt mehr Gold und Lagerplatz.' },
  { id: 'forschung', titel: 'Kluge Köpfe', ziel: { art: 'forschung', id: 'axt' }, belohnung: { gold: 100, wood: 80 }, xp: 40,
    text: 'Unsere Gelehrten haben eine Idee: schärfere Äxte! Starte die Forschung „Schärfere Äxte“ (🔬 unten).' },
  { id: 'bretter', titel: 'Bretter, bitte!', ziel: { art: 'bauen', typ: 'sawmill', anzahl: 1 }, belohnung: { gold: 150 }, xp: 40,
    text: 'Für die Bäckerei brauchen wir Bretter. Bau ein Sägewerk (ab Level 3) – es macht aus Holz Bretter.' },
  { id: 'muehle', titel: 'Mehl mahlen', ziel: { art: 'bauen', typ: 'windmill', anzahl: 1 }, belohnung: { gold: 200, planks: 30 }, xp: 50,
    text: 'Aus Getreide wird Mehl – in der Windmühle! Bau eine, nahe an deinem Bauernhof.' },
  { id: 'lager', titel: 'Mehr Platz', ziel: { art: 'bauen', typ: 'warehouse', anzahl: 1 }, belohnung: { gold: 150 }, xp: 40,
    text: 'Das Lager platzt aus allen Nähten. Ein Lagerhaus schafft Platz für alle Rohstoffe.' },
  { id: 'brot', titel: 'Frisches Brot', ziel: { art: 'bauen', typ: 'bakery', anzahl: 1 }, belohnung: { gold: 300 }, xp: 60,
    text: 'Jetzt fehlt nur noch die Bäckerei (ab Level 4). Sie backt aus Mehl Brot – satte Einwohner zahlen doppelt Steuern!' },
  { id: 'satt', titel: 'Satte Bürger', ziel: { art: 'vorrat', rohstoff: 'bread', menge: 40 }, belohnung: { gold: 400 }, xp: 80,
    text: 'Sammle 40 Brote im Lager, damit niemand hungern muss.' },
  { id: 'stadt', titel: 'Eine echte Stadt', ziel: { art: 'einwohner', anzahl: 80 }, belohnung: { gold: 800, planks: 60 }, xp: 120,
    text: 'Aus unserem Dorf wird eine Stadt! Sorge für 80 Einwohner – Wohnhäuser an der Strasse ziehen mehr Leute an.' }
];

// "Fälle 3 Bäume", "Baue 2 × 🏠 Wohnhaus" …
export function zielText(z: Ziel): string {
  switch (z.art) {
    case 'faellen': return `Fälle ${z.anzahl} Bäume`;
    case 'abbauen': return `Baue ${z.anzahl} Felsen ab`;
    case 'bauen': return `Baue ${z.anzahl} × ${BUILDINGS[z.typ].icon} ${BUILDINGS[z.typ].name}`;
    case 'level': return `${BUILDINGS[z.typ].icon} ${BUILDINGS[z.typ].name} auf Level ${z.level}`;
    case 'verbunden': return `Verbinde ${z.anzahl} Gebäude per 🛣️ Strasse mit dem Rathaus`;
    case 'forschung': return `Erforsche ${RESEARCH[z.id].icon} ${RESEARCH[z.id].name}`;
    case 'vorrat': return `Sammle ${z.menge} ${RESOURCES[z.rohstoff].icon} ${RESOURCES[z.rohstoff].name}`;
    case 'einwohner': return `Erreiche ${z.anzahl} 👥 Einwohner`;
  }
}

// Was man braucht, um den Fortschritt auszurechnen
export interface QuestKontext {
  buildings: PlacedBuilding[];
  verbunden: number[];
  forschungFertig: ResearchId[];
  forschungAktiv: ResearchId | null;
  vorrat: Stock;
  einwohner: number;
  zaehler: number; // mitgezählte Bäume/Felsen für die aktive Aufgabe
}

// Wie weit ist die Aufgabe? { aktuell, ziel } – fertig, wenn aktuell >= ziel
export function questFortschritt(q: QuestDef, k: QuestKontext): { aktuell: number; ziel: number } {
  const z = q.ziel;
  switch (z.art) {
    case 'faellen': case 'abbauen': return { aktuell: k.zaehler, ziel: z.anzahl };
    case 'bauen': return { aktuell: k.buildings.filter(b => b.type === z.typ).length, ziel: z.anzahl };
    case 'level': return { aktuell: Math.max(0, ...k.buildings.filter(b => b.type === z.typ).map(b => b.level)), ziel: z.level };
    case 'verbunden': return { aktuell: k.verbunden.filter(id => k.buildings.some(b => b.id === id && b.type !== 'townhall')).length, ziel: z.anzahl };
    // Bei der Forschung reicht es, sie zu starten
    case 'forschung': return { aktuell: k.forschungFertig.includes(z.id) || k.forschungAktiv === z.id ? 1 : 0, ziel: 1 };
    case 'vorrat': return { aktuell: Math.floor(k.vorrat[z.rohstoff]), ziel: z.menge };
    case 'einwohner': return { aktuell: k.einwohner, ziel: z.anzahl };
  }
}
