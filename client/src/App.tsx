import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BUILDINGS, NODES, RESEARCH, RESEARCH_IDS, XP, canAfford, feldGebiet, gebietVon, kaufbar, parzelleVon, parzellenSchluessel, upgradeCost,
  type BuildingType, type GameState, type Parzelle, type Stock
} from '@empire/shared';
import { AufgabenKarte } from './components/AufgabenKarte';
import { AufgabenMenue } from './components/AufgabenMenue';
import { BauMenue } from './components/BauMenue';
import { BlackjackTisch } from './components/BlackjackTisch';
import { Ladebild, NeueStadt, OfflineFenster } from './components/Bildschirme';
import { ForschungMenue } from './components/ForschungMenue';
import { GebaeudeInfo } from './components/GebaeudeInfo';
import { Joystick } from './components/Joystick';
import { Kosten } from './components/Kosten';
import { IndustrieBlatt, LandBlatt } from './components/LandMenue';
import { Leiste } from './components/Leiste';
import { PcFenster } from './components/PcFenster';
import { aufgabeJetzt } from './game/aufgaben';
import { feldSchluessel, feldZuWelt } from './game/coords';
import { jetztSek, schwebtext, spielerAnim, trefferZeit } from './game/effects';
import { dauer, mengenText } from './game/format';
import { useGame, useLiveVorrat, type Spiel } from './game/useGame';
import { Szene } from './scene/Szene';

// Welches Menü ist gerade offen?
type Menue = null | 'bauen' | 'forschung' | 'aufgaben' | 'blackjack' | 'pc' | 'industrie' | 'einstellungen';

// Was wird gerade platziert? Ein Gebäude – entweder normal gebaut oder als Bausatz aus dem Shop
interface Platzieren { typ: BuildingType; bausatz: boolean }

