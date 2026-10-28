import {
  BUILDINGS, NACHWACHSEN, NODES, OFFLINE_LIMIT_SECONDS, PARZELLE, QUESTS, SHOP, START_PARZELLEN, START_RESOURCES, TOWNHALL_POS,
  STANDARD_OUTFIT, bausatzMenge, cityStats, isMoebelId, isOutfit, emptyStock, gainedBetween, gebietVon, generateNodes, isBuildingType, isResearchId, isShopId,
  levelForXp, nachwachsPlatz, parzellenSchluessel, produce,
  type Amounts, type AufgabenStand, type Einrichtung, type Outfit, type Bestellung, type BuildingType, type CityStats, type ForschungsStand, type GameEvents,
  type GameState, type MapNode, type NodeType, type OfflineReport, type Parzelle, type PlacedBuilding, type ResearchId, type ShopId, type Stock
} from '@empire/shared';
import type { DB } from '../db/db';
import { blackjackStand } from './blackjackService';
import { GameError } from './errors';

interface SaveRow {
  id: number;
  city_name: string;
  level: number;
  experience: number;
  seed: number;
  last_calculated_at: number;
  last_harvest_at: number;
  research_active: string | null;  // diese Forschung läuft gerade
  research_ends_at: number;        // … und ist dann fertig (ms)
  last_regrow_at: number;          // bis hierhin ist die Natur nachgewachsen (ms)
  bauarbeiter: number;
  ausgeruht_bis: number;           // der Bürgermeister hat geschlafen: doppelter Ertrag bis dann
  satt_bis: number;                // … hat gegessen: schneller laufen bis dann
  gelesen_am: number;
  outfit: string | null;           // Kleidung als JSON
}

// Für Version 0.1 gibt es genau einen Spielstand
export function findSaveId(db: DB): number | undefined {
  const row = db.prepare('SELECT id FROM game_saves ORDER BY id LIMIT 1').get() as { id: number } | undefined;
  return row?.id;
}

export function readSave(db: DB, saveId: number): SaveRow {
  const row = db.prepare('SELECT * FROM game_saves WHERE id = ?').get(saveId) as SaveRow | undefined;
  if (!row) throw new GameError('NO_SAVE', 'Diesen Spielstand gibt es nicht.', 404);
  return row;
}

export function readStock(db: DB, saveId: number): Stock {
  const stock = emptyStock(); // fehlt ein (neuer) Rohstoff in der DB, ist er 0
  const rows = db.prepare('SELECT resource_type, amount FROM resources WHERE save_id = ?').all(saveId) as { resource_type: string; amount: number }[];
  for (const row of rows) if (row.resource_type in stock) stock[row.resource_type as keyof Stock] = row.amount;
  return stock;
}

// Speichert die angegebenen Rohstoffe (fehlende bleiben, wie sie sind)
export function writeStock(db: DB, saveId: number, stock: Amounts): void {
  const upsert = db.prepare(`INSERT INTO resources (save_id, resource_type, amount) VALUES (?, ?, ?)
    ON CONFLICT (save_id, resource_type) DO UPDATE SET amount = excluded.amount`);
  for (const r of Object.keys(stock) as (keyof Stock)[]) upsert.run(saveId, r, Math.max(0, stock[r] ?? 0));
}

export function readBuildings(db: DB, saveId: number): PlacedBuilding[] {
  const rows = db.prepare('SELECT id, building_type, x, y, level, bau_ende, arbeiter, einrichtung, aktion_am FROM buildings WHERE save_id = ? ORDER BY id').all(saveId) as
    { id: number; building_type: string; x: number; y: number; level: number; bau_ende: number; arbeiter: number; einrichtung: string; aktion_am: number }[];
  return rows.filter(r => r.building_type in BUILDINGS).map(r => {
    const b: PlacedBuilding = { id: r.id, type: r.building_type as BuildingType, x: r.x, y: r.y, level: r.level, bauEnde: r.bau_ende, arbeiter: r.arbeiter };
    // Möbel nur mitschicken, wenn es welche gibt (hält den Spielstand klein)
    const e = leseEinrichtung(r.einrichtung);
    if (Object.keys(e).length) b.einrichtung = e;
    if (r.aktion_am) b.aktionAm = r.aktion_am;
    return b;
  });
}

