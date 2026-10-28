import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BUILDINGS, NODES, RESEARCH, RESEARCH_IDS, XP, canAfford, inGrid, upgradeCost, type BuildingType, type GameState, type Stock } from '@empire/shared';
import { AufgabenKarte } from './components/AufgabenKarte';
import { AufgabenMenue } from './components/AufgabenMenue';
import { BauMenue } from './components/BauMenue';
import { Ladebild, NeueStadt, OfflineFenster } from './components/Bildschirme';
import { ForschungMenue } from './components/ForschungMenue';
import { GebaeudeInfo } from './components/GebaeudeInfo';
import { Joystick } from './components/Joystick';
import { Kosten } from './components/Kosten';
import { Leiste } from './components/Leiste';
import { aufgabeJetzt } from './game/aufgaben';
import { feldSchluessel, feldZuWelt } from './game/coords';
import { jetztSek, schwebtext, spielerAnim, trefferZeit } from './game/effects';
import { dauer, mengenText } from './game/format';
import { useGame, useLiveVorrat, type Spiel } from './game/useGame';
import { Szene } from './scene/Szene';

// Welches Menü ist gerade offen?
type Menue = null | 'bauen' | 'forschung' | 'aufgaben' | 'einstellungen';

export default function App() {
  const spiel = useGame();
  const { state, status } = spiel;
  const [platzieren, setPlatzieren] = useState<BuildingType | null>(null);
  const [vorschau, setVorschau] = useState<{ x: number; y: number } | null>(null);
  const [ausgewaehlt, setAusgewaehlt] = useState<number | null>(null);
  const [nahNode, setNahNode] = useState<number | null>(null);
  const [menue, setMenue] = useState<Menue>(null);
  const weltRef = useRef<HTMLDivElement>(null);
  const letzterSchlag = useRef(0);

  // Ist der gewählte Bauplatz frei?
  const belegt = useMemo(() => {
    const s = new Set<string>();
    state?.buildings.forEach(b => s.add(feldSchluessel(b.x, b.y)));
    state?.nodes.forEach(n => s.add(feldSchluessel(n.x, n.y)));
    return s;
  }, [state]);
  const vorschauOk = !!vorschau && inGrid(vorschau.x, vorschau.y) && !belegt.has(feldSchluessel(vorschau.x, vorschau.y));

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

  const onFeld = useCallback((x: number, y: number) => {
    if (platzieren) setVorschau({ x, y });
    else setAusgewaehlt(null);
  }, [platzieren]);
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

  // Wartet bei Greta eine Belohnung? (für das "!" über ihrem Kopf)
  const gretaBelohnung = !!state && !!aufgabeJetzt(state, state.resources)?.fertig;

  // Tastatur: E oder Leertaste = abbauen, Esc = abbrechen
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if ((e.key === 'e' || e.key === ' ') && nahNode !== null) { e.preventDefault(); abbauen(nahNode); }
      if (e.key === 'Escape') { setPlatzieren(null); setVorschau(null); setMenue(null); setAusgewaehlt(null); }
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [nahNode, abbauen]);

  if (status === 'laden' || (status === 'bereit' && !state)) return <Ladebild text="Deine Stadt wird geladen …" />;
  if (status === 'fehler') return <Ladebild text={spiel.fehlerText} onNochmal={spiel.nochmal} />;
  if (status === 'keinSpiel' || !state) return <NeueStadt onGruenden={name => spiel.aktionen.neueStadt(name)} />;

  return (
    <div className="app">
      <div className="welt" ref={weltRef}>
        <Szene
          state={state} platzieren={platzieren} vorschau={vorschau} vorschauOk={vorschauOk}
          ausgewaehlt={ausgewaehlt} nahNode={nahNode}
          onFeld={onFeld} onGebaeude={onGebaeude} onNode={onNode} onNah={setNahNode} onDaneben={onDaneben}
          onGreta={onGreta} gretaBelohnung={gretaBelohnung}
        />
      </div>
      <Joystick ziel={weltRef} />
      <Oberflaeche
        spiel={spiel} state={state} platzieren={platzieren} vorschau={vorschau} vorschauOk={vorschauOk}
        ausgewaehlt={ausgewaehlt} nahNode={nahNode} menue={menue}
        setMenue={setMenue} setAusgewaehlt={setAusgewaehlt}
        onPlatzieren={t => { setPlatzieren(t); setVorschau(null); setMenue(null); setAusgewaehlt(null); }}
        onAbbrechen={() => { setPlatzieren(null); setVorschau(null); }}
        onBauen={async () => {
          if (!platzieren || !vorschau) return;
          const r = await spiel.aktionen.bauen(platzieren, vorschau.x, vorschau.y);
          if (r) {
            schwebtext(`${BUILDINGS[platzieren].icon} +${BUILDINGS[platzieren].xp ?? XP.build} ⭐`, feldZuWelt(vorschau.x, vorschau.y), '#ffd45c');
            // Strassen baut man am Stück: einfach weiter tippen. Andere Gebäude: fertig.
            if (platzieren === 'road') setVorschau(null);
            else { setPlatzieren(null); setVorschau(null); }
          }
        }}
        onAbbauen={() => nahNode !== null && abbauen(nahNode)}
      />
    </div>
  );
}