export default function App() {
  const spiel = useGame();
  const { state, status } = spiel;
  const [platzieren, setPlatzieren] = useState<Platzieren | null>(null);
  const [vorschau, setVorschau] = useState<{ x: number; y: number } | null>(null);
  const [ausgewaehlt, setAusgewaehlt] = useState<number | null>(null);
  const [nahNode, setNahNode] = useState<number | null>(null);
  const [nahBau, setNahBau] = useState<number | null>(null);
  const [menue, setMenue] = useState<Menue>(null);
  const [landWahl, setLandWahl] = useState<Parzelle | null>(null);
  const weltRef = useRef<HTMLDivElement>(null);
  const letzterSchlag = useRef(0);

  // Dein Land und die belegten Felder
  const besitz = useMemo(() => new Set(state?.land.parzellen.map(parzellenSchluessel) ?? []), [state]);
  const belegt = useMemo(() => {
    const s = new Set<string>();
    state?.buildings.forEach(b => s.add(feldSchluessel(b.x, b.y)));
    state?.nodes.forEach(n => s.add(feldSchluessel(n.x, n.y)));
    return s;
  }, [state]);
  // Darf man hier bauen? Eigenes Land, das richtige Gebiet (Stadt/Industrie) und frei
  const vorschauGebiet = vorschau ? feldGebiet(vorschau.x, vorschau.y, besitz) : null;
  const passt = !!platzieren && !!vorschauGebiet && (BUILDINGS[platzieren.typ].gebiet === 'ueberall' || BUILDINGS[platzieren.typ].gebiet === vorschauGebiet);
  const vorschauOk = !!vorschau && passt && !belegt.has(feldSchluessel(vorschau.x, vorschau.y));
  const vorschauText = !vorschau ? null : !vorschauGebiet ? 'Dieses Land gehört dir noch nicht' : !passt
    ? (vorschauGebiet === 'industrie' ? 'Das gehört in die Stadt' : 'Das darf nur ins Industrie-Gebiet')
    : vorschauOk ? 'Hier bauen?' : 'Dieser Platz ist belegt';

  // Auf einen Baum/Felsen schlagen
  const abbauen = useCallback(async (nodeId: number) => {
    const node = state?.nodes.find(n => n.id === nodeId);
    if (!node || jetztSek() - letzterSchlag.current < 0.33) return;
    letzterSchlag.current = jetztSek();
    const [wx, , wz] = feldZuWelt(node.x, node.y);
    spielerAnim.schlagAt = jetztSek(); spielerAnim.blickX = wx; spielerAnim.blickZ = wz;
    trefferZeit.set(node.id, jetztSek() + 0.12);
    const r = await spiel.aktionen.abbauen(nodeId);
    if (r?.events?.gained) schwebtext(mengenText(r.events.gained), [wx, 0, wz]);
  }, [state, spiel.aktionen]);

  // Auf der Baustelle mithelfen (jeder Schlag: 2 Sekunden schneller)
  const mitbauen = useCallback(async (id: number) => {
    const b = state?.buildings.find(x => x.id === id);
    if (!b || jetztSek() - letzterSchlag.current < 0.33) return;
    letzterSchlag.current = jetztSek();
    const [wx, , wz] = feldZuWelt(b.x, b.y);
    spielerAnim.schlagAt = jetztSek(); spielerAnim.blickX = wx; spielerAnim.blickZ = wz;
    if (await spiel.aktionen.mitbauen(id)) schwebtext('🔨 −2 Sek.', [wx, 1.5, wz], '#ffd45c');
  }, [state, spiel.aktionen]);

  const onFeld = useCallback((x: number, y: number) => {
    if (platzieren) { setVorschau({ x, y }); return; }
    setAusgewaehlt(null);
    // Auf fremdes Land getippt? Dann zeigen, ob man es kaufen kann
    if (!state || feldGebiet(x, y, besitz)) return;
    const p = parzelleVon(x, y);
    const gebiet = gebietVon(p.px, p.py);
    if (gebiet === 'industrie') setMenue('industrie');
    else if (gebiet === 'stadt' && kaufbar(p, besitz)) { setLandWahl(p); setMenue(null); }
  }, [platzieren, state, besitz]);
  const onGebaeude = useCallback((id: number) => {
    if (platzieren) { spiel.melden('Dieser Platz ist schon belegt.'); return; }
    setAusgewaehlt(id); setMenue(null);
  }, [platzieren, spiel]);
  const onNode = useCallback((id: number) => {
    if (platzieren) { spiel.melden('Hier steht ein Baum oder Felsen – erst abbauen!'); return; }
    if (id === nahNode) abbauen(id);
    else spiel.melden('Lauf näher heran, um es abzubauen.');
  }, [platzieren, nahNode, abbauen, spiel]);
  const onDaneben = useCallback(() => { if (!platzieren) setAusgewaehlt(null); }, [platzieren]);
  const onGreta = useCallback(() => { if (!platzieren) { setAusgewaehlt(null); setMenue('aufgaben'); } }, [platzieren]);
  const onLand = useCallback((p: Parzelle) => { if (!platzieren) { setAusgewaehlt(null); setMenue(null); setLandWahl(p); } }, [platzieren]);
  const onIndustrie = useCallback(() => { if (!platzieren) { setAusgewaehlt(null); setMenue('industrie'); } }, [platzieren]);

  // Wartet bei Greta eine Belohnung? (für das "!" über ihrem Kopf)
  const gretaBelohnung = !!state && !!aufgabeJetzt(state, state.resources)?.fertig;

  // Tastatur: E oder Leertaste = abbauen / mitbauen, Esc = abbrechen
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'e' || e.key === ' ') {
        if (nahBau !== null) { e.preventDefault(); mitbauen(nahBau); } else if (nahNode !== null) { e.preventDefault(); abbauen(nahNode); }
      }
      if (e.key === 'Escape') { setPlatzieren(null); setVorschau(null); setMenue(null); setAusgewaehlt(null); setLandWahl(null); }
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [nahNode, nahBau, abbauen, mitbauen]);

  if (status === 'laden' || (status === 'bereit' && !state)) return <Ladebild text="Deine Stadt wird geladen …" />;
  if (status === 'fehler') return <Ladebild text={spiel.fehlerText} onNochmal={spiel.nochmal} />;
  if (status === 'keinSpiel' || !state) return <NeueStadt onGruenden={name => spiel.aktionen.neueStadt(name)} />;

  const starten = (typ: BuildingType, bausatz: boolean) => {
    setPlatzieren({ typ, bausatz }); setVorschau(null); setMenue(null); setAusgewaehlt(null); setLandWahl(null);
  };

  return (
    <div className="app">
      <div className="welt" ref={weltRef}>
        <Szene
          state={state} platzieren={platzieren?.typ ?? null} vorschau={vorschau} vorschauOk={vorschauOk}
          ausgewaehlt={ausgewaehlt} nahNode={nahNode} nahBau={nahBau}
          onFeld={onFeld} onGebaeude={onGebaeude} onNode={onNode} onNah={setNahNode} onNahBau={setNahBau} onDaneben={onDaneben}
          onGreta={onGreta} onLand={onLand} onIndustrie={onIndustrie} gretaBelohnung={gretaBelohnung}
        />
      </div>
      <Joystick ziel={weltRef} />
      <Oberflaeche
        spiel={spiel} state={state} platzieren={platzieren} vorschau={vorschau} vorschauOk={vorschauOk} vorschauText={vorschauText}
        ausgewaehlt={ausgewaehlt} nahNode={nahNode} nahBau={nahBau} menue={menue} landWahl={landWahl}
        setMenue={setMenue} setAusgewaehlt={setAusgewaehlt} setLandWahl={setLandWahl}
        onPlatzieren={t => starten(t, false)} onBausatz={t => starten(t, true)}
        onAbbrechen={() => { setPlatzieren(null); setVorschau(null); }}
        onBauen={async () => {
          if (!platzieren || !vorschau) return;
          const { typ, bausatz } = platzieren;
          const r = await spiel.aktionen.bauen(typ, vorschau.x, vorschau.y, bausatz);
          if (r) {
            schwebtext(`${BUILDINGS[typ].icon} +${BUILDINGS[typ].xp ?? XP.build} ⭐`, feldZuWelt(vorschau.x, vorschau.y), '#ffd45c');
            // Strassen baut man am Stück: einfach weiter tippen (solange Bausätze da sind). Andere Gebäude: fertig.
            const nochBausaetze = (r.state.shop.bausaetze[typ] ?? 0) > 0;
            if (typ === 'road' && (!bausatz || nochBausaetze)) setVorschau(null);
            else { setPlatzieren(null); setVorschau(null); }
          }
        }}
        onAktion={() => { if (nahBau !== null) mitbauen(nahBau); else if (nahNode !== null) abbauen(nahNode); }}
      />
    </div>
  );
}