function leseEinrichtung(json: string): Einrichtung {
  try {
    const roh = JSON.parse(json || '{}') as Record<string, unknown>;
    const e: Einrichtung = {};
    for (const [k, v] of Object.entries(roh)) if (isMoebelId(v) && Number.isInteger(Number(k))) e[Number(k)] = v;
    return e;
  } catch { return {}; }
}

function leseOutfit(json: string | null): Outfit {
  try { const o = JSON.parse(json ?? 'null'); return isOutfit(o) ? o : STANDARD_OUTFIT; } catch { return STANDARD_OUTFIT; }
}

// ===== Land =====
export function readParzellen(db: DB, saveId: number): Parzelle[] {
  return db.prepare('SELECT px, py FROM plots WHERE save_id = ? ORDER BY px, py').all(saveId) as Parzelle[];
}
export function besitzSet(db: DB, saveId: number): Set<string> {
  return new Set(readParzellen(db, saveId).map(parzellenSchluessel));
}
export function industrieFrei(db: DB, saveId: number): boolean {
  return readParzellen(db, saveId).some(p => gebietVon(p.px, p.py) === 'industrie');
}

export function readNodes(db: DB, saveId: number): MapNode[] {
  const rows = db.prepare('SELECT id, node_type, x, y, hits_left FROM nodes WHERE save_id = ? ORDER BY id').all(saveId) as
    { id: number; node_type: string; x: number; y: number; hits_left: number }[];
  return rows.map(r => ({ id: r.id, type: r.node_type as NodeType, x: r.x, y: r.y, hitsLeft: r.hits_left }));
}

// Rohstoffe dazulegen – aber nur so viel, wie ins Lager passt. Gibt zurück, was wirklich dazukam.
export function gutschreiben(db: DB, saveId: number, menge: Amounts, zeit: number): Amounts {
  const stock = readStock(db, saveId);
  const cap = stadtWerte(db, saveId, zeit).capacity;
  const gained: Amounts = {};
  for (const r of Object.keys(menge) as (keyof Stock)[]) {
    const dazu = menge[r] ?? 0;
    if (dazu <= 0) continue;
    const grenze = cap[r];
    const neu = grenze === null ? stock[r] + dazu : Math.max(stock[r], Math.min(grenze, stock[r] + dazu));
    if (neu > stock[r]) gained[r] = Math.floor(neu - stock[r]);
    stock[r] = neu;
  }
  writeStock(db, saveId, stock);
  return gained;
}

// ===== Forschung =====
export function readResearch(db: DB, saveId: number): ResearchId[] {
  const rows = db.prepare('SELECT research_id FROM research WHERE save_id = ? ORDER BY rowid').all(saveId) as { research_id: string }[];
  return rows.map(r => r.research_id).filter(isResearchId);
}

export function readForschung(db: DB, saveId: number): ForschungsStand {
  const save = readSave(db, saveId);
  const aktiv = isResearchId(save.research_active) ? save.research_active : null;
  return { fertig: readResearch(db, saveId), aktiv, endetAm: aktiv ? save.research_ends_at : 0 };
}

// Die Werte der Stadt zum Zeitpunkt "zeit" – mit allen fertigen Forschungen, Baustellen und Bauarbeitern
export function stadtWerte(db: DB, saveId: number, zeit: number): CityStats {
  return cityStats(readBuildings(db, saveId), readResearch(db, saveId), { zeit, bauarbeiter: readSave(db, saveId).bauarbeiter });
}

