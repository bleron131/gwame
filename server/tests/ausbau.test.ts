import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BUILDINGS, INDUSTRIE, NACHWACHSEN, SHOP, TOWNHALL_POS, ausbaustufe, bauzeit, cityStats, einwohner, landPreis,
  lieferzeitSekunden, upgradeCost, xpForLevel, type Karte, type Rang
} from '@empire/shared';
import { openDb, type DB } from '../src/db/db';
import { runAction } from '../src/services/actionRunner';
import { blackjackHalten, blackjackTeilen } from '../src/services/blackjackService';
import { build, hammer, upgrade } from '../src/services/buildingService';
import { industrieFreischalten, landKaufen } from '../src/services/landService';
import { arbeiterAnstellen, bauarbeiterAnstellen } from '../src/services/personalService';
import { bestellen } from '../src/services/shopService';
import { createSave, loadState, readStock, settle, writeStock } from '../src/services/saveService';

// Tests für: Nachwachsen, Bauzeit, Personal, Land, Industrie, Shop, Häuser, Blackjack-Teilen
let jetzt = 1_700_000_000_000;
let db: DB, id: number;
const SEK = 1000, MIN = 60 * SEK;
const tun = (f: () => unknown) => runAction(db, id, undefined, jetzt, () => { f(); });
const zustand = () => loadState(db, id, jetzt);
const levelSetzen = (l: number) => db.prepare('UPDATE game_saves SET level = ?, experience = ? WHERE id = ?').run(l, xpForLevel(l), id);
const reich = () => writeStock(db, id, { gold: 50000, wood: 290, stone: 290, planks: 290, steel: 200, machines: 50 });
const platzMachen = () => db.prepare('DELETE FROM nodes WHERE save_id = ?').run(id);
const warten = (ms: number) => { jetzt += ms; settle(db, id, jetzt); };
const fertig = () => db.prepare('UPDATE buildings SET bau_ende = 0').run();

beforeEach(() => {
  jetzt = 1_700_000_000_000;
  db = openDb(':memory:');
  id = createSave(db, 'Teststadt', jetzt);
});
afterEach(() => db.close());

describe('Natur wächst nach', () => {
  it('nach dem Abholzen wachsen Bäume und Felsen wieder – aber nicht unendlich', () => {
    platzMachen();
    warten(10 * MIN);
    const st = zustand();
    const baeume = st.nodes.filter(n => n.type === 'tree').length, felsen = st.nodes.filter(n => n.type === 'rock').length;
    expect(baeume).toBe(NACHWACHSEN.baeumeProParzelle * 4);   // 20 Takte, aber höchstens 16 Bäume
    expect(felsen).toBeGreaterThan(0);
    expect(felsen).toBeLessThanOrEqual(NACHWACHSEN.felsenProParzelle * 4);
    // Nie auf Gebäuden oder direkt am Rathaus
    for (const n of st.nodes) {
      expect(st.buildings.some(b => b.x === n.x && b.y === n.y)).toBe(false);
      expect(Math.max(Math.abs(n.x - TOWNHALL_POS.x), Math.abs(n.y - TOWNHALL_POS.y))).toBeGreaterThan(2);
    }
    warten(30 * MIN);
    expect(zustand().nodes.filter(n => n.type === 'tree').length).toBe(NACHWACHSEN.baeumeProParzelle * 4);
  });

  it('häufiges Abgleichen ändert nichts am Tempo (ein Baum alle 30 Sekunden)', () => {
    platzMachen();
    for (let k = 0; k < 12; k++) warten(10 * SEK); // 2 Minuten in kleinen Schritten
    const baeume = zustand().nodes.filter(n => n.type === 'tree').length;
    expect(baeume).toBeGreaterThanOrEqual(3);
    expect(baeume).toBeLessThanOrEqual(5);
  });
});

