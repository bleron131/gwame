import { RESEARCH, isResearchId, type GameEvents } from '@empire/shared';
import type { DB } from '../db/db';
import { pay } from './buildingService';
import { GameError } from './errors';
import { readForschung, readSave } from './saveService';

// Eine Forschung starten. Sie wird später in settle() fertig – auch wenn man offline ist.
export function startResearch(db: DB, saveId: number, researchId: unknown, now: number): GameEvents {
  if (!isResearchId(researchId)) throw new GameError('UNKNOWN_RESEARCH', 'Diese Forschung gibt es nicht.');
  const def = RESEARCH[researchId];
  const stand = readForschung(db, saveId);
  if (stand.fertig.includes(researchId)) throw new GameError('DONE', `${def.name} ist schon erforscht.`);
  if (stand.aktiv) throw new GameError('BUSY', `Es läuft schon eine Forschung: ${RESEARCH[stand.aktiv].name}.`, 409);
  if (readSave(db, saveId).level < def.unlockLevel) throw new GameError('LOCKED', `${def.name} gibt es ab Level ${def.unlockLevel}.`);
  pay(db, saveId, def.cost);
  db.prepare('UPDATE game_saves SET research_active = ?, research_ends_at = ? WHERE id = ?')
    .run(researchId, now + def.seconds * 1000, saveId);
  return {};
}