// ===== Aufgaben =====
// Die aktive Aufgabe ist die erste in QUESTS, die noch nicht erledigt ist.
export function readAufgabe(db: DB, saveId: number): AufgabenStand {
  const rows = db.prepare('SELECT quest_id, progress, completed FROM quests WHERE save_id = ?').all(saveId) as
    { quest_id: string; progress: number; completed: number }[];
  const erledigt = new Set(rows.filter(r => r.completed).map(r => r.quest_id));
  const nummer = QUESTS.findIndex(q => !erledigt.has(q.id));
  if (nummer < 0) return { nummer: QUESTS.length, id: null, zaehler: 0 };
  const id = QUESTS[nummer].id;
  return { nummer, id, zaehler: rows.find(r => r.quest_id === id)?.progress ?? 0 };
}

// Einen gefällten Baum / abgebauten Felsen für die aktive Aufgabe mitzählen
export function aufgabeZaehlen(db: DB, saveId: number, art: 'faellen' | 'abbauen'): void {
  const aufgabe = readAufgabe(db, saveId);
  const q = QUESTS[aufgabe.nummer];
  if (!q || q.ziel.art !== art) return;
  db.prepare(`INSERT INTO quests (save_id, quest_id, progress) VALUES (?, ?, 1)
    ON CONFLICT (save_id, quest_id) DO UPDATE SET progress = progress + 1`).run(saveId, q.id);
}

// Eine neue Stadt anlegen: Rathaus in die Mitte, Startrohstoffe, Bäume und Felsen
export function createSave(db: DB, cityName: string, now: number): number {
  const seed = Math.floor(Math.random() * 2 ** 31);
  const info = db.prepare('INSERT INTO game_saves (city_name, seed, last_calculated_at) VALUES (?, ?, ?)').run(cityName, seed, now);
  const saveId = Number(info.lastInsertRowid);
  writeStock(db, saveId, { ...START_RESOURCES });
  db.prepare('INSERT INTO buildings (save_id, building_type, x, y, level) VALUES (?, ?, ?, ?, 1)').run(saveId, 'townhall', TOWNHALL_POS.x, TOWNHALL_POS.y);
  for (const p of START_PARZELLEN) db.prepare('INSERT INTO plots (save_id, px, py) VALUES (?, ?, ?)').run(saveId, p.px, p.py);
  db.prepare('UPDATE game_saves SET last_regrow_at = ? WHERE id = ?').run(now, saveId);
  const addNode = db.prepare('INSERT INTO nodes (save_id, node_type, x, y, hits_left) VALUES (?, ?, ?, ?, ?)');
  for (const n of generateNodes(seed)) addNode.run(saveId, n.type, n.x, n.y, NODES[n.type].hits);
  return saveId;
}

export function deleteAllSaves(db: DB): void {
  db.prepare('DELETE FROM game_saves').run();
}

// Die Produktion bis "now" nachrechnen und speichern.
// Wird vor JEDER Aktion aufgerufen – so stimmen die Vorräte immer.
//
// Unterwegs ändert sich die Stadt: Eine Forschung wird fertig, eine Baustelle wird fertig …
// Darum rechnen wir in Abschnitten: von einem solchen Zeitpunkt zum nächsten, jedes Mal mit den
// Werten, die in diesem Abschnitt gelten.
export function settle(db: DB, saveId: number, now: number): OfflineReport {
  const save = readSave(db, saveId);
  const buildings = readBuildings(db, saveId);
  const fertig = readResearch(db, saveId);
  const vorher = readStock(db, saveId);
  const start = save.last_calculated_at;
  const sekunden = Math.min(Math.max(0, (now - start) / 1000), OFFLINE_LIMIT_SECONDS);
  const ende = start + sekunden * 1000; // bis hierhin wird gerechnet
  const forschung = isResearchId(save.research_active) && save.research_ends_at <= now ? save.research_active : null;

  // Alle Zeitpunkte, an denen sich etwas ändert
  const punkte = new Set<number>([ende]);
  if (forschung) punkte.add(Math.max(start, Math.min(save.research_ends_at, ende)));
  for (const b of buildings) if ((b.bauEnde ?? 0) > start && (b.bauEnde ?? 0) < ende) punkte.add(b.bauEnde!);

  let nachher = vorher;
  let zeit = start;
  for (const t of [...punkte].sort((a, b) => a - b)) {
    if (t <= zeit) continue;
    const jetztFertig = forschung && save.research_ends_at <= zeit ? [...fertig, forschung] : fertig;
    nachher = produce(nachher, cityStats(buildings, jetztFertig, { zeit, bauarbeiter: save.bauarbeiter }), (t - zeit) / 1000);
    zeit = t;
  }
  writeStock(db, saveId, nachher);
  if (forschung) {
    db.prepare('INSERT OR IGNORE INTO research (save_id, research_id) VALUES (?, ?)').run(saveId, forschung);
    db.prepare('UPDATE game_saves SET research_active = NULL, research_ends_at = 0 WHERE id = ?').run(saveId);
  }
  db.prepare('UPDATE game_saves SET last_calculated_at = ? WHERE id = ?').run(Math.max(now, start), saveId);

  lieferungenAuspacken(db, saveId, now);
  natureWaechst(db, saveId, now);
  return { seconds: Math.round(sekunden), gained: gainedBetween(vorher, readStock(db, saveId)) };
}

