import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AUSRUHEN, BACKEN, MOEBEL, RAEUME, cityStats, einwohner, gemuetlichkeit, raumFuerHaus } from '@empire/shared';
import { openDb, type DB } from '../src/db/db';
import { runAction } from '../src/services/actionRunner';
import { blackjackHalten } from '../src/services/blackjackService';
import { hammer } from '../src/services/buildingService';
import { harvest } from '../src/services/harvestService';
import { ausruhen, benutzen, einrichten, essen, lesen, umziehen } from '../src/services/innenService';
import { createSave, loadState, readStock, writeStock } from '../src/services/saveService';

// Tests für Innenräume: einrichten, ausruhen, essen, lesen, umziehen, Bauernhof und Bäckerei
let jetzt = 1_700_000_000_000;
let db: DB, id: number, haus: number;
const tun = (f: () => unknown) => runAction(db, id, undefined, jetzt, () => { f(); });
const zustand = () => loadState(db, id, jetzt);
const neu = (typ: string, x: number, level = 1) =>
  Number(db.prepare('INSERT INTO buildings (save_id, building_type, x, y, level) VALUES (?, ?, ?, 0, ?)').run(id, typ, x, level).lastInsertRowid);

beforeEach(() => {
  jetzt = 1_700_000_000_000;
  db = openDb(':memory:');
  id = createSave(db, 'Innenstadt', jetzt);
  db.prepare('DELETE FROM nodes').run();
  writeStock(db, id, { gold: 2000, planks: 200, stone: 100, bread: 10, flour: 10 });
  haus = neu('house', 0);
});
afterEach(() => db.close());

describe('Einrichten', () => {
  it('Möbel kosten, machen das Haus gemütlich – und bringen mehr Einwohner', () => {
    const vorher = zustand().stats.population;
    tun(() => einrichten(db, id, haus, 0, 'sofa', jetzt));
    tun(() => einrichten(db, id, haus, 1, 'fernseher', jetzt));
    const st = zustand();
    expect(st.buildings.find(b => b.id === haus)!.einrichtung).toEqual({ 0: 'sofa', 1: 'fernseher' });
    expect(st.resources.gold).toBe(2000 - 60 - 200);
    expect(gemuetlichkeit({ 0: 'sofa', 1: 'fernseher' })).toBe(6);
    expect(st.stats.population).toBe(5 + Math.round(einwohner('house', 1) * 1.24));
    expect(st.stats.population).toBeGreaterThan(vorher);
    // Doppelt belegen geht nicht, falsche Plätze auch nicht
    expect(() => tun(() => einrichten(db, id, haus, 0, 'stuhl', jetzt))).toThrow(/schon etwas/);
    expect(() => tun(() => einrichten(db, id, haus, RAEUME.klein.stellplaetze.length, 'stuhl', jetzt))).toThrow(/Platz/);
    expect(() => tun(() => einrichten(db, id, haus, 2, 'raketenbett', jetzt))).toThrow(/gibt es nicht/);
    // Wegräumen: die Hälfte zurück
    const gold = readStock(db, id).gold;
    tun(() => einrichten(db, id, haus, 1, null, jetzt));
    expect(readStock(db, id).gold).toBe(gold + MOEBEL.fernseher.kosten.gold! / 2);
    expect(zustand().buildings.find(b => b.id === haus)!.einrichtung).toEqual({ 0: 'sofa' });
  });

  it('nur in Wohnhäusern – und grössere Häuser haben mehr Platz', () => {
    const hof = neu('farm', 1);
    expect(() => tun(() => einrichten(db, id, hof, 0, 'sofa', jetzt))).toThrow(/Wohnhaus/);
    expect(raumFuerHaus(5).stellplaetze.length).toBeGreaterThan(raumFuerHaus(1).stellplaetze.length);
    expect(raumFuerHaus(9).stellplaetze.length).toBeGreaterThan(raumFuerHaus(6).stellplaetze.length);
    // Gemütlichkeit hat eine Obergrenze (+60 %)
    const voll = cityStats([{ id: 1, type: 'house', x: 0, y: 0, level: 1, einrichtung: { 0: 'designsofa', 1: 'designsofa', 2: 'designsofa', 3: 'designsofa' } }]);
    expect(voll.population).toBe(5 + Math.round(einwohner('house', 1) * 1.6));
  });
});