describe('Bauzeit, Mithelfen und Bauarbeiter', () => {
  beforeEach(() => { platzMachen(); reich(); });

  it('eine Baustelle produziert erst, wenn sie fertig ist', () => {
    const r = runAction(db, id, undefined, jetzt, () => build(db, id, 'lumberjack', 0, 0, jetzt));
    expect(r.events?.bauEnde).toBe(jetzt + 6 * SEK);
    writeStock(db, id, { wood: 0 });
    warten(66 * SEK); // 6 Sekunden Bau, dann 60 Sekunden Arbeit
    expect(readStock(db, id).wood).toBeCloseTo(12, 5);
    // Verbessern: während des Baus gilt noch das alte Level
    reich();
    tun(() => upgrade(db, id, zustand().buildings.find(b => b.type === 'lumberjack')!.id, jetzt));
    expect(() => tun(() => upgrade(db, id, zustand().buildings.find(b => b.type === 'lumberjack')!.id, jetzt))).toThrow(/noch gebaut/);
    expect(zustand().stats.ratesPerMinute.wood).toBeCloseTo(12, 5);
  });

  it('der Bürgermeister hilft mit: jeder Schlag spart 2 Sekunden', () => {
    tun(() => build(db, id, 'house', 0, 0, jetzt));
    const haus = zustand().buildings.find(b => b.type === 'house')!;
    jetzt += 1000;
    tun(() => hammer(db, id, haus.id, jetzt));
    expect(zustand().buildings.find(b => b.id === haus.id)!.bauEnde).toBe(haus.bauEnde! - 2 * SEK);
    expect(() => tun(() => hammer(db, id, haus.id, jetzt + 100))).toThrow(/schnell/);
  });

  it('Bauarbeiter machen das Bauen schneller und kosten Lohn', () => {
    levelSetzen(3);
    tun(() => bauarbeiterAnstellen(db, id, jetzt));
    tun(() => bauarbeiterAnstellen(db, id, jetzt));
    expect(zustand().personal.bauarbeiter).toBe(2);
    const r = runAction(db, id, undefined, jetzt, () => build(db, id, 'sawmill', 0, 0, jetzt));
    expect(r.events?.bauEnde).toBe(jetzt + bauzeit('sawmill', 1, 2) * SEK);
    expect(bauzeit('sawmill', 1, 2)).toBeLessThan(bauzeit('sawmill', 1, 0));
    expect(zustand().stats.loehneProMinute).toBe(4);
  });
});

describe('Arbeiter anstellen', () => {
  beforeEach(() => { platzMachen(); reich(); });

  it('jeder Arbeiter bringt +25 %, höchstens 3 pro Gebäude, und nur mit freien Einwohnern', () => {
    tun(() => build(db, id, 'lumberjack', 0, 0, jetzt)); fertig();
    const hf = zustand().buildings.find(b => b.type === 'lumberjack')!;
    tun(() => arbeiterAnstellen(db, id, hf.id, jetzt));
    expect(zustand().stats.ratesPerMinute.wood).toBeCloseTo(12 * 1.25, 5);
    expect(zustand().stats.loehneProMinute).toBe(1);
    tun(() => arbeiterAnstellen(db, id, hf.id, jetzt));
    tun(() => arbeiterAnstellen(db, id, hf.id, jetzt));
    expect(() => tun(() => arbeiterAnstellen(db, id, hf.id, jetzt))).toThrow(/besetzt/);
    // Die Stadt hat 5 Einwohner: 3 arbeiten hier, dazu 2 Bauarbeiter – dann ist niemand mehr frei
    tun(() => bauarbeiterAnstellen(db, id, jetzt));
    tun(() => bauarbeiterAnstellen(db, id, jetzt));
    tun(() => build(db, id, 'lumberjack', 1, 0, jetzt)); fertig();
    const zweiter = zustand().buildings.filter(b => b.type === 'lumberjack')[1];
    expect(() => tun(() => arbeiterAnstellen(db, id, zweiter.id, jetzt))).toThrow(/Arbeit/);
  });
});

