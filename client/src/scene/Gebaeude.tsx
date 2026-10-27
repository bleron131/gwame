import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import type { PlacedBuilding } from '@empire/shared';
import { feldZuWelt } from '../game/coords';
import { SEITE, Teil, type Farben, type Seite } from './modelle';
import { textTextur } from './textSprite';

// Ein Feld unserer Stadt ist 2 x 2 Baukasten-Felder gross.
// Die Gebäude werden mit diesem Faktor verkleinert, damit ein kleiner Rand bleibt.
const MASS = 0.95;

type V3 = [number, number, number];

// Die Wände eines Baukasten-Feldes: w = { S: 'wallDoor', W: 'wall', … }
function Raum({ x, z, ebene = 0, w, farben }: { x: number; z: number; ebene?: number; w: Partial<Record<Seite, string>>; farben?: Farben }) {
  return (
    <>
      {(Object.entries(w) as [Seite, string][]).map(([seite, m]) => (
        <Teil key={seite} m={'stadt/' + m} p={[x, ebene, z]} r={SEITE[seite]} farben={farben} />
      ))}
    </>
  );
}

// Walmdach über 2 x 2 Feldern (4 Eckstücke)
function Walmdach({ y, farben }: { y: number; farben?: Farben }) {
  return (
    <>
      <Teil m="stadt/roofCorner" p={[0.5, y, -0.5]} r={0} farben={farben} />
      <Teil m="stadt/roofCorner" p={[-0.5, y, -0.5]} r={Math.PI / 2} farben={farben} />
      <Teil m="stadt/roofCorner" p={[-0.5, y, 0.5]} r={Math.PI} farben={farben} />
      <Teil m="stadt/roofCorner" p={[0.5, y, 0.5]} r={-Math.PI / 2} farben={farben} />
    </>
  );
}

const dachFarben = (farbe: string): Farben => ({ roof: farbe, roofLight: farbe, roofRed: farbe, roofRedLight: farbe });

// ===== Rathaus: wächst mit Obergeschoss und Turm =====
function Rathaus({ level }: { level: number }) {
  const fahne = useRef<Mesh>(null!);
  useFrame(({ clock }) => { fahne.current.rotation.y = Math.sin(clock.elapsedTime * 3) * 0.3; });
  const stock = level >= 2 ? 2 : 1;
  const turm = Math.max(0, level - 2);          // ab Level 3 ein Turm, der weiter wächst
  const turmBasis = stock + 0.25;
  const spitze = turm > 0 ? turmBasis + turm + 1 : stock + 0.65;
  const rot = dachFarben('#b5452f');
  return (
    <group>
      {Array.from({ length: stock }, (_, e) => (
        <group key={e}>
          <Raum x={-0.5} z={-0.5} ebene={e} w={{ W: 'wallWindowStone', N: 'wall' }} />
          <Raum x={0.5} z={-0.5} ebene={e} w={{ E: 'wallWindowStone', N: 'wall' }} />
          <Raum x={-0.5} z={0.5} ebene={e} w={{ W: 'wallWindowStone', S: e === 0 ? 'wallDoor' : 'wallWindowShutters' }} />
          <Raum x={0.5} z={0.5} ebene={e} w={{ E: 'wallWindowStone', S: e === 0 ? 'wallWindowStone' : 'wallWindowShutters' }} />
        </group>
      ))}
      <Walmdach y={stock} farben={rot} />
      <Teil m="stadt/bannerRed" p={[-0.5, stock - 1, 0.5]} r={SEITE.S} />
      <Teil m="stadt/bannerRed" p={[0.5, stock - 1, 0.5]} r={SEITE.S} />
      {Array.from({ length: turm }, (_, k) => (
        <Raum key={k} x={0} z={0} ebene={turmBasis + k} w={{ N: 'wall', E: 'wallWindowStone', W: 'wallWindowStone', S: 'wallWindowStone' }} />
      ))}
      {turm > 0 && <Teil m="stadt/roofHighPoint" p={[0, turmBasis + turm, 0]} farben={rot} />}
      {/* Fahnenmast mit wehender Fahne */}
      <mesh position={[0, spitze + 0.35, 0]}><cylinderGeometry args={[0.02, 0.02, 0.7, 6]} /><meshStandardMaterial color="#666" /></mesh>
      <mesh ref={fahne} position={[0, spitze + 0.55, 0]}>
        <planeGeometry args={[0.4, 0.25]} />
        <meshStandardMaterial color="#f1c40f" side={2} />
      </mesh>
      <Teil m="stadt/lantern" p={[-1.0, 0, 1.0]} s={0.7} />
      <Teil m="stadt/lantern" p={[1.0, 0, 1.0]} s={0.7} />
    </group>
  );
}

