import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import type { PlacedBuilding } from '@empire/shared';
import { feldZuWelt } from '../game/coords';
import { textTextur } from './textSprite';

// ===== Kleine Bausteine =====
type V3 = [number, number, number];
function Block({ g, p, c, r = 0.8, m = 0 }: { g: V3; p: V3; c: string; r?: number; m?: number }) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <boxGeometry args={g} />
      <meshStandardMaterial color={c} roughness={r} metalness={m} />
    </mesh>
  );
}
// Satteldach: ein liegendes Dreieck-Prisma (First zeigt nach oben)
function Satteldach({ breite, tiefe, hoehe, p, c }: { breite: number; tiefe: number; hoehe: number; p: V3; c: string }) {
  const r = tiefe / Math.sqrt(3);
  return (
    <mesh position={p} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, hoehe / (1.5 * r)]} castShadow>
      <cylinderGeometry args={[r, r, breite, 3, 1, false, Math.PI / 2]} />
      <meshStandardMaterial color={c} roughness={0.7} flatShading />
    </mesh>
  );
}
function Fenster({ p, rot = 0 }: { p: V3; rot?: number }) {
  return (
    <mesh position={p} rotation={[0, rot, 0]}>
      <boxGeometry args={[0.22, 0.22, 0.04]} />
      <meshStandardMaterial color="#9fd8ff" emissive="#4a90c8" emissiveIntensity={0.35} roughness={0.2} />
    </mesh>
  );
}

// ===== Die Modelle =====
function Rathaus({ level }: { level: number }) {
  const fahne = useRef<Mesh>(null!);
  useFrame(({ clock }) => { fahne.current.rotation.y = Math.sin(clock.elapsedTime * 3) * 0.3; });
  const turm = 0.7 + level * 0.25;
  return (
    <group>
      <Block g={[1.95, 0.3, 1.95]} p={[0, 0.15, 0]} c="#b9b2a3" />
      <Block g={[1.55, 1.1, 1.2]} p={[0, 0.85, -0.1]} c="#efe6d2" />
      <mesh position={[0, 1.8, -0.1]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[1.15, 0.8, 4]} />
        <meshStandardMaterial color="#b5452f" roughness={0.7} flatShading />
      </mesh>
      {[-0.5, -0.17, 0.17, 0.5].map(x => (
        <mesh key={x} position={[x, 0.75, 0.66]} castShadow><cylinderGeometry args={[0.06, 0.07, 0.9, 10]} /><meshStandardMaterial color="#ffffff" /></mesh>
      ))}
      <Block g={[1.3, 0.12, 0.42]} p={[0, 1.25, 0.62]} c="#e2d7bf" />
      <Block g={[0.32, 0.55, 0.05]} p={[0, 0.58, 0.51]} c="#5a3b22" />
      <Fenster p={[-0.5, 0.95, 0.51]} /><Fenster p={[0.5, 0.95, 0.51]} />
      {/* Turm wächst mit dem Level */}
      <Block g={[0.42, turm, 0.42]} p={[0, 1.9 + turm / 2, -0.25]} c="#e9dfc8" />
      <mesh position={[0, 1.95 + turm * 0.8, -0.035]}><circleGeometry args={[0.13, 20]} /><meshStandardMaterial color="#ffffff" /></mesh>
      <mesh position={[0, 2.12 + turm, -0.25]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[0.36, 0.45, 4]} /><meshStandardMaterial color="#b5452f" flatShading /></mesh>
      <mesh position={[0, 2.7 + turm, -0.25]}><cylinderGeometry args={[0.02, 0.02, 0.7, 6]} /><meshStandardMaterial color="#666" /></mesh>
      <mesh ref={fahne} position={[0, 2.92 + turm, -0.25]}>
        <planeGeometry args={[0.42, 0.26]} />
        <meshStandardMaterial color="#f1c40f" side={2} />
      </mesh>
    </group>
  );
}