describe('Land und Industrie', () => {
  beforeEach(() => { reich(); });

  it('Land am Rand kaufen: nur angrenzend, ab Level 2, wird teurer', () => {
    expect(() => tun(() => landKaufen(db, id, 2, 0))).toThrow(/Level 2/);
    levelSetzen(2);
    expect(() => tun(() => landKaufen(db, id, -1, -1))).toThrow(/grenzt/); // nur über Eck – zählt nicht
    expect(() => tun(() => build(db, id, 'house', 16, 3, jetzt))).toThrow(/gehört dir noch nicht/);
    const vorher = readStock(db, id).gold;
    tun(() => landKaufen(db, id, 2, 0));
    expect(readStock(db, id).gold).toBe(vorher - landPreis(0).gold!);
    expect(zustand().land.parzellen).toHaveLength(5);
    // Jetzt kann man dort bauen (wenn das Feld frei ist)
    db.prepare('DELETE FROM nodes WHERE x = 16 AND y = 3').run();
    tun(() => build(db, id, 'house', 16, 3, jetzt));
    expect(landPreis(1).gold).toBeGreaterThan(landPreis(0).gold!);
    expect(() => tun(() => landKaufen(db, id, 2, 0))).toThrow(/schon/);
  });

  it('Industrie: sichtbar, aber erst mit Level, Einwohnern und Bäckerei + Sägewerk', () => {
    expect(() => tun(() => industrieFreischalten(db, id, jetzt))).toThrow(/Level 6/);
    levelSetzen(INDUSTRIE.level);
    platzMachen();
    // Viele Häuser auf hohem Level, dazu Sägewerk und Bäckerei
    for (let x = 0; x < 4; x++) db.prepare("INSERT INTO buildings (save_id, building_type, x, y, level) VALUES (?, 'house', ?, 0, 4)").run(id, x);
    expect(() => tun(() => industrieFreischalten(db, id, jetzt))).toThrow(/Bäckerei/);
    db.prepare("INSERT INTO buildings (save_id, building_type, x, y, level) VALUES (?, 'sawmill', 0, 2, 1)").run(id);
    db.prepare("INSERT INTO buildings (save_id, building_type, x, y, level) VALUES (?, 'bakery', 1, 2, 1)").run(id);
    expect(() => tun(() => build(db, id, 'mine', 3, 3, jetzt))).toThrow(/Industrie-Gebiet/);
    tun(() => industrieFreischalten(db, id, jetzt));
    expect(zustand().land.industrie).toBe(true);
    reich();
    // Industrie-Gebäude nur in der Industrie, Stadt-Gebäude nicht in der Industrie
    tun(() => build(db, id, 'mine', 25, 2, jetzt));
    expect(() => tun(() => build(db, id, 'house', 26, 2, jetzt))).toThrow(/Stadt/);
    fertig();
    expect(zustand().stats.ratesPerMinute.ore).toBeCloseTo(10, 5);
  });
});

describe('PC-Shop', () => {
  beforeEach(() => { platzMachen(); writeStock(db, id, { gold: 2000 }); });

  it('bestellen, bezahlen, nach der Lieferzeit ankommen', () => {
    const vorher = readStock(db, id);
    tun(() => bestellen(db, id, { holz: 2, fertighaus: 1 }, jetzt));
    const st = zustand();
    expect(st.resources.gold).toBe(vorher.gold - 2 * SHOP.holz.preis - SHOP.fertighaus.preis);
    expect(st.shop.bestellungen).toHaveLength(1);
    expect(st.shop.bestellungen[0].ankunft).toBe(jetzt + lieferzeitSekunden(3) * SEK);
    warten(10 * SEK);
    expect(readStock(db, id).wood).toBe(vorher.wood); // noch unterwegs
    warten(lieferzeitSekunden(3) * SEK);
    const da = zustand();
    expect(da.shop.bestellungen).toHaveLength(0);
    expect(da.resources.wood).toBe(Math.min(vorher.wood + 120, da.stats.capacity.wood!));
    expect(da.shop.bausaetze.house).toBe(1);
    expect(da.shop.bestellt).toBe(1);
    // Der Bausatz ist sofort fertig gebaut und kostet nichts
    platzMachen(); // (in der Wartezeit sind Bäume nachgewachsen – vielleicht genau hier)
    const gold = da.resources.gold;
    tun(() => build(db, id, 'house', 0, 0, jetzt, true));
    const haus = zustand().buildings.find(b => b.type === 'house')!;
    expect(haus.bauEnde).toBe(0);
    expect(readStock(db, id).gold).toBeCloseTo(gold, 5);
    expect(() => tun(() => build(db, id, 'house', 1, 0, jetzt, true))).toThrow(/Bausatz/);
  });

  it('falsche Warenkörbe werden abgelehnt', () => {
    expect(() => tun(() => bestellen(db, id, {}, jetzt))).toThrow(/leer/);
    expect(() => tun(() => bestellen(db, id, { raumschiff: 1 }, jetzt))).toThrow(/gibt es nicht/);
    expect(() => tun(() => bestellen(db, id, { holz: 11 }, jetzt))).toThrow(/Höchstens/);
    expect(() => tun(() => bestellen(db, id, { stahl: 1 }, jetzt))).toThrow(/Level 6/);
    for (let k = 0; k < 3; k++) tun(() => bestellen(db, id, { holz: 1 }, jetzt));
    expect(() => tun(() => bestellen(db, id, { holz: 1 }, jetzt))).toThrow(/Lieferwagen/);
  });
});