// ===== Wohnhaus: Garten (Lvl 2), zweiter Stock (Lvl 3), Anbau (Lvl 4–5) =====
const DACH = ['#b5452f', '#8e3b2a', '#4f6d7a', '#a0522d', '#6b5a8a'];
function Wohnhaus({ level, id }: { level: number; id: number }) {
  const holz = id % 2 === 1;
  const v = (n: string) => (holz ? n.replace('wall', 'wallWood') : n);
  const farben = dachFarben(DACH[id % DACH.length]);
  const stock = level >= 3 ? 2 : 1;
  const anbau = level >= 4 ? (level >= 5 ? 2 : 1) : 0;
  const z = -0.4;
  return (
    <group>
      {Array.from({ length: stock }, (_, e) => (
        <Raum key={e} x={-0.5} z={z} ebene={e} w={{
          W: v('wallWindowShutters'), N: v('wall'), S: v(e === 0 ? 'wallDoor' : 'wallWindowShutters'),
          ...(e >= anbau ? { E: v('wallWindowShutters') } : {})
        }} />
      ))}
      <Teil m="stadt/roofGable" p={[-0.5, stock, z]} r={Math.PI / 2} farben={farben} />
      <Teil m="stadt/chimney" p={[-0.4, stock - 0.25, z - 0.1]} r={SEITE.N} />
      {anbau > 0 && (
        <>
          {Array.from({ length: anbau }, (_, e) => (
            <Raum key={e} x={0.5} z={z} ebene={e} w={{ E: v('wallWindowShutters'), N: v('wall'), S: v('wallWindowShutters'), ...(e >= stock ? { W: v('wall') } : {}) }} />
          ))}
          <Teil m="stadt/roofGable" p={[0.5, anbau, z]} r={Math.PI / 2} farben={farben} />
        </>
      )}
      {/* Vorgarten */}
      {anbau === 0 && (
        <>
          <Teil m="natur/plant_bushLarge" p={[0.45, 0, -0.55]} s={1.8} />
          <Teil m="natur/flower_redA" p={[0.3, 0, 0.1]} s={1.6} />
          <Teil m="natur/flower_yellowA" p={[0.6, 0, 0.25]} s={1.6} />
        </>
      )}
      {level >= 2 && (
        <>
          <Teil m="stadt/fenceGate" p={[-0.5, 0, 0.5]} r={SEITE.S} />
          <Teil m="stadt/fence" p={[0.5, 0, 0.5]} r={SEITE.S} />
          <Teil m="natur/flower_purpleA" p={[-0.85, 0, 0.75]} s={1.6} />
        </>
      )}
    </group>
  );
}

// ===== Holzfäller: Hütte, Holzstapel werden mit dem Level mehr =====
function Holzfaeller({ level }: { level: number }) {
  const braun = dachFarben('#7d5433');
  return (
    <group>
      <Raum x={-0.5} z={-0.5} w={{ W: 'wallWood', N: 'wallWood', E: 'wallWoodWindowShutters', S: 'wallWoodDoor' }} />
      <Teil m="stadt/roofGable" p={[-0.5, 1, -0.5]} farben={braun} />
      <Teil m="natur/log_stackLarge" p={[0.5, 0, -0.5]} r={Math.PI / 2} s={1.6} />
      {level >= 2 && <Teil m="natur/log_stack" p={[0.55, 0, 0.15]} r={Math.PI / 2} s={1.6} />}
      {level >= 4 && <Teil m="natur/log_stackLarge" p={[-0.5, 0, 0.6]} s={1.4} />}
      {level >= 3 && <Teil m="stadt/cart" p={[0.6, 0, 0.75]} r={Math.PI / 2} s={0.7} />}
      <Teil m="natur/stump_roundDetailed" p={[-0.05, 0, 0.45]} s={1.8} />
      <group position={[-0.05, 0.32, 0.45]} rotation={[0.3, 0, 0.5]}>
        <mesh castShadow><cylinderGeometry args={[0.025, 0.025, 0.5, 6]} /><meshStandardMaterial color="#7a5230" /></mesh>
        <mesh position={[0.07, 0.2, 0]} castShadow><boxGeometry args={[0.16, 0.12, 0.03]} /><meshStandardMaterial color="#c9ced6" metalness={0.7} roughness={0.3} /></mesh>
      </group>
    </group>
  );
}

