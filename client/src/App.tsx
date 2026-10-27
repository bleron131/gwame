import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BUILDINGS, NODES, canAfford, inGrid, upgradeCost, type BuildingType, type GameState, type Stock } from '@empire/shared';
import { BauMenue } from './components/BauMenue';
import { Ladebild, NeueStadt, OfflineFenster } from './components/Bildschirme';
import { GebaeudeInfo } from './components/GebaeudeInfo';
import { Joystick } from './components/Joystick';
import { Kosten } from './components/Kosten';
import { Leiste } from './components/Leiste';
import { Tipp } from './components/Tipp';
import { feldSchluessel, feldZuWelt } from './game/coords';
import { jetztSek, schwebtext, spielerAnim, trefferZeit } from './game/effects';
import { mengenText } from './game/format';
import { useGame, useLiveVorrat, type Spiel } from './game/useGame';
import { Szene } from './scene/Szene';

export default function App() {
  const spiel = useGame();
  const { state, status } = spiel;
  const [platzieren, setPlatzieren] = useState<BuildingType | null>(null);
  const [vorschau, setVorschau] = useState<{ x: number; y: number } | null>(null);
  const [ausgewaehlt, setAusgewaehlt] = useState<number | null>(null);
  const [nahNode, setNahNode] = useState<number | null>(null);
  const [menue, setMenue] = useState<null | 'bauen' | 'einstellungen'>(null);
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
            schwebtext(`${BUILDINGS[platzieren].icon} +25 ⭐`, feldZuWelt(vorschau.x, vorschau.y), '#ffd45c');
            setPlatzieren(null); setVorschau(null);
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
  ausgewaehlt: number | null; nahNode: number | null; menue: null | 'bauen' | 'einstellungen';
  setMenue: (m: null | 'bauen' | 'einstellungen') => void; setAusgewaehlt: (id: number | null) => void;
  onPlatzieren: (t: BuildingType) => void; onAbbrechen: () => void; onBauen: () => void; onAbbauen: () => void;
}) {
  const { spiel, state } = p;
  const vorrat: Stock = useLiveVorrat(state, spiel.serverJetzt) ?? state.resources;
  const gebaeude = state.buildings.find(b => b.id === p.ausgewaehlt);
  const node = state.nodes.find(n => n.id === p.nahNode);

  return (
    <>
      <Leiste state={state} vorrat={vorrat} onEinstellungen={() => p.setMenue('einstellungen')} />

      <div className="meldungen">
        {spiel.meldungen.map(m => <div key={m.id} className={'meldung ' + m.art}>{m.text}</div>)}
      </div>

      {!p.platzieren && !gebaeude && !p.menue && <Tipp state={state} vorrat={vorrat} />}

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
            <span>{p.vorschau ? (p.vorschauOk ? 'Hier bauen?' : 'Dieser Platz ist belegt') : 'Tippe auf einen freien (hellen) Platz'}</span>
            <Kosten kosten={upgradeCost(p.platzieren, 0)} vorrat={vorrat} />
          </div>
          <button className="knopf leise" onClick={p.onAbbrechen}>✕</button>
          <button className={'knopf' + (p.vorschauOk && canAfford(vorrat, upgradeCost(p.platzieren, 0)) ? '' : ' aus')}
            disabled={!p.vorschauOk} onClick={p.onBauen}>✓ Bauen</button>
        </div>
      ) : !gebaeude && !p.menue && (
        <div className="unten">
          <button className="rund" onClick={() => p.setMenue('bauen')}><span>🏗️</span><small>Bauen</small></button>
          <button className="rund bald" disabled title="Kommt in Phase 6"><span>🔬</span><small>Forschung</small></button>
          <button className="rund bald" disabled title="Kommt in Phase 6"><span>📜</span><small>Aufgaben</small></button>
        </div>
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