// ===== Natur wächst nach =====
// Alle 30 Sekunden wächst ein Baum (alle 90 ein Felsen) auf einem freien Feld deiner Stadt –
// bis es wieder genug gibt. So gehen dir nie die Bäume aus.
function natureWaechst(db: DB, saveId: number, now: number): void {
  const save = readSave(db, saveId);
  const seit = save.last_regrow_at || now - 5 * 60_000; // alter Spielstand: gleich ein paar Bäume schenken
  const stadt = readParzellen(db, saveId).filter(p => gebietVon(p.px, p.py) === 'stadt');
  const nodes = readNodes(db, saveId);
  const max = { tree: NACHWACHSEN.baeumeProParzelle * stadt.length, rock: NACHWACHSEN.felsenProParzelle * stadt.length };

  const belegt = new Set<string>([...readBuildings(db, saveId), ...nodes].map(f => `${f.x},${f.y}`));
  const freie: { x: number; y: number }[] = [];
  for (const p of stadt) for (let y = p.py * PARZELLE; y < (p.py + 1) * PARZELLE; y++) for (let x = p.px * PARZELLE; x < (p.px + 1) * PARZELLE; x++) {
    const nahRathaus = Math.max(Math.abs(x - TOWNHALL_POS.x), Math.abs(y - TOWNHALL_POS.y)) <= 2;
    if (!nahRathaus && !belegt.has(`${x},${y}`)) freie.push({ x, y });
  }
  const neu = db.prepare('INSERT INTO nodes (save_id, node_type, x, y, hits_left) VALUES (?, ?, ?, ?, ?)');
  // Feste Takte (alle 30 Sekunden seit 1970): so zählt jeder Takt genau einmal, egal wie oft abgeglichen wird
  const takt = NACHWACHSEN.baumAlleSekunden * 1000;
  const jederWievielte = Math.round(NACHWACHSEN.felsAlleSekunden / NACHWACHSEN.baumAlleSekunden);
  const anzahl = { tree: nodes.filter(n => n.type === 'tree').length, rock: nodes.filter(n => n.type === 'rock').length };
  const bis = Math.floor(now / takt);
  for (let n = Math.max(Math.floor(seit / takt) + 1, bis - 200); n <= bis; n++) {
    const arten: ('tree' | 'rock')[] = n % jederWievielte === 0 ? ['tree', 'rock'] : ['tree'];
    for (const typ of arten) {
      if (anzahl[typ] >= max[typ]) continue;
      const platz = nachwachsPlatz(freie, Math.random);
      if (!platz) break;
      freie.splice(freie.indexOf(platz), 1);
      neu.run(saveId, typ, platz.x, platz.y, NODES[typ].hits);
      anzahl[typ]++;
    }
  }
  db.prepare('UPDATE game_saves SET last_regrow_at = ? WHERE id = ?').run(now, saveId);
}

