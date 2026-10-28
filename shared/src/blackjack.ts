import { RESOURCE_IDS, type ResourceId } from './resources';

// Blackjack gegen die Bank.
// Ziel: näher an 21 als die Bank, aber nicht darüber ("überkauft").
// - Bildkarten (B, D, K) zählen 10, ein Ass zählt 11 oder 1 (was besser passt).
// - Die Bank zieht, bis sie mindestens 17 hat.
// - Blackjack (Ass + 10er mit den ersten 2 Karten) zahlt 3:2, ein normaler Sieg 1:1,
//   Gleichstand = Einsatz zurück.
// Alles hier sind "reine" Funktionen: Sie rechnen nur. Speichern macht der Server.

export type Farbe = '♠' | '♥' | '♦' | '♣';
export type Rang = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'B' | 'D' | 'K';
export interface Karte { rang: Rang; farbe: Farbe }

const FARBEN: Farbe[] = ['♠', '♥', '♦', '♣'];
const RAENGE: Rang[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'B', 'D', 'K'];
export const BLACKJACK_DECKS = 6; // wie im Casino: 6 Kartenspiele gemischt

// Höchsteinsatz je Level der Spielhalle
export const MAX_EINSATZ_GOLD = [100, 300, 1000, 3000, 10000];
export const MAX_EINSATZ_ROHSTOFF = [30, 80, 200, 500, 1200];

export function maxEinsatz(rohstoff: ResourceId, hallenLevel: number): number {
  const liste = rohstoff === 'gold' ? MAX_EINSATZ_GOLD : MAX_EINSATZ_ROHSTOFF;
  return liste[Math.max(0, Math.min(liste.length - 1, hallenLevel - 1))];
}

export function isRohstoff(value: unknown): value is ResourceId {
  return typeof value === 'string' && (RESOURCE_IDS as string[]).includes(value);
}

// Ein frisch gemischter Kartenstapel. "zufall" ist austauschbar, damit Tests immer gleich laufen.
export function neuerStapel(zufall: () => number = Math.random): Karte[] {
  const stapel: Karte[] = [];
  for (let d = 0; d < BLACKJACK_DECKS; d++) for (const farbe of FARBEN) for (const rang of RAENGE) stapel.push({ rang, farbe });
  // Fisher-Yates: jede Reihenfolge ist gleich wahrscheinlich
  for (let i = stapel.length - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1));
    [stapel[i], stapel[j]] = [stapel[j], stapel[i]];
  }
  return stapel;
}

// Wert einer Hand. "weich" = ein Ass zählt gerade als 11.
export function handWert(hand: Karte[]): { wert: number; weich: boolean } {
  let wert = 0, asse = 0;
  for (const k of hand) {
    if (k.rang === 'A') { wert += 11; asse++; }
    else if (k.rang === 'B' || k.rang === 'D' || k.rang === 'K') wert += 10;
    else wert += Number(k.rang);
  }
  while (wert > 21 && asse > 0) { wert -= 10; asse--; } // Ass von 11 auf 1 umstellen
  return { wert, weich: asse > 0 };
}

export const istBlackjack = (hand: Karte[]) => hand.length === 2 && handWert(hand).wert === 21;

export type Ergebnis = 'blackjack' | 'gewonnen' | 'unentschieden' | 'verloren';

// Wer hat gewonnen? (wird erst am Ende der Runde aufgerufen)
export function ergebnis(spieler: Karte[], bank: Karte[]): Ergebnis {
  const s = handWert(spieler).wert, b = handWert(bank).wert;
  const sBj = istBlackjack(spieler), bBj = istBlackjack(bank);
  if (sBj && bBj) return 'unentschieden';
  if (sBj) return 'blackjack';
  if (bBj) return 'verloren';
  if (s > 21) return 'verloren';
  if (b > 21) return 'gewonnen';
  if (s > b) return 'gewonnen';
  if (s < b) return 'verloren';
  return 'unentschieden';
}

// So viel bekommt man zurück (inklusive Einsatz). Beispiel Einsatz 10: Blackjack 25, Sieg 20, Gleichstand 10.
export function auszahlung(e: Ergebnis, einsatz: number): number {
  switch (e) {
    case 'blackjack': return Math.floor(einsatz * 2.5);
    case 'gewonnen': return einsatz * 2;
    case 'unentschieden': return einsatz;
    case 'verloren': return 0;
  }
}

// Die Bank zieht, bis sie 17 oder mehr hat
export function bankZiehtFertig(bank: Karte[], stapel: Karte[]): void {
  while (handWert(bank).wert < 17) bank.push(stapel.pop()!);
}

// Was der Browser von einer Runde sehen darf: die verdeckte Karte der Bank und
// der Stapel bleiben geheim, solange die Runde läuft (sonst könnte man schummeln).
export interface BlackjackSicht {
  rohstoff: ResourceId;
  einsatz: number;          // aktueller Einsatz (nach Verdoppeln doppelt so viel)
  spieler: Karte[];
  bank: (Karte | null)[];   // null = verdeckte Karte
  laeuft: boolean;
  verdoppelt: boolean;
  ergebnis: Ergebnis | null;
  ausgezahlt: number;       // so viel kam am Ende zurück (inkl. Einsatz)
}