// ===== Steinbruch: Felsen, Kran und ein Wagen voller Steine =====
function Steinbruch({ level }: { level: number }) {
  return (
    <group>
      <Teil m="natur/stone_tallA" p={[-0.45, 0, -0.5]} s={1.5} />
      <Teil m="natur/stone_largeB" p={[0.45, 0, -0.55]} r={1} s={1.7} />
      {level >= 3 && <Teil m="natur/stone_tallB" p={[0.0, 0, -0.75]} r={2} s={1.3} />}
      <Teil m="stadt/planks" p={[0.4, 0, 0.45]} s={[0.9, 1, 0.9]} />
      <Teil m="stadt/cart" p={[0.45, 0, 0.45]} r={Math.PI / 2} s={0.7} />
      {Array.from({ length: Math.min(4, level) }, (_, k) => (
        <Teil key={k} m={k % 2 ? 'natur/stone_smallA' : 'natur/stone_smallB'} p={[-0.6 + (k % 2) * 0.3, 0, 0.3 + Math.floor(k / 2) * 0.3]} r={k} s={1.6} />
      ))}
      {/* einfacher Holzkran */}
      <mesh position={[-0.85, 0.75, 0.1]} castShadow><boxGeometry args={[0.08, 1.5, 0.08]} /><meshStandardMaterial color="#7d5433" /></mesh>
      <mesh position={[-0.5, 1.47, 0.1]} castShadow><boxGeometry args={[0.8, 0.07, 0.07]} /><meshStandardMaterial color="#7d5433" /></mesh>
      <mesh position={[-0.15, 1.2, 0.1]}><boxGeometry args={[0.02, 0.5, 0.02]} /><meshStandardMaterial color="#333" /></mesh>
      <mesh position={[-0.15, 0.88, 0.1]} castShadow><boxGeometry args={[0.2, 0.18, 0.2]} /><meshStandardMaterial color="#a3a6ab" /></mesh>
    </group>
  );
}

// ===== Lagerhaus: grosse Scheune mit Tor, wird ab Level 4 höher =====
function Lagerhaus({ level }: { level: number }) {
  const stock = level >= 4 ? 2 : 1;
  const grau = dachFarben('#5a6470');
  const z = -0.35;
  return (
    <group>
      {Array.from({ length: stock }, (_, e) => (
        <group key={e}>
          <Raum x={-0.5} z={z} ebene={e} w={{ W: 'wallWood', N: 'wallWood', S: e === 0 ? 'wallWoodDoorwaySquareWide' : 'wallWoodWindowShutters' }} />
          <Raum x={0.5} z={z} ebene={e} w={{ E: 'wallWood', N: 'wallWood', S: 'wallWoodWindowShutters' }} />
        </group>
      ))}
      <Teil m="stadt/roofGable" p={[-0.5, stock, z]} farben={grau} />
      <Teil m="stadt/roofGable" p={[0.5, stock, z]} farben={grau} />
      <Teil m="stadt/cartHigh" p={[0.65, 0, 0.7]} r={Math.PI / 2} s={0.7} />
      {level >= 2 && <Teil m="natur/log_stack" p={[-0.65, 0, 0.7]} r={Math.PI / 2} s={1.4} />}
      {level >= 3 && <Teil m="natur/pot_large" p={[0.05, 0, 0.75]} s={1.6} />}
    </group>
  );
}

function Modell({ b }: { b: PlacedBuilding }) {
  switch (b.type) {
    case 'townhall': return <Rathaus level={b.level} />;
    case 'lumberjack': return <Holzfaeller level={b.level} />;
    case 'quarry': return <Steinbruch level={b.level} />;
    case 'house': return <Wohnhaus level={b.level} id={b.id} />;
    case 'warehouse': return <Lagerhaus level={b.level} />;
  }
}

