import {
  MAX_OFFENE_BESTELLUNGEN, MAX_PRO_ARTIKEL, SHOP, isShopId, lieferzeitSekunden,
  type GameEvents, type ShopId
} from '@empire/shared';
import type { DB } from '../db/db';
import { pay } from './buildingService';
import { GameError } from './errors';
import { addXp, industrieFrei, readBestellungen, readSave } from './saveService';

// Den Warenkorb bestellen: alles prüfen, mit Gold bezahlen, der Lieferwagen fährt los.
// Ausgepackt wird die Lieferung später in settle(), sobald sie angekommen ist.
export function bestellen(db: DB, saveId: number, posten: unknown, now: number): GameEvents {
  if (!posten || typeof posten !== 'object') throw new GameError('EMPTY_CART', 'Dein Warenkorb ist leer.');
  const korb: Partial<Record<ShopId, number>> = {};
  let stueck = 0, preis = 0;
  const save = readSave(db, saveId);
  const industrie = industrieFrei(db, saveId);
  for (const [id, roh] of Object.entries(posten as Record<string, unknown>)) {
    const anzahl = Number(roh);
    if (!isShopId(id)) throw new GameError('UNKNOWN_ITEM', 'Diesen Artikel gibt es nicht.');
    if (!Number.isInteger(anzahl) || anzahl < 0 || anzahl > MAX_PRO_ARTIKEL) throw new GameError('BAD_AMOUNT', `Höchstens ${MAX_PRO_ARTIKEL} Stück pro Artikel.`);
    if (anzahl === 0) continue;
    const a = SHOP[id];
    if (save.level < a.abLevel) throw new GameError('LOCKED', `${a.name} gibt es ab Level ${a.abLevel}.`);
    if (a.industrie && !industrie) throw new GameError('LOCKED', `${a.name} gibt es erst mit der Industrie.`);
    korb[id] = anzahl;
    stueck += anzahl;
    preis += a.preis * anzahl;
  }
  if (stueck === 0) throw new GameError('EMPTY_CART', 'Dein Warenkorb ist leer.');
  if (readBestellungen(db, saveId).length >= MAX_OFFENE_BESTELLUNGEN) {
    throw new GameError('TOO_MANY', `Es sind schon ${MAX_OFFENE_BESTELLUNGEN} Lieferwagen unterwegs. Warte, bis einer da ist.`);
  }
  pay(db, saveId, { gold: preis });
  const ankunft = now + lieferzeitSekunden(stueck) * 1000;
  db.prepare('INSERT INTO shop_orders (save_id, posten, bestellt_am, ankunft) VALUES (?, ?, ?, ?)').run(saveId, JSON.stringify(korb), now, ankunft);
  return addXp(db, saveId, 5);
}