// Alles, was über der 3D-Welt liegt. Wird zweimal pro Sekunde neu gezeichnet,
// damit die Zahlen flüssig hochzählen – die 3D-Welt bleibt davon unberührt.
function Oberflaeche(p: {
  spiel: Spiel; state: GameState; platzieren: BuildingType | null; vorschau: { x: number; y: number } | null; vorschauOk: boolean;
  ausgewaehlt: number | null; nahNode: number | null; menue: Menue;
  setMenue: (m: Menue) => void; setAusgewaehlt: (id: number | null) => void;
  onPlatzieren: (t: BuildingType) => void; onAbbrechen: () => void; onBauen: () => void; onAbbauen: () => void;
}) {
  const { spiel, state } = p;
  const vorrat: Stock = useLiveVorrat(state, spiel.serverJetzt) ?? state.resources;
  const gebaeude = state.buildings.find(b => b.id === p.ausgewaehlt);
  const node = state.nodes.find(n => n.id === p.nahNode);
  const aufgabe = aufgabeJetzt(state, vorrat);
  const jetzt = spiel.serverJetzt();
  const { aktiv: forschungAktiv, endetAm } = state.forschung;
  // Roter Punkt bei Forschung: nichts läuft, aber es gibt etwas, das man sich leisten kann
  const forschungMoeglich = !forschungAktiv && RESEARCH_IDS.some(id =>
    !state.forschung.fertig.includes(id) && state.save.level >= RESEARCH[id].unlockLevel && canAfford(vorrat, RESEARCH[id].cost));

  return (
    <>
      <Leiste state={state} vorrat={vorrat} onEinstellungen={() => p.setMenue('einstellungen')} />

      <div className="meldungen">
        {spiel.meldungen.map(m => <div key={m.id} className={'meldung ' + m.art}>{m.text}</div>)}
      </div>

      {!p.platzieren && !gebaeude && !p.menue && !node && aufgabe && <AufgabenKarte a={aufgabe} onOeffnen={() => p.setMenue('aufgaben')} />}

      {/* Abbau-Knopf, wenn ein Baum oder Felsen in der Nähe ist */}
      {node && !p.platzieren && !gebaeude && !p.menue && (
        <button className="aktion" onClick={p.onAbbauen}>
          <span>{NODES[node.type].icon}</span>
          <small>{NODES[node.type].action}</small>
          <i>{'●'.repeat(node.hitsLeft)}</i>
        </button>
      )}

      {/* Untere Leiste oder Bau-Leiste */}
      {p.platzieren ? (
        <div className="bauleiste">
          <div className="bauleiste-text">
            <b>{BUILDINGS[p.platzieren].icon} {BUILDINGS[p.platzieren].name}</b>
            <span>{p.vorschau ? (p.vorschauOk ? 'Hier bauen?' : 'Dieser Platz ist belegt')
              : p.platzieren === 'road' ? 'Tippe auf freie Plätze – Stück für Stück. ✕ = fertig' : 'Tippe auf einen freien (hellen) Platz'}</span>
            <Kosten kosten={upgradeCost(p.platzieren, 0)} vorrat={vorrat} />
          </div>
          <button className="knopf leise" onClick={p.onAbbrechen}>✕</button>
          <button className={'knopf' + (p.vorschauOk && canAfford(vorrat, upgradeCost(p.platzieren, 0)) ? '' : ' aus')}
            disabled={!p.vorschauOk} onClick={p.onBauen}>✓ Bauen</button>
        </div>
      ) : !gebaeude && !p.menue && (
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
        </div>
      )}

      {p.menue === 'forschung' && (
        <ForschungMenue state={state} vorrat={vorrat} jetzt={jetzt} onZu={() => p.setMenue(null)}
          onForschen={async id => { if (await spiel.aktionen.forschen(id)) spiel.melden(`🔬 ${RESEARCH[id].name} wird erforscht …`, 'info'); }} />
      )}
      {p.menue === 'aufgaben' && (
        <AufgabenMenue state={state} vorrat={vorrat} onZu={() => p.setMenue(null)}
          onAbholen={async id => {
            const r = await spiel.aktionen.abholen(id);
            if (r) spiel.melden(`🎁 Belohnung: ${mengenText(r.events?.gained ?? {})}`, 'erfolg');
          }} />
      )}
      {p.menue === 'bauen' && <BauMenue state={state} vorrat={vorrat} onWahl={p.onPlatzieren} onZu={() => p.setMenue(null)} />}
      {gebaeude && (
        <GebaeudeInfo key={gebaeude.id} b={gebaeude} state={state} vorrat={vorrat} onZu={() => p.setAusgewaehlt(null)}
          onVerbessern={async () => {
            const r = await spiel.aktionen.verbessern(gebaeude.id);
            if (r) schwebtext(`⬆ Level ${gebaeude.level + 1}`, feldZuWelt(gebaeude.x, gebaeude.y), '#ffd45c');
          }}
          onAbreissen={async () => { if (await spiel.aktionen.abreissen(gebaeude.id)) p.setAusgewaehlt(null); }}
        />
      )}
      {p.menue === 'einstellungen' && (
        <div className="fenster-hinter">
          <NeueStadt ersetzen onZurueck={() => p.setMenue(null)}
            onGruenden={async name => { if (await spiel.aktionen.neueStadt(name, true)) p.setMenue(null); }} />
        </div>
      )}
      {spiel.offline && <OfflineFenster bericht={spiel.offline} onOk={spiel.offlineSchliessen} />}
    </>
  );
}