function Holzfaeller({ level }: { level: number }) {
  const stapel = Math.min(9, 2 + level);
  return (
    <group>
      <Block g={[1.25, 0.8, 1.0]} p={[-0.25, 0.4, -0.25]} c="#8b5a2b" />
      {[0.15, 0.4, 0.65].map(y => <Block key={y} g={[1.27, 0.04, 1.02]} p={[-0.25, y, -0.25]} c="#6d4420" />)}
      <Satteldach breite={1.4} tiefe={1.25} hoehe={0.55} p={[-0.25, 1.07, -0.25]} c="#5b3a1e" />
      <Block g={[0.3, 0.5, 0.05]} p={[-0.25, 0.25, 0.26]} c="#3e2614" />
      <Fenster p={[-0.62, 0.5, 0.26]} />
      {/* Holzstapel wird mit dem Level grösser */}
      {Array.from({ length: stapel }, (_, k) => (
        <mesh key={k} position={[0.55, 0.12 + Math.floor(k / 3) * 0.22, 0.25 + (k % 3) * 0.24]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.11, 0.11, 0.75, 10]} />
          <meshStandardMaterial color="#b07a45" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0.6, 0.14, -0.55]} castShadow><cylinderGeometry args={[0.2, 0.22, 0.28, 12]} /><meshStandardMaterial color="#9b6b3c" /></mesh>
      <group position={[0.6, 0.38, -0.55]} rotation={[0.3, 0, 0.5]}>
        <mesh><cylinderGeometry args={[0.025, 0.025, 0.5, 6]} /><meshStandardMaterial color="#7a5230" /></mesh>
        <mesh position={[0.07, 0.2, 0]}><boxGeometry args={[0.16, 0.12, 0.03]} /><meshStandardMaterial color="#c9ced6" metalness={0.7} roughness={0.3} /></mesh>
      </group>
    </group>
  );
}

function Steinbruch({ level }: { level: number }) {
  return (
    <group>
      {[[-0.45, -0.35, 0.55], [0.2, -0.5, 0.45], [-0.1, -0.1, 0.35]].map(([x, z, s], k) => (
        <mesh key={k} position={[x, s * 0.55, z]} scale={[s * 1.4, s, s * 1.2]} rotation={[0.3 * k, k, 0]} castShadow receiveShadow>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={['#8d8f94', '#7b7d83', '#9a9ca1'][k]} roughness={0.95} flatShading />
        </mesh>
      ))}
      {/* Kran aus Holz */}
      <Block g={[0.1, 1.5, 0.1]} p={[0.62, 0.75, 0.1]} c="#8b5a2b" />
      <Block g={[0.9, 0.08, 0.08]} p={[0.3, 1.48, 0.1]} c="#8b5a2b" />
      <Block g={[0.02, 0.5, 0.02]} p={[0.0, 1.2, 0.1]} c="#333" />
      <Block g={[0.25, 0.2, 0.25]} p={[0.0, 0.85, 0.1]} c="#a7a9ae" />
      {/* Wagen mit Steinen */}
      <Block g={[0.55, 0.25, 0.4]} p={[0.3, 0.22, 0.6]} c="#6d4420" />
      {Array.from({ length: Math.min(6, 1 + level) }, (_, k) => (
        <mesh key={k} position={[0.18 + (k % 3) * 0.12, 0.4, 0.55 + Math.floor(k / 3) * 0.12]} castShadow>
          <dodecahedronGeometry args={[0.08, 0]} /><meshStandardMaterial color="#9a9ca1" flatShading />
        </mesh>
      ))}
      {[[0.12, 0.42], [0.48, 0.42], [0.12, 0.78], [0.48, 0.78]].map(([x, z], k) => (
        <mesh key={k} position={[x, 0.09, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.09, 0.09, 0.05, 12]} /><meshStandardMaterial color="#222" /></mesh>
      ))}
    </group>
  );
}

const HAUSFARBEN = ['#f3e9d2', '#e8d5b0', '#f1dcd0', '#dfe7ee', '#f6e7b4'];
const DACHFARBEN = ['#b5452f', '#8e3b2a', '#4f6d7a', '#a0522d'];
function Wohnhaus({ level, id }: { level: number; id: number }) {
  const wand = HAUSFARBEN[id % HAUSFARBEN.length], dach = DACHFARBEN[id % DACHFARBEN.length];
  const stock = level >= 3 ? 2 : 1;
  const h = 0.85 * stock;
  return (
    <group>
      <Block g={[1.25, h, 1.05]} p={[0, h / 2, -0.1]} c={wand} />
      <Satteldach breite={1.4} tiefe={1.3} hoehe={0.6} p={[0, h + 0.2, -0.1]} c={dach} />
      <Block g={[0.18, 0.5, 0.18]} p={[0.35, h + 0.45, -0.25]} c="#8a8a8a" />
      <Block g={[0.28, 0.48, 0.05]} p={[-0.2, 0.24, 0.43]} c="#6b3e1f" />
      <Fenster p={[0.3, 0.5, 0.43]} />
      {stock === 2 && <><Fenster p={[-0.3, 1.25, 0.43]} /><Fenster p={[0.3, 1.25, 0.43]} /></>}
      {/* kleiner Vorgarten */}
      <mesh position={[0.55, 0.18, 0.65]} castShadow><icosahedronGeometry args={[0.2, 0]} /><meshStandardMaterial color="#4f9a3c" flatShading /></mesh>
      {level >= 2 && <mesh position={[-0.6, 0.15, 0.65]} castShadow><icosahedronGeometry args={[0.16, 0]} /><meshStandardMaterial color="#e57fa3" flatShading /></mesh>}
    </group>
  );
}

