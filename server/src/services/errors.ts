// Ein Fehler, den der Spieler sehen soll (z. B. "Nicht genug Holz").
// "code" ist für das Programm, "message" für den Menschen.
export class GameError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}
