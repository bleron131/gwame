import { BUILDINGS, type BuildingType } from './buildings';
import { START_PARZELLEN, gebietVon } from './land';
import { RESEARCH, type ResearchId } from './research';
import { RESOURCES, type Amounts, type ResourceId, type Stock } from './resources';
import type { PlacedBuilding } from './rules';
import type { GameState } from './types';

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
  | { art: 'einwohner'; anzahl: number }
  | { art: 'bauarbeiter'; anzahl: number }                   // so viele Bauarbeiter angestellt
  | { art: 'arbeiter'; anzahl: number }                      // so viele Arbeiter in Gebäuden
  | { art: 'blackjack'; runden: number }                     // so viele Runden Blackjack gespielt
  | { art: 'land'; anzahl: number }                          // so viele Parzellen dazugekauft
  | { art: 'bestellung'; anzahl: number }                    // so oft im PC-Shop bestellt
  | { art: 'industrie' };                                    // Industrie-Gebiet freigeschaltet

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
  { id: 'bauarbeiter', titel: 'Helfende Hände', ziel: { art: 'bauarbeiter', anzahl: 1 }, belohnung: { gold: 150 }, xp: 30,
    text: 'Bauen dauert! Du kannst selbst mithelfen (lauf zur Baustelle und tippe auf 🔨) – oder stell im Rathaus einen Bauarbeiter an. Probier es aus!' },
  { id: 'arbeiter', titel: 'Der erste Mitarbeiter', ziel: { art: 'arbeiter', anzahl: 1 }, belohnung: { gold: 120, wood: 40 }, xp: 30,
    text: 'Unsere Einwohner suchen Arbeit! Tippe auf einen Holzfäller oder Bauernhof und stell einen Arbeiter an. Jeder Arbeiter bringt +25 %.' },
  { id: 'glueck', titel: 'Glück im Spiel', ziel: { art: 'blackjack', runden: 1 }, belohnung: { gold: 100 }, xp: 30,
    text: 'Die Leute wollen sich auch vergnügen. Bau eine Spielhalle und spiel eine Runde Blackjack – aber setz nicht alles auf eine Karte!' },
  { id: 'bretter', titel: 'Bretter, bitte!', ziel: { art: 'bauen', typ: 'sawmill', anzahl: 1 }, belohnung: { gold: 150 }, xp: 40,
    text: 'Für die Bäckerei brauchen wir Bretter. Bau ein Sägewerk (ab Level 3) – es macht aus Holz Bretter.' },
  { id: 'muehle', titel: 'Mehl mahlen', ziel: { art: 'bauen', typ: 'windmill', anzahl: 1 }, belohnung: { gold: 200, planks: 30 }, xp: 50,
    text: 'Aus Getreide wird Mehl – in der Windmühle! Bau eine, nahe an deinem Bauernhof.' },
  { id: 'land', titel: 'Neues Land', ziel: { art: 'land', anzahl: 1 }, belohnung: { gold: 200 }, xp: 50,
    text: 'Unsere Stadt wird zu eng! Am Rand kannst du Land kaufen. Tippe auf ein Schild „Zu verkaufen“ oder öffne den 💻 PC.' },
  { id: 'lager', titel: 'Mehr Platz', ziel: { art: 'bauen', typ: 'warehouse', anzahl: 1 }, belohnung: { gold: 150 }, xp: 40,
    text: 'Das Lager platzt aus allen Nähten. Ein Lagerhaus schafft Platz für alle Rohstoffe.' },
  { id: 'brot', titel: 'Frisches Brot', ziel: { art: 'bauen', typ: 'bakery', anzahl: 1 }, belohnung: { gold: 300 }, xp: 60,
    text: 'Jetzt fehlt nur noch die Bäckerei (ab Level 4). Sie backt aus Mehl Brot – satte Einwohner zahlen doppelt Steuern!' },
  { id: 'bestellen', titel: 'Online bestellen', ziel: { art: 'bestellung', anzahl: 1 }, belohnung: { gold: 150 }, xp: 30,
    text: 'Im Rathaus steht jetzt ein Computer! Öffne den 💻 PC, leg etwas in den Warenkorb und bestell es. Der Lieferwagen bringt es dir.' },
  { id: 'satt', titel: 'Satte Bürger', ziel: { art: 'vorrat', rohstoff: 'bread', menge: 40 }, belohnung: { gold: 400 }, xp: 80,
    text: 'Sammle 40 Brote im Lager, damit niemand hungern muss.' },
  { id: 'mehrfamilien', titel: 'Mehr Platz zum Wohnen', ziel: { art: 'level', typ: 'house', level: 5 }, belohnung: { gold: 400, planks: 40 }, xp: 80,
    text: 'Verbessere ein Wohnhaus auf Level 5 – dann wird daraus ein Mehrfamilienhaus mit viel mehr Einwohnern. Dafür brauchst du Bretter.' },
  { id: 'stadt', titel: 'Eine echte Stadt', ziel: { art: 'einwohner', anzahl: 80 }, belohnung: { gold: 800, planks: 60 }, xp: 120,
    text: 'Aus unserem Dorf wird eine Stadt! Sorge für 80 Einwohner – Wohnhäuser an der Strasse ziehen mehr Leute an.' },
  { id: 'industrie', titel: 'Die Industrie ruft', ziel: { art: 'industrie' }, belohnung: { gold: 1000 }, xp: 150,
    text: 'Rechts neben der Stadt liegt das Industrie-Gebiet. Wenn du weit genug bist, kannst du es freischalten – tippe auf das Tor!' },
  { id: 'mine', titel: 'Ab in den Berg', ziel: { art: 'bauen', typ: 'mine', anzahl: 1 }, belohnung: { gold: 500, wood: 100 }, xp: 80,
    text: 'Im Industrie-Gebiet brauchen wir zuerst Erz. Bau eine Erzmine.' },
  { id: 'stahl', titel: 'Hart wie Stahl', ziel: { art: 'bauen', typ: 'steelworks', anzahl: 1 }, belohnung: { gold: 600, planks: 60 }, xp: 100,
    text: 'Aus Erz und Holz macht ein Stahlwerk Stahl. Bau eins!' },
  { id: 'maschinen', titel: 'Maschinen bauen', ziel: { art: 'bauen', typ: 'factory', anzahl: 1 }, belohnung: { gold: 800, steel: 30 }, xp: 120,
    text: 'Eine Maschinenfabrik baut aus Stahl und Brettern Maschinen. Damit kannst du Wohnblöcke und Firmen bauen.' },
  { id: 'firma', titel: 'Deine eigene Firma', ziel: { art: 'bauen', typ: 'company', anzahl: 1 }, belohnung: { gold: 2000 }, xp: 200,
    text: 'Gründe eine Handelsfirma! Sie verkauft Möbel und Maschinen – und bringt dir jede Minute viel Gold.' },
  { id: 'wohnblock', titel: 'Hoch hinaus', ziel: { art: 'level', typ: 'house', level: 8 }, belohnung: { gold: 3000, machines: 10 }, xp: 250,
    text: 'Jetzt wird es eine Grossstadt: Verbessere ein Haus auf Level 8 – zum Wohnblock!' }
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
    case 'bauarbeiter': return `Stell ${z.anzahl} 👷 Bauarbeiter an (im Rathaus oder 💻 PC)`;
    case 'arbeiter': return `Stell ${z.anzahl} Arbeiter in einem Gebäude an`;
    case 'blackjack': return `Spiel ${z.runden} Runde 🃏 Blackjack`;
    case 'land': return `Kauf ${z.anzahl} Stück 🗺️ Land dazu`;
    case 'bestellung': return `Bestell ${z.anzahl}× im 💻 PC-Shop`;
    case 'industrie': return 'Schalte das 🏭 Industrie-Gebiet frei';
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
  bauarbeiter: number;
  blackjackRunden: number;
  landGekauft: number;
  bestellungen: number;
  industrie: boolean;
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
    case 'bauarbeiter': return { aktuell: k.bauarbeiter, ziel: z.anzahl };
    case 'arbeiter': return { aktuell: k.buildings.reduce((s, b) => s + (b.arbeiter ?? 0), 0), ziel: z.anzahl };
    case 'blackjack': return { aktuell: k.blackjackRunden, ziel: z.runden };
    case 'land': return { aktuell: k.landGekauft, ziel: z.anzahl };
    case 'bestellung': return { aktuell: k.bestellungen, ziel: z.anzahl };
    case 'industrie': return { aktuell: k.industrie ? 1 : 0, ziel: 1 };
  }
}

// Den Kontext aus dem Spielstand bauen (Server und Browser rechnen gleich)
export function kontextAusState(state: GameState, vorrat: Stock = state.resources): QuestKontext {
  return {
    buildings: state.buildings, verbunden: state.stats.verbunden,
    forschungFertig: state.forschung.fertig, forschungAktiv: state.forschung.aktiv,
    vorrat, einwohner: state.stats.population, zaehler: state.aufgabe.zaehler,
    bauarbeiter: state.personal.bauarbeiter, blackjackRunden: state.blackjack.statistik.runden,
    landGekauft: state.land.parzellen.filter(p => gebietVon(p.px, p.py) === 'stadt').length - START_PARZELLEN.length,
    bestellungen: state.shop.bestellt, industrie: state.land.industrie
  };
}
