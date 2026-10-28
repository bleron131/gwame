import { useState } from 'react';
import {
  RESOURCES, RESOURCE_IDS, handWert, kannTeilen, maxEinsatz,
  type BlackjackSicht, type BlackjackStatistik, type GameState, type Hand, type Karte, type ResourceId, type Stock
} from '@empire/shared';
import type { BlackjackZug } from '../api/client';
import { serverJetzt } from '../game/effects';
import { zahl } from '../game/format';

// Eine Spielkarte. null = verdeckt (die Rückseite)
function Spielkarte({ karte, nr }: { karte: Karte | null; nr: number }) {
  const stil = { animationDelay: `${nr * 0.12}s` }; // Karten kommen nacheinander
  if (!karte) return <div className="spielkarte rueckseite" style={stil} />;
  const rot = karte.farbe === '♥' || karte.farbe === '♦';
  return (
    <div className={'spielkarte' + (rot ? ' rot' : '')} style={stil}>
      <span className="ecke">{karte.rang}<br />{karte.farbe}</span>
      <span className="mitte">{karte.farbe}</span>
    </div>
  );
}

function Wert({ karten }: { karten: (Karte | null)[] }) {
  const sichtbar = karten.filter((k): k is Karte => k !== null);
  const wert = handWert(sichtbar).wert;
  return <b className={wert > 21 ? 'ueber' : ''}>{sichtbar.length < karten.length ? `${wert} + ?` : wert}</b>;
}

// Was mit einer Hand passiert ist, in einem Satz
function handText(h: Hand, icon: string): { text: string; art: 'gut' | 'neutral' | 'schlecht' } {
  const netto = h.ausgezahlt - h.einsatz;
  switch (h.ergebnis) {
    case 'blackjack': return { text: `🃏 BLACKJACK! +${zahl(netto)} ${icon}`, art: 'gut' };
    case 'gewonnen': return { text: `🎉 Gewonnen! +${zahl(netto)} ${icon}`, art: 'gut' };
    case 'unentschieden': return { text: `🤝 Unentschieden – Einsatz zurück`, art: 'neutral' };
    default: return { text: `😬 Verloren: −${zahl(h.einsatz)} ${icon}`, art: 'schlecht' };
  }
}

function Statistik({ st }: { st: BlackjackStatistik }) {
  const gold = st.bilanz.gold ?? 0;
  return (
    <div className="bj-statistik">
      <div><small>Runden</small><b>{st.runden}</b></div>
      <div><small>Siege</small><b>{st.siege}</b></div>
      <div><small>Niederlagen</small><b>{st.niederlagen}</b></div>
      <div><small>Blackjacks</small><b>{st.blackjacks}</b></div>
      <div><small>Bilanz Gold</small><b className={gold < 0 ? 'minus' : 'plus'}>{gold < 0 ? '−' : '+'}{zahl(Math.abs(gold))} 🪙</b></div>
      <div><small>Grösster Gewinn</small><b>{st.besterGewinn ? `+${zahl(st.besterGewinn.menge)} ${RESOURCES[st.besterGewinn.rohstoff].icon}` : '–'}</b></div>
    </div>
  );
}