// Alles, was über der 3D-Welt liegt. Wird zweimal pro Sekunde neu gezeichnet,
// damit die Zahlen flüssig hochzählen – die 3D-Welt bleibt davon unberührt.
function Oberflaeche(p: {
  spiel: Spiel; state: GameState; platzieren: Platzieren | null; vorschau: { x: number; y: number } | null; vorschauOk: boolean;
  vorschauText: string | null; ausgewaehlt: number | null; nahNode: number | null; nahBau: number | null; menue: Menue; landWahl: Parzelle | null;
  setMenue: (m: Menue) => void; setAusgewaehlt: (id: number | null) => void; setLandWahl: (p: Parzelle | null) => void;
  onPlatzieren: (t: BuildingType) => void; onBausatz: (t: BuildingType) => void;
  onAbbrechen: () => void; onBauen: () => void; onAktion: () => void;
}) {
  const { spiel, state } = p;
  const vorrat: Stock = useLiveVorrat(state, spiel.serverJetzt) ?? state.resources;
  const gebaeude = state.buildings.find(b => b.id === p.ausgewaehlt);
  const node = state.nodes.find(n => n.id === p.nahNode);
  const jetzt = spiel.serverJetzt();
  const baustelle = state.buildings.find(b => b.id === p.nahBau && (b.bauEnde ?? 0) > jetzt);
  const aufgabe = aufgabeJetzt(state, vorrat);
  const { aktiv: forschungAktiv, endetAm } = state.forschung;
  // Roter Punkt bei Forschung: nichts läuft, aber es gibt etwas, das man sich leisten kann
  const forschungMoeglich = !forschungAktiv && RESEARCH_IDS.some(id =>
    !state.forschung.fertig.includes(id) && state.save.level >= RESEARCH[id].unlockLevel && canAfford(vorrat, RESEARCH[id].cost));
  const offen = !p.platzieren && !gebaeude && !p.menue && !p.landWahl;
  const pcPunkt = state.shop.bestellungen.length + Object.keys(state.shop.bausaetze).length;
  const zu = () => p.setMenue(null);

  return (
    <>
      <Leiste state={state} vorrat={vorrat} onEinstellungen={() => p.setMenue('einstellungen')} />

      <div className="meldungen">
        {spiel.meldungen.map(m => <div key={m.id} className={'meldung ' + m.art}>{m.text}</div>)}
      </div>

      {offen && !node && !baustelle && aufgabe && <AufgabenKarte a={aufgabe} onOeffnen={() => p.setMenue('aufgaben')} />}

      {/* Aktions-Knopf: auf der Baustelle mithelfen – oder einen Baum/Felsen abbauen */}
      {offen && baustelle && (
        <button className="aktion bau" onClick={p.onAktion}>
          <span>🔨</span>
          <small>Mithelfen</small>
          <i>{dauer(Math.max(0, ((baustelle.bauEnde ?? 0) - jetzt) / 1000))}</i>
        </button>
      )}
      {offen && !baustelle && node && (
        <button className="aktion" onClick={p.onAktion}>
          <span>{NODES[node.type].icon}</span>
          <small>{NODES[node.type].action}</small>
          <i>{'●'.repeat(node.hitsLeft)}</i>
        </button>
      )}

      {/* Untere Leiste oder Bau-Leiste */}
      {p.platzieren ? (
        <div className="bauleiste">
          <div className="bauleiste-text">
            <b>{BUILDINGS[p.platzieren.typ].icon} {BUILDINGS[p.platzieren.typ].name}{p.platzieren.bausatz ? ' (Bausatz)' : ''}</b>
            <span>{p.vorschauText ?? (p.platzieren.typ === 'road' ? 'Tippe auf freie Plätze – Stück für Stück. ✕ = fertig' : 'Tippe auf einen freien (hellen) Platz')}</span>
            {p.platzieren.bausatz
              ? <span className="kosten gratis">📦 noch {state.shop.bausaetze[p.platzieren.typ] ?? 0} Bausätze</span>
              : <Kosten kosten={upgradeCost(p.platzieren.typ, 0)} vorrat={vorrat} />}
          </div>
          <button className="knopf leise" onClick={p.onAbbrechen}>✕</button>
          <button className={'knopf' + (p.vorschauOk && (p.platzieren.bausatz || canAfford(vorrat, upgradeCost(p.platzieren.typ, 0))) ? '' : ' aus')}
            disabled={!p.vorschauOk} onClick={p.onBauen}>✓ Bauen</button>
        </div>
      ) : offen && (
        <div className="unten">
          <button className="rund" onClick={() => p.setMenue('bauen')}><span>🏗️</span><small>Bauen</small></button>
          <button className="rund" onClick={() => p.setMenue('forschung')}>
            <span>🔬</span><small>Forschung</small>
            {forschungMoeglich && <b className="punkt">!</b>}
            {forschungAktiv && <b className="zeit">{dauer(Math.max(0, (endetAm - jetzt) / 1000))}</b>}
          </button>
          <button className="rund" onClick={() => p.setMenue('aufgaben')}>
            <span>📜</span><small>Aufgaben</small>
            {aufgabe?.fertig && <b className="punkt">1</b>}
          </button>
          <button className="rund" onClick={() => p.setMenue('pc')}>
            <span>💻</span><small>PC</small>
            {pcPunkt > 0 && <b className="punkt">{pcPunkt}</b>}
          </button>
        </div>
      )}

      {p.menue === 'forschung' && (
        <ForschungMenue state={state} vorrat={vorrat} jetzt={jetzt} onZu={zu}
          onForschen={async id => { if (await spiel.aktionen.forschen(id)) spiel.melden(`🔬 ${RESEARCH[id].name} wird erforscht …`, 'info'); }} />
      )}
      {p.menue === 'aufgaben' && (
        <AufgabenMenue state={state} vorrat={vorrat} onZu={zu}
          onAbholen={async id => {
            const r = await spiel.aktionen.abholen(id);
            if (r) spiel.melden(`🎁 Belohnung: ${mengenText(r.events?.gained ?? {})}`, 'erfolg');
          }} />
      )}
      {p.menue === 'blackjack' && (
        <BlackjackTisch state={state} vorrat={vorrat} onZu={zu}
          onSetzen={(r, m) => spiel.aktionen.blackjack(r, m)} onZug={z => spiel.aktionen.blackjackZug(z)} />
      )}
      {p.menue === 'bauen' && <BauMenue state={state} vorrat={vorrat} onWahl={p.onPlatzieren} onBausatz={p.onBausatz} onZu={zu} />}
      {p.menue === 'pc' && (
        <PcFenster state={state} vorrat={vorrat} jetzt={jetzt} onZu={zu}
          onBestellen={async korb => {
            const r = await spiel.aktionen.bestellen(korb);
            if (r) spiel.melden('🚚 Bestellt! Der Lieferwagen ist unterwegs.', 'erfolg');
            return !!r;
          }}
          onAufstellen={p.onBausatz}
          onBauarbeiter={async mehr => { if (await spiel.aktionen.bauarbeiter(mehr)) spiel.melden(mehr ? '👷 Ein Bauarbeiter ist da!' : 'Bauarbeiter entlassen.', mehr ? 'erfolg' : 'info'); }}
          onLand={l => { p.setMenue(null); p.setLandWahl(l); }}
          onIndustrie={() => p.setMenue('industrie')} />
      )}
      {p.menue === 'industrie' && (
        <IndustrieBlatt state={state} vorrat={vorrat} onZu={zu}
          onFreischalten={async () => { if (await spiel.aktionen.industrie()) { spiel.melden('🏭 Die Industrie ist freigeschaltet!', 'erfolg'); zu(); } }} />
      )}
      {p.landWahl && (
        <LandBlatt p={p.landWahl} state={state} vorrat={vorrat} onZu={() => p.setLandWahl(null)}
          onKaufen={async () => {
            if (await spiel.aktionen.landKaufen(p.landWahl!.px, p.landWahl!.py)) { spiel.melden('🗺️ Neues Land gekauft!', 'erfolg'); p.setLandWahl(null); }
          }} />
      )}
      {gebaeude && (
        <GebaeudeInfo key={gebaeude.id} b={gebaeude} state={state} vorrat={vorrat} jetzt={jetzt} onZu={() => p.setAusgewaehlt(null)}
          onVerbessern={async () => {
            const r = await spiel.aktionen.verbessern(gebaeude.id);
            if (r) schwebtext(`🏗️ Level ${gebaeude.level + 1}`, feldZuWelt(gebaeude.x, gebaeude.y), '#ffd45c');
          }}
          onAbreissen={async () => { if (await spiel.aktionen.abreissen(gebaeude.id)) p.setAusgewaehlt(null); }}
          onSpielen={() => { p.setAusgewaehlt(null); p.setMenue('blackjack'); }}
          onArbeiter={mehr => spiel.aktionen.arbeiter(gebaeude.id, mehr)}
          onPc={() => { p.setAusgewaehlt(null); p.setMenue('pc'); }}
        />
      )}
      {p.menue === 'einstellungen' && (
        <div className="fenster-hinter">
          <NeueStadt ersetzen onZurueck={zu}
            onGruenden={async name => { if (await spiel.aktionen.neueStadt(name, true)) p.setMenue(null); }} />
        </div>
      )}
      {spiel.offline && <OfflineFenster bericht={spiel.offline} onOk={spiel.offlineSchliessen} />}
    </>
  );
}