// ===== PC-Shop: angekommene Lieferungen auspacken =====
export function readBestellungen(db: DB, saveId: number): Bestellung[] {
  const rows = db.prepare('SELECT id, posten, bestellt_am, ankunft FROM shop_orders WHERE save_id = ? AND geliefert = 0 ORDER BY ankunft').all(saveId) as
    { id: number; posten: string; bestellt_am: number; ankunft: number }[];
  return rows.map(r => ({ id: r.id, posten: JSON.parse(r.posten), bestelltAm: r.bestellt_am, ankunft: r.ankunft }));
}

export function readBausaetze(db: DB, saveId: number): Partial<Record<BuildingType, number>> {
  const rows = db.prepare('SELECT building_type, anzahl FROM bausaetze WHERE save_id = ? AND anzahl > 0').all(saveId) as { building_type: string; anzahl: number }[];
  const b: Partial<Record<BuildingType, number>> = {};
  for (const r of rows) if (isBuildingType(r.building_type)) b[r.building_type] = r.anzahl;
  return b;
}

function lieferungenAuspacken(db: DB, saveId: number, now: number): void {
  for (const b of readBestellungen(db, saveId)) {
    if (b.ankunft > now) continue;
    const ware: Amounts = {};
    for (const [id, anzahl] of Object.entries(b.posten) as [ShopId, number][]) {
      if (!isShopId(id)) continue;
      const a = SHOP[id];
      for (const [r, m] of Object.entries(a.inhalt ?? {}) as [keyof Stock, number][]) ware[r] = (ware[r] ?? 0) + m * anzahl;
      if (a.bausatz) {
        db.prepare(`INSERT INTO bausaetze (save_id, building_type, anzahl) VALUES (?, ?, ?)
          ON CONFLICT (save_id, building_type) DO UPDATE SET anzahl = anzahl + excluded.anzahl`).run(saveId, a.bausatz, bausatzMenge(id) * anzahl);
      }
    }
    gutschreiben(db, saveId, ware, now);
    db.prepare('UPDATE shop_orders SET geliefert = 1 WHERE id = ?').run(b.id);
  }
}

// Erfahrung dazuzählen – vielleicht gibt es ein neues Level
export function addXp(db: DB, saveId: number, amount: number): GameEvents {
  const save = readSave(db, saveId);
  const xp = save.experience + amount;
  const level = levelForXp(xp);
  db.prepare('UPDATE game_saves SET experience = ?, level = ? WHERE id = ?').run(xp, level, saveId);
  if (level <= save.level) return {};
  const unlocked = (Object.keys(BUILDINGS) as BuildingType[])
    .filter(t => BUILDINGS[t].buildable && BUILDINGS[t].unlockLevel > save.level && BUILDINGS[t].unlockLevel <= level);
  return { levelUp: level, unlocked };
}

export function loadState(db: DB, saveId: number, now: number): GameState {
  const save = readSave(db, saveId);
  const buildings = readBuildings(db, saveId);
  const forschung = readForschung(db, saveId);
  const parzellen = readParzellen(db, saveId);
  const bestellt = (db.prepare('SELECT COUNT(*) AS n FROM shop_orders WHERE save_id = ?').get(saveId) as { n: number }).n;
  return {
    save: { id: save.id, cityName: save.city_name, level: save.level, experience: save.experience, lastCalculatedAt: save.last_calculated_at },
    resources: readStock(db, saveId),
    buildings,
    nodes: readNodes(db, saveId),
    stats: cityStats(buildings, forschung.fertig, { zeit: now, bauarbeiter: save.bauarbeiter }),
    forschung,
    aufgabe: readAufgabe(db, saveId),
    blackjack: blackjackStand(db, saveId),
    land: { parzellen, industrie: parzellen.some(p => gebietVon(p.px, p.py) === 'industrie') },
    personal: { bauarbeiter: save.bauarbeiter },
    buergermeister: { ausgeruhtBis: save.ausgeruht_bis, sattBis: save.satt_bis, gelesenAm: save.gelesen_am, outfit: leseOutfit(save.outfit) },
    shop: { bestellungen: readBestellungen(db, saveId), bausaetze: readBausaetze(db, saveId), bestellt },
    serverTime: now
  };
}
