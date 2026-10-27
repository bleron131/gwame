import { Suspense, memo, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { BUILDINGS, inGrid, type BuildingType, type GameState } from '@empire/shared';
import { feldSchluessel, weltZuFeld } from '../game/coords';
import { EinwohnerGruppe } from './Einwohner';
import { GEBAEUDE_MODELLE, Gebaeude, GebaeudeVorschau } from './Gebaeude';
import { modelleVorladen } from './modelle';
import { NATUR_MODELLE, NaturObjekt } from './Natur';
import { Schwebtexte } from './Schwebtexte';
import { Spieler } from './Spieler';
import { Boden, FreieFelder, LANDSCHAFT_MODELLE, Landschaft, Licht } from './Umgebung';

// Alle 3D-Modelle schon beim Start laden
modelleVorladen([...GEBAEUDE_MODELLE, ...NATUR_MODELLE, ...LANDSCHAFT_MODELLE]);

interface Props {
  state: GameState;
  platzieren: BuildingType | null;
  vorschau: { x: number; y: number } | null;
  vorschauOk: boolean;
  ausgewaehlt: number | null;
  nahNode: number | null;
  onFeld: (x: number, y: number) => void;
  onGebaeude: (id: number) => void;
  onNode: (id: number) => void;
  onNah: (id: number | null) => void;
  onDaneben: () => void;
}

// Die ganze 3D-Welt
export const Szene = memo(function Szene(p: Props) {
  const { state } = p;
  // Welche Felder sind belegt? (für Bauen, Laufen und Wegsuche)
  const belegt = useMemo(() => {
    const s = new Set<string>();
    for (const b of state.buildings) s.add(feldSchluessel(b.x, b.y));
    for (const n of state.nodes) s.add(feldSchluessel(n.x, n.y));
    return s;
  }, [state.buildings, state.nodes]);
  const hindernisse = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of state.buildings) m.set(feldSchluessel(b.x, b.y), 0.92);
    for (const n of state.nodes) m.set(feldSchluessel(n.x, n.y), 0.7);
    return m;
  }, [state.buildings, state.nodes]);

  const bodenTipp = (wx: number, wz: number) => {
    const f = weltZuFeld(wx, wz);
    if (inGrid(f.x, f.y)) p.onFeld(f.x, f.y); else p.onDaneben();
  };

  return (
    <Canvas shadows dpr={[1, 2]} camera={{ fov: 50, near: 0.05, far: 400, position: [0, 12, 12] }} onPointerMissed={p.onDaneben}>
      <color attach="background" args={['#9fd4f5']} />
      <fog attach="fog" args={['#cfe9fa', 55, 140]} />
      <Licht />
      <Boden onTipp={bodenTipp} />
      <Spieler hindernisse={hindernisse} nodes={state.nodes} onNah={p.onNah} />
      {/* Modelle werden geladen – bis dahin wird einfach nichts gezeigt */}
      <Suspense fallback={null}>
      <Landschaft />
      {p.platzieren && <FreieFelder belegt={belegt} />}
      {state.buildings.map(b => <Gebaeude key={b.id} b={b} ausgewaehlt={b.id === p.ausgewaehlt} onTipp={p.onGebaeude} />)}
      {state.nodes.map(n => <NaturObjekt key={n.id} node={n} nah={n.id === p.nahNode} onTipp={p.onNode} />)}
      {p.platzieren && p.vorschau && (
        <GebaeudeVorschau x={p.vorschau.x} y={p.vorschau.y} ok={p.vorschauOk} symbol={`${BUILDINGS[p.platzieren].icon} ${BUILDINGS[p.platzieren].name}`} />
      )}
      <EinwohnerGruppe gebaeude={state.buildings} belegt={belegt} bevoelkerung={state.stats.population} />
      </Suspense>
      <Schwebtexte />
    </Canvas>
  );
});
