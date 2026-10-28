import { useState } from 'react';
import {
  BUILDINGS, MAX_BAUARBEITER, MAX_OFFENE_BESTELLUNGEN, MAX_PRO_ARTIKEL, SHOP, SHOP_IDS, alleParzellen, bauarbeiterPreis,
  canAfford, kaufbar, landPreis, lieferzeitSekunden, parzellenSchluessel,
  type BuildingType, type GameState, type Parzelle, type ShopArtikel, type ShopId, type Stock
} from '@empire/shared';
import { dauer, mengenText, zahl } from '../game/format';
import { Kosten } from './Kosten';
import { gekauftAnzahl, richtung } from './LandMenue';

type Reiter = 'shop' | 'lieferungen' | 'personal' | 'land';
const KATEGORIEN: { id: ShopArtikel['kategorie']; name: string }[] = [
  { id: 'material', name: '🧱 Baumaterial' }, { id: 'nahrung', name: '🍞 Nahrung' },
  { id: 'bausatz', name: '📦 Fertig-Bausätze (sofort gebaut)' }, { id: 'industrie', name: '🏭 Industrie' }
];

// Der Computer im Rathaus: Online-Shop, Lieferungen, Personal und Land
export function PcFenster({ state, vorrat, jetzt, onBestellen, onAufstellen, onBauarbeiter, onLand, onIndustrie, onZu }: {
  state: GameState; vorrat: Stock; jetzt: number;
  onBestellen: (korb: Partial<Record<ShopId, number>>) => Promise<boolean>;
  onAufstellen: (t: BuildingType) => void;
  onBauarbeiter: (mehr: boolean) => void;
  onLand: (p: Parzelle) => void;
  onIndustrie: () => void;
  onZu: () => void;
}) {
  const [reiter, setReiter] = useState<Reiter>('shop');
  const [korb, setKorb] = useState<Partial<Record<ShopId, number>>>({});
  const stueck = Object.values(korb).reduce((s, n) => s + (n ?? 0), 0);
  const summe = SHOP_IDS.reduce((s, id) => s + (korb[id] ?? 0) * SHOP[id].preis, 0);
  const offen = state.shop.bestellungen.length;
  const kannBestellen = stueck > 0 && vorrat.gold + 1e-9 >= summe && offen < MAX_OFFENE_BESTELLUNGEN;
  const aendern = (id: ShopId, d: number) => setKorb(k => ({ ...k, [id]: Math.max(0, Math.min(MAX_PRO_ARTIKEL, (k[id] ?? 0) + d)) }));
  const bausaetze = Object.entries(state.shop.bausaetze) as [BuildingType, number][];

  return (
    <div className="fenster-hinter">
      <div className="pc">
        <div className="pc-leiste">
          <b>💻 Empire-PC</b>
          <button className="zu" onClick={onZu} aria-label="Schliessen">✕</button>
        </div>
        <div className="pc-reiter">
          {([['shop', '🛒 Shop'], ['lieferungen', `📦 Lieferungen${offen || bausaetze.length ? ` (${offen + bausaetze.length})` : ''}`], ['personal', '👷 Personal'], ['land', '🗺️ Land']] as [Reiter, string][]).map(([id, name]) => (
            <button key={id} className={reiter === id ? 'an' : ''} onClick={() => setReiter(id)}>{name}</button>
          ))}
        </div>

        <div className="pc-inhalt">
          {reiter === 'shop' && (
            <>
              {KATEGORIEN.map(kat => {
                const artikel = SHOP_IDS.filter(id => SHOP[id].kategorie === kat.id);
                return (
                  <div key={kat.id}>
                    <h3>{kat.name}</h3>
                    <div className="artikel-liste">
                      {artikel.map(id => {
                        const a = SHOP[id];
                        const gesperrt = state.save.level < a.abLevel || (a.industrie && !state.land.industrie);
                        return (
                          <div key={id} className={'artikel' + (gesperrt ? ' gesperrt' : '') + (korb[id] ? ' im-korb' : '')}>
                            <div className="artikel-icon">{a.icon}</div>
                            <b>{a.name}</b>
                            <small>{a.text}</small>
                            <span className="preis">🪙 {zahl(a.preis)}</span>
                            {gesperrt
                              ? <span className="schloss">🔒 {a.industrie && !state.land.industrie ? 'Industrie' : `Level ${a.abLevel}`}</span>
                              : (
                                <div className="anzahl">
                                  <button onClick={() => aendern(id, -1)} disabled={!korb[id]}>−</button>
                                  <b>{korb[id] ?? 0}</b>
                                  <button onClick={() => aendern(id, 1)}>+</button>
                                </div>
                              )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {reiter === 'lieferungen' && (
            <>
              <h3>🚚 Unterwegs</h3>
              {offen === 0 && <p className="leer">Gerade ist nichts unterwegs. Bestell etwas im 🛒 Shop!</p>}
              {state.shop.bestellungen.map(b => {
                const rest = Math.max(0, (b.ankunft - jetzt) / 1000);
                const k = Math.min(1, (jetzt - b.bestelltAm) / Math.max(1, b.ankunft - b.bestelltAm));
                return (
                  <div key={b.id} className="karte">
                    <div className="karte-icon">🚚</div>
                    <div className="karte-text">
                      <b>{Object.entries(b.posten).map(([id, n]) => `${n}× ${SHOP[id as ShopId].name}`).join(', ')}</b>
                      <div className="balken"><i style={{ width: k * 100 + '%' }} /></div>
                      <span>{rest > 0 ? `Ankunft in ${dauer(rest)}` : 'Gleich da …'}</span>
                    </div>
                  </div>
                );
              })}
              <h3>📦 Deine Bausätze</h3>
              {bausaetze.length === 0 && <p className="leer">Keine Bausätze. Fertig-Bausätze sind sofort gebaut – ohne Wartezeit!</p>}
              {bausaetze.map(([t, n]) => (
                <div key={t} className="karte">
                  <div className="karte-icon">{BUILDINGS[t].icon}</div>
                  <div className="karte-text"><b>{n}× {BUILDINGS[t].name}</b><span>Sofort fertig, kostet nichts mehr</span></div>
                  <button className="knopf" onClick={() => onAufstellen(t)}>Aufstellen</button>
                </div>
              ))}
            </>
          )}

          {reiter === 'personal' && (
            <>
              <div className="werte">
                <div><small>Einwohner</small><b>👥 {state.stats.population}</b></div>
                <div><small>Davon angestellt</small><b>👷 {state.stats.angestellte}</b></div>
                <div><small>Löhne</small><b>🪙 −{zahl(state.stats.loehneProMinute)}/Min.</b></div>
                <div><small>Frei</small><b>{state.stats.population - state.stats.angestellte}</b></div>
              </div>
              <h3>👷 Bauarbeiter</h3>
              <div className="karte">
                <div className="karte-icon">👷</div>
                <div className="karte-text">
                  <b>{state.personal.bauarbeiter} von {MAX_BAUARBEITER} Bauarbeitern</b>
                  <span>Jeder Bauarbeiter macht neue Baustellen 30 % schneller. Lohn: 2 🪙/Min.</span>
                  {state.personal.bauarbeiter < MAX_BAUARBEITER && <Kosten kosten={bauarbeiterPreis(state.personal.bauarbeiter)} vorrat={vorrat} />}
                </div>
                <div className="knopf-spalte">
                  <button className={'knopf' + (state.personal.bauarbeiter < MAX_BAUARBEITER && canAfford(vorrat, bauarbeiterPreis(state.personal.bauarbeiter)) ? '' : ' aus')}
                    disabled={state.personal.bauarbeiter >= MAX_BAUARBEITER} onClick={() => onBauarbeiter(true)}>Anstellen</button>
                  {state.personal.bauarbeiter > 0 && <button className="knopf leise" onClick={() => onBauarbeiter(false)}>Entlassen</button>}
                </div>
              </div>
              <h3>🧑‍🌾 Arbeiter in deinen Gebäuden</h3>
              <p className="leer">Tippe in der Stadt auf ein Gebäude (Holzfäller, Bauernhof, Mühle …), um dort Arbeiter anzustellen. Jeder bringt +25 %.</p>
              {state.buildings.filter(b => BUILDINGS[b.type].arbeitsplaetze).map(b => (
                <div key={b.id} className="zeile">{BUILDINGS[b.type].icon} {BUILDINGS[b.type].name} (Lvl {b.level}) <b>{b.arbeiter ?? 0} / {BUILDINGS[b.type].arbeitsplaetze}</b></div>
              ))}
            </>
          )}

          {reiter === 'land' && (
            <>
              <h3>🗺️ Land zu verkaufen</h3>
              <p className="leer">Preis für das nächste Stück: {mengenText(landPreis(gekauftAnzahl(state))).replaceAll('+', '')}</p>
              {alleParzellen().filter(p => p.gebiet === 'stadt' && kaufbar(p, new Set(state.land.parzellen.map(parzellenSchluessel)))).map(p => (
                <div key={parzellenSchluessel(p)} className="karte">
                  <div className="karte-icon">🌳</div>
                  <div className="karte-text"><b>Land {richtung(p)}</b><span>8 × 8 Felder mit Bäumen und Felsen</span></div>
                  <button className="knopf" onClick={() => onLand(p)}>Ansehen</button>
                </div>
              ))}
              <h3>🏭 Industrie</h3>
              <div className="karte">
                <div className="karte-icon">🏭</div>
                <div className="karte-text"><b>Industrie-Gebiet</b><span>{state.land.industrie ? 'Freigeschaltet ✓' : 'Rechts neben der Stadt'}</span></div>
                <button className="knopf" onClick={onIndustrie}>Ansehen</button>
              </div>
            </>
          )}
        </div>

        {reiter === 'shop' && (
          <div className="warenkorb">
            <div>
              <b>🛒 {stueck} Artikel · 🪙 {zahl(summe)}</b>
              <small>{stueck ? `Lieferung in ca. ${dauer(lieferzeitSekunden(stueck))}` : 'Leg etwas in den Warenkorb'}
                {offen >= MAX_OFFENE_BESTELLUNGEN ? ' · Alle Lieferwagen unterwegs' : ''}</small>
            </div>
            <button className={'knopf' + (kannBestellen ? '' : ' aus')} disabled={!kannBestellen}
              onClick={async () => { if (await onBestellen(korb)) { setKorb({}); setReiter('lieferungen'); } }}>Bestellen</button>
          </div>
        )}
      </div>
    </div>
  );
}