// Ein Gebäude auf seinem Feld: wächst beim Bauen aus dem Boden, hüpft beim Verbessern
export function Gebaeude({ b, ausgewaehlt, onTipp }: { b: PlacedBuilding; ausgewaehlt: boolean; onTipp: (id: number) => void }) {
  const gruppe = useRef<Group>(null!);
  const huepf = useRef({ level: b.level, t: 0 });
  const pos = feldZuWelt(b.x, b.y);
  const schild = useMemo(() => textTextur(`Lvl ${b.level}`, '#3d2a00', '#ffc93c'), [b.level]);

  useFrame((_, dt) => {
    const h = huepf.current;
    if (h.level !== b.level) { h.level = b.level; h.t = 0; }
    h.t = Math.min(1, h.t + dt * 2.2);
    // Federnde Animation: von 0 auf volle Grösse mit leichtem Überschwingen
    const k = h.t >= 1 ? 1 : 1 - Math.pow(1 - h.t, 3) + Math.sin(h.t * Math.PI) * 0.15;
    gruppe.current.scale.setScalar(MASS * Math.max(0.01, k));
  });

  const tipp = (e: ThreeEvent<MouseEvent>) => { if (e.delta > 10) return; e.stopPropagation(); onTipp(b.id); };

  return (
    <group position={pos}>
      <group ref={gruppe} onClick={tipp}>
        <Modell b={b} />
      </group>
      {ausgewaehlt && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
            <ringGeometry args={[1.15, 1.32, 48]} />
            <meshBasicMaterial color="#ffc93c" />
          </mesh>
          <sprite position={[0, 3.2, 0]} scale={[schild.verhaeltnis * 0.5, 0.5, 1]}>
            <spriteMaterial map={schild.tex} depthTest={false} />
          </sprite>
        </>
      )}
    </group>
  );
}

// Durchsichtige Vorschau beim Platzieren
export function GebaeudeVorschau({ x, y, ok, symbol }: { x: number; y: number; ok: boolean; symbol: string }) {
  const pos = feldZuWelt(x, y);
  const schild = useMemo(() => textTextur(symbol), [symbol]);
  const box = useRef<Mesh>(null!);
  useFrame(({ clock }) => { box.current.position.y = 0.7 + Math.sin(clock.elapsedTime * 4) * 0.06; });
  const farbe = ok ? '#36d17f' : '#ff5c5c';
  return (
    <group position={pos}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <planeGeometry args={[1.9, 1.9]} />
        <meshBasicMaterial color={farbe} transparent opacity={0.45} />
      </mesh>
      <mesh ref={box}>
        <boxGeometry args={[1.7, 1.2, 1.7]} />
        <meshStandardMaterial color={farbe} transparent opacity={0.3} depthWrite={false} />
      </mesh>
      <sprite position={[0, 2.0, 0]} scale={[schild.verhaeltnis * 0.6, 0.6, 1]}>
        <spriteMaterial map={schild.tex} depthTest={false} />
      </sprite>
    </group>
  );
}

// Alle Modelle, die die Gebäude benutzen (werden beim Start geladen)
export const GEBAEUDE_MODELLE = [
  'stadt/wall', 'stadt/wallDoor', 'stadt/wallWindowStone', 'stadt/wallWindowShutters', 'stadt/wallWood', 'stadt/wallWoodDoor',
  'stadt/wallWoodWindowShutters', 'stadt/wallWoodDoorwaySquareWide', 'stadt/roofCorner', 'stadt/roofGable', 'stadt/roofHighPoint',
  'stadt/bannerRed', 'stadt/lantern', 'stadt/chimney', 'stadt/fence', 'stadt/fenceGate', 'stadt/cart', 'stadt/cartHigh', 'stadt/planks',
  'natur/plant_bushLarge', 'natur/flower_redA', 'natur/flower_yellowA', 'natur/flower_purpleA', 'natur/log_stack', 'natur/log_stackLarge',
  'natur/stump_roundDetailed', 'natur/stone_tallA', 'natur/stone_tallB', 'natur/stone_largeB', 'natur/stone_smallA', 'natur/stone_smallB', 'natur/pot_large'
];

export type { V3 };