// Der Blackjack-Tisch in der Spielhalle
export function BlackjackTisch({ state, vorrat, onSetzen, onZug, onRangliste, onZu }: {
  state: GameState; vorrat: Stock; onRangliste: () => void;
  onSetzen: (rohstoff: ResourceId, menge: number) => Promise<unknown>;
  onZug: (zug: BlackjackZug) => Promise<unknown>;
  onZu: () => void;
}) {
  const bj: BlackjackSicht | null = state.blackjack.runde;
  const [rohstoff, setRohstoff] = useState<ResourceId>(bj?.rohstoff ?? 'gold');
  const [menge, setMenge] = useState(bj && !bj.laeuft ? bj.haende[0].einsatz / (bj.haende[0].verdoppelt ? 2 : 1) : 10);
  const [warte, setWarte] = useState(false); // eine Anfrage läuft gerade (gegen Doppelklicks)
  const [statistik, setStatistik] = useState(false);

  const jetzt = serverJetzt();
  const hallen = state.buildings.filter(b => b.type === 'casino');
  const hallenLevel = Math.max(1, ...hallen.map(b => ((b.bauEnde ?? 0) > jetzt ? b.level - 1 : b.level)));
  const max = Math.max(0, Math.min(maxEinsatz(rohstoff, hallenLevel), Math.floor(vorrat[rohstoff])));
  const einsatz = Math.max(1, Math.min(menge, max));
  const kannSetzen = max >= 1 && !warte;
  // Womit kann man spielen? Gold immer, Rohstoffe nur, wenn man welche hat
  const auswahl = RESOURCE_IDS.filter(r => r === 'gold' || vorrat[r] >= 1);

  const mit = (f: () => Promise<unknown>) => async () => { setWarte(true); try { await f(); } finally { setWarte(false); } };
  const laeuft = !!bj?.laeuft;
  const hand = laeuft ? bj!.haende[bj!.aktiv] : null;
  const genug = hand ? vorrat[bj!.rohstoff] + 1e-9 >= hand.einsatz : false;
  const kannVerdoppeln = !!hand && hand.karten.length === 2 && genug;
  const kannSplit = !!hand && genug && kannTeilen(hand.karten, bj!.haende.length);
  const icon = bj ? RESOURCES[bj.rohstoff].icon : '';

  return (
    <div className="fenster-hinter">
      <div className="tisch">
        <button className="zu" onClick={onZu} aria-label="Schliessen">✕</button>
        <button className="stat-knopf" onClick={() => setStatistik(!statistik)} aria-label="Statistik">📊</button>
        <button className="stat-knopf zwei" onClick={onRangliste} aria-label="Rangliste">🏆</button>
        <h2>🃏 Blackjack</h2>
        <p className="regeln">Komm näher an 21 als die Bank. Die Bank zieht bis 16 und bleibt ab 17 · Blackjack zahlt 3:2</p>
        {statistik && <Statistik st={state.blackjack.statistik} />}

        {bj ? (
          <div className="hand bank">
            <div className="hand-kopf">Bank <Wert karten={bj.bank} /></div>
            <div className="karten">{bj.bank.map((k, i) => <Spielkarte key={i} karte={k} nr={i} />)}</div>
          </div>
        ) : <div className="hand leer">Setz deinen Einsatz – dann geht es los!</div>}

        {bj && (
          <div className={'haende' + (bj.haende.length > 1 ? ' mehrere' : '')}>
            {bj.haende.map((h, i) => {
              const ende = !bj.laeuft && h.ergebnis ? handText(h, icon) : null;
              return (
                <div key={i} className={'hand du' + (laeuft && i === bj.aktiv && bj.haende.length > 1 ? ' dran' : '')}>
                  <div className="hand-kopf">{bj.haende.length > 1 ? `Hand ${i + 1}` : 'Du'} <Wert karten={h.karten} /></div>
                  <div className="karten">{h.karten.map((k, j) => <Spielkarte key={j} karte={k} nr={j} />)}</div>
                  {ende ? <div className={'ergebnis ' + ende.art}>{ende.text}</div>
                    : <div className="ergebnis neutral">Einsatz: {zahl(h.einsatz)} {icon}{h.verdoppelt ? ' (×2)' : ''}</div>}
                </div>
              );
            })}
          </div>
        )}

        {laeuft ? (
          <div className="zuege">
            <button className="knopf" disabled={warte} onClick={mit(() => onZug('ziehen'))}>➕ Ziehen</button>
            <button className="knopf blau" disabled={warte} onClick={mit(() => onZug('halten'))}>✋ Halten</button>
            <button className={'knopf gelb' + (kannVerdoppeln ? '' : ' aus')} disabled={warte || !kannVerdoppeln} onClick={mit(() => onZug('verdoppeln'))}>×2 Doppeln</button>
            <button className={'knopf lila' + (kannSplit ? '' : ' aus')} disabled={warte || !kannSplit} onClick={mit(() => onZug('teilen'))}>✂️ Teilen</button>
          </div>
        ) : (
          <div className="einsatz">
            <div className="einsatz-wahl">
              {auswahl.map(r => (
                <button key={r} className={'chip-knopf' + (r === rohstoff ? ' an' : '')} onClick={() => setRohstoff(r)}>
                  {RESOURCES[r].icon} {zahl(vorrat[r])}
                </button>
              ))}
            </div>
            <div className="einsatz-menge">
              <button className="rund-klein" onClick={() => setMenge(Math.max(1, einsatz - (einsatz > 20 ? 10 : 1)))}>−</button>
              <b>{zahl(einsatz)} {RESOURCES[rohstoff].icon}</b>
              <button className="rund-klein" onClick={() => setMenge(Math.min(max, einsatz + (einsatz >= 20 ? 10 : 1)))}>+</button>
            </div>
            <div className="einsatz-schnell">
              <button onClick={() => setMenge(10)}>10</button>
              <button onClick={() => setMenge(Math.floor(max / 4))}>¼</button>
              <button onClick={() => setMenge(Math.floor(max / 2))}>½</button>
              <button onClick={() => setMenge(max)}>Max ({zahl(max)})</button>
            </div>
            <button className={'knopf gross' + (kannSetzen ? '' : ' aus')} disabled={!kannSetzen}
              onClick={mit(() => onSetzen(rohstoff, einsatz))}>
              {max < 1 ? `Du hast kein ${RESOURCES[rohstoff].name}` : `🂠 Karten geben – Einsatz ${zahl(einsatz)} ${RESOURCES[rohstoff].icon}`}
            </button>
            <p className="regeln">Höchsteinsatz in deiner Spielhalle (Level {hallenLevel}): {zahl(maxEinsatz(rohstoff, hallenLevel))} {RESOURCES[rohstoff].icon}.
              {rohstoff !== 'gold' && ' Rohstoff-Gewinne passen nur bis zur Lagergrenze.'} Zwei gleiche Karten kannst du ✂️ teilen.</p>
          </div>
        )}
      </div>
    </div>
  );
}
