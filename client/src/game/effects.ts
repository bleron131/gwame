// Kleine "Merkzettel", die Szene und Menüs gemeinsam benutzen,
// ohne dass React jedes Mal alles neu zeichnen muss.

// Wo der Bürgermeister gerade steht
export const spielerPos = { x: 0, z: 3 };

// Animationen: wann zuletzt zugeschlagen wurde (in Sekunden, performance.now()/1000)
export const spielerAnim = { schlagAt: 0, blickX: 0, blickZ: 0 };
export const trefferZeit = new Map<number, number>(); // Baum/Felsen-ID -> Zeitpunkt des letzten Schlags

// Schwebende Texte wie "+5 🪵"
export interface Schwebtext {
  id: number;
  text: string;
  pos: [number, number, number];
  farbe: string;
}
let texte: Schwebtext[] = [];
let naechsteId = 1;
const zuhoerer = new Set<() => void>();
const melden = () => zuhoerer.forEach(f => f());

export function schwebtext(text: string, pos: [number, number, number], farbe = '#ffffff') {
  const t: Schwebtext = { id: naechsteId++, text, pos, farbe };
  texte = [...texte, t];
  melden();
  setTimeout(() => { texte = texte.filter(x => x !== t); melden(); }, 1500);
}
export function schwebtexteAbo(f: () => void) { zuhoerer.add(f); return () => { zuhoerer.delete(f); }; }
export function schwebtexteJetzt() { return texte; }

export const jetztSek = () => performance.now() / 1000;