function Lagerhaus({ level }: { level: number }) {
  return (
    <group>
      <Block g={[1.65, 1.0, 1.35]} p={[0, 0.5, -0.15]} c="#a83a2c" />
      <Satteldach breite={1.8} tiefe={1.6} hoehe={0.6} p={[0, 1.18, -0.15]} c="#4a4f57" />
      <Block g={[0.7, 0.75, 0.05]} p={[0, 0.38, 0.53]} c="#7a2a20" />
      <Block g={[0.72, 0.05, 0.06]} p={[0, 0.38, 0.56]} c="#ffffff" />
      <mesh position={[0, 0.38, 0.56]} rotation={[0, 0, 0.82]}><boxGeometry args={[0.04, 1.0, 0.04]} /><meshStandardMaterial color="#ffffff" /></mesh>
      <mesh position={[0, 0.38, 0.56]} rotation={[0, 0, -0.82]}><boxGeometry args={[0.04, 1.0, 0.04]} /><meshStandardMaterial color="#ffffff" /></mesh>
      {Array.from({ length: Math.min(6, 1 + level) }, (_, k) => (
        <Block key={k} g={[0.3, 0.3, 0.3]} p={[0.62 - (k % 2) * 0.33, 0.15 + Math.floor(k / 2) * 0.3, 0.7]} c="#b08350" />
      ))}
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
  const groesse = Math.min(1.25, 1 + (b.level - 1) * 0.03);
  const schild = useMemo(() => textTextur(`Lvl ${b.level}`, '#3d2a00', '#ffc93c'), [b.level]);

  useFrame((_, dt) => {
    const h = huepf.current;
    if (h.level !== b.level) { h.level = b.level; h.t = 0; }
    h.t = Math.min(1, h.t + dt * 2.2);
    // Federnde Animation: von 0 auf volle Grösse mit leichtem Überschwingen
    const k = h.t >= 1 ? 1 : 1 - Math.pow(1 - h.t, 3) + Math.sin(h.t * Math.PI) * 0.15;
    gruppe.current.scale.setScalar(groesse * Math.max(0.01, k));
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
          <sprite position={[0, 3.6, 0]} scale={[schild.verhaeltnis * 0.55, 0.55, 1]}>
            <spriteMaterial map={schild.tex} depthTest={false} />
          </sprite>
        </>
      )}
    </group>
  );
}

export function GebaeudeVorschau({ x, y, ok, symbol }: { x: number; y: number; ok: boolean; symbol: string }) {
  const pos = feldZuWelt(x, y);
  const schild = useMemo(() => textTextur(symbol), [symbol]);
  const box = useRef<Mesh>(null!);
  useFrame(({ clock }) => { box.current.position.y = 0.8 + Math.sin(clock.elapsedTime * 4) * 0.08; });
  const farbe = ok ? '#36d17f' : '#ff5c5c';
  return (
    <group position={pos}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <planeGeometry args={[1.9, 1.9]} />
        <meshBasicMaterial color={farbe} transparent opacity={0.45} />
      </mesh>
      <mesh ref={box}>
        <boxGeometry args={[1.5, 1.4, 1.5]} />
        <meshStandardMaterial color={farbe} transparent opacity={0.3} depthWrite={false} />
      </mesh>
      <sprite position={[0, 2.3, 0]} scale={[schild.verhaeltnis * 0.8, 0.8, 1]}>
        <spriteMaterial map={schild.tex} depthTest={false} />
      </sprite>
    </group>
  );
}