describe('Ausruhen, essen, lesen, umziehen', () => {
  it('ausgeruht gibt es doppelten Ertrag beim Fällen und Mithelfen', () => {
    tun(() => ausruhen(db, id, haus, jetzt));
    expect(zustand().buergermeister.ausgeruhtBis).toBe(jetzt + AUSRUHEN.minuten * 60_000);
    db.prepare("INSERT INTO nodes (save_id, node_type, x, y, hits_left) VALUES (?, 'tree', 3, 3, 3)").run(id);
    const baum = zustand().nodes.find(n => n.x === 3)!;
    jetzt += 1000;
    const r = runAction(db, id, undefined, jetzt, () => harvest(db, id, baum.id, jetzt));
    expect(r.events?.gained?.wood).toBe(10);
    // Mithelfen: 4 statt 2 Sekunden
    db.prepare('UPDATE buildings SET bau_ende = ? WHERE id = ?').run(jetzt + 60_000, haus);
    jetzt += 1000;
    tun(() => hammer(db, id, haus, jetzt));
    expect(zustand().buildings.find(b => b.id === haus)!.bauEnde).toBe(jetzt - 1000 + 60_000 - 4000);
    // Nach 5 Minuten ist es vorbei
    db.prepare('UPDATE buildings SET bau_ende = 0').run();
    jetzt += 6 * 60_000;
    db.prepare("INSERT INTO nodes (save_id, node_type, x, y, hits_left) VALUES (?, 'tree', 4, 4, 3)").run(id);
    const zweiter = zustand().nodes.find(n => n.x === 4 && n.y === 4)!;
    expect(runAction(db, id, undefined, jetzt, () => harvest(db, id, zweiter.id, jetzt)).events?.gained?.wood).toBe(5);
  });

  it('essen braucht Küche und Brot, lesen ein Regal, umziehen einen Schrank', () => {
    expect(() => tun(() => essen(db, id, haus, jetzt))).toThrow(/Küche/);
    tun(() => einrichten(db, id, haus, 0, 'kueche', jetzt));
    tun(() => essen(db, id, haus, jetzt));
    expect(readStock(db, id).bread).toBe(8);
    expect(zustand().buergermeister.sattBis).toBeGreaterThan(jetzt);

    expect(() => tun(() => lesen(db, id, haus, jetzt))).toThrow(/Bücherregal/);
    tun(() => einrichten(db, id, haus, 1, 'buecherregal', jetzt));
    const xp = zustand().save.experience;
    tun(() => lesen(db, id, haus, jetzt));
    expect(zustand().save.experience).toBe(xp + 20);
    expect(() => tun(() => lesen(db, id, haus, jetzt + 1000))).toThrow(/gerade erst/);

    const outfit = { jacke: '#8e2b2b', hut: 'kappe', hutFarbe: '#2e6b3a' };
    expect(() => tun(() => umziehen(db, id, haus, outfit, jetzt))).toThrow(/Kleiderschrank/);
    tun(() => einrichten(db, id, haus, 2, 'kleiderschrank', jetzt));
    tun(() => umziehen(db, id, haus, outfit, jetzt));
    expect(zustand().buergermeister.outfit).toEqual(outfit);
    expect(() => tun(() => umziehen(db, id, haus, { jacke: 'pink', hut: 'krone', hutFarbe: 'x' }, jetzt))).toThrow(/Kleidung/);
  });
});

describe('Bauernhof und Bäckerei von innen', () => {
  it('Getreide abfüllen und selbst Brot backen – mit Wartezeit', () => {
    const hof = neu('farm', 1, 2);
    const baeckerei = neu('bakery', 2);
    const vorher = readStock(db, id);
    tun(() => benutzen(db, id, hof, jetzt));
    expect(readStock(db, id).grain).toBe(vorher.grain + 30);
    expect(() => tun(() => benutzen(db, id, hof, jetzt + 1000))).toThrow(/Gleich wieder/);
    tun(() => benutzen(db, id, baeckerei, jetzt));
    expect(readStock(db, id).flour).toBe(vorher.flour - BACKEN.mehl);
    expect(readStock(db, id).bread).toBe(vorher.bread + BACKEN.brot);
    expect(() => tun(() => benutzen(db, id, haus, jetzt))).toThrow(/nichts zu tun/);
  });
});

describe('Blackjack-Bestenliste', () => {
  it('merkt sich die grössten Gewinne', () => {
    neu('casino', 5);
    const k = (...r: string[]) => r.map(rang => ({ rang, farbe: '♠' }));
    for (const einsatz of [10, 50, 30]) {
      db.prepare('INSERT OR REPLACE INTO blackjack_games (save_id, data) VALUES (?, ?)').run(id, JSON.stringify({
        rohstoff: 'gold', haende: [{ karten: k('10', '9'), einsatz, verdoppelt: false, fertig: false, ergebnis: null, ausgezahlt: 0 }],
        aktiv: 0, geteilt: false, bank: k('10', '6'), stapel: k('K'), laeuft: true
      }));
      tun(() => blackjackHalten(db, id, jetzt));
    }
    expect(zustand().blackjack.statistik.besteGewinne.map(g => g.menge)).toEqual([50, 30, 10]);
  });
});