describe('Häuser wachsen', () => {
  it('Wohnhaus → Mehrfamilienhaus → Wohnblock mit mehr Einwohnern und Zusatzkosten', () => {
    expect(ausbaustufe('house', 4).name).toBe('Wohnhaus');
    expect(ausbaustufe('house', 5).name).toBe('Mehrfamilienhaus');
    expect(ausbaustufe('house', 8).name).toBe('Wohnblock');
    expect(einwohner('house', 10)).toBeGreaterThan(einwohner('house', 5) * 2);
    expect(upgradeCost('house', 3).planks).toBeUndefined();
    expect(upgradeCost('house', 4).planks).toBe(30);          // auf Level 5: Bretter nötig
    expect(upgradeCost('house', 7).machines).toBe(8);         // auf Level 8: Maschinen nötig
    const st = cityStats([{ id: 1, type: 'house', x: 0, y: 0, level: 8 }]);
    expect(st.population).toBe(5 + einwohner('house', 8));
    expect(BUILDINGS.house.maxLevel).toBe(10);
  });
});

describe('Blackjack – Teilen und Statistik', () => {
  const k = (...r: Rang[]): Karte[] => r.map(rang => ({ rang, farbe: '♥' }));
  it('zwei Achter teilen: zwei Hände mit eigenem Einsatz, die Statistik zählt mit', () => {
    db.prepare("INSERT INTO buildings (save_id, building_type, x, y, level) VALUES (?, 'casino', 0, 0, 1)").run(id);
    writeStock(db, id, { gold: 1000 });
    // Stapel wird von hinten gezogen: erste Hand bekommt 3 (=11), zweite Hand bekommt K (=18), Bank zieht 10 (=26)
    db.prepare('INSERT INTO blackjack_games (save_id, data) VALUES (?, ?)').run(id, JSON.stringify({
      rohstoff: 'gold', haende: [{ karten: k('8', '8'), einsatz: 50, verdoppelt: false, fertig: false, ergebnis: null, ausgezahlt: 0 }],
      aktiv: 0, geteilt: false, bank: k('10', '6'), stapel: k('10', 'K', '3'), laeuft: true
    }));
    tun(() => blackjackTeilen(db, id, jetzt));
    let r = zustand().blackjack.runde!;
    expect(r.haende).toHaveLength(2);
    expect(r.haende[0].karten).toEqual(k('8', '3'));
    expect(readStock(db, id).gold).toBe(950); // zweiter Einsatz bezahlt
    tun(() => blackjackHalten(db, id, jetzt)); // Hand 1: 11 – halten (mutig!)
    r = zustand().blackjack.runde!;
    expect(r.aktiv).toBe(1);
    expect(r.haende[1].karten).toEqual(k('8', 'K'));
    tun(() => blackjackHalten(db, id, jetzt)); // Hand 2: 18 – halten, jetzt zieht die Bank
    const st = zustand().blackjack;
    expect(st.runde!.laeuft).toBe(false);
    expect(st.runde!.bank).toEqual(k('10', '6', '10'));
    expect(st.runde!.haende.map(h => h.ergebnis)).toEqual(['gewonnen', 'gewonnen']);
    expect(readStock(db, id).gold).toBe(950 + 200);
    expect(st.statistik.runden).toBe(1);
    expect(st.statistik.siege).toBe(2);
    expect(st.statistik.bilanz.gold).toBe(100);
    expect(st.statistik.besterGewinn).toEqual({ menge: 100, rohstoff: 'gold' });
  });
});

describe('Blackjack – alte Runde (vor dem Teilen)', () => {
  it('eine laufende Runde im alten Format kann man zu Ende spielen', () => {
    writeStock(db, id, { gold: 1000 });
    const k = (...r: Rang[]): Karte[] => r.map(rang => ({ rang, farbe: '♠' }));
    db.prepare('INSERT INTO blackjack_games (save_id, data) VALUES (?, ?)').run(id, JSON.stringify({
      rohstoff: 'gold', einsatz: 20, spieler: k('10', '9'), bank: k('10', '6'), stapel: k('K'), laeuft: true, verdoppelt: false, ergebnis: null, ausgezahlt: 0
    }));
    expect(zustand().blackjack.runde?.haende[0].karten).toEqual(k('10', '9'));
    tun(() => blackjackHalten(db, id, jetzt));
    expect(zustand().blackjack.runde?.haende[0].ergebnis).toBe('gewonnen');
    expect(readStock(db, id).gold).toBe(1040);
  });
});
