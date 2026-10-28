import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import { bauzeit, type PlacedBuilding } from '@empire/shared';
import { feldZuWelt } from '../game/coords';
import { serverJetzt } from '../game/effects';
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
  if (level >= 8) return <Wohnblock level={level} id={id} />;
  if (level >= 5) return <Mehrfamilienhaus level={level} id={id} />;
  return <Einfamilienhaus level={level} id={id} />;
}

// ===== Mehrfamilienhaus (Level 5–7): doppelt so breit, 2–3 Stockwerke, Blumenkästen =====
function Mehrfamilienhaus({ level, id }: { level: number; id: number }) {
  const stock = level >= 6 ? 3 : 2;
  const fachwerk = id % 2 === 1; // jedes zweite Haus mit Holz-Obergeschoss
  const farben = dachFarben(DACH[id % DACH.length]);
  const z = -0.3;
  const w = (e: number, n: string) => (fachwerk && e > 0 ? n.replace('wall', 'wallWood') : n);
  return (
    <group>
      {Array.from({ length: stock }, (_, e) => (
        <group key={e}>
          <Raum x={-0.5} z={z} ebene={e} w={{ W: w(e, 'wallWindowShutters'), N: w(e, 'wall'), S: w(e, e === 0 ? 'wallDoor' : 'wallWindowShutters') }} />
          <Raum x={0.5} z={z} ebene={e} w={{ E: w(e, 'wallWindowShutters'), N: w(e, 'wall'), S: w(e, 'wallWindowShutters') }} />
          {/* Blumenkästen unter den Fenstern */}
          {e > 0 && [-0.5, 0.5].map(x => (
            <mesh key={x} position={[x, e + 0.25, z + 0.56]} castShadow><boxGeometry args={[0.45, 0.07, 0.1]} /><meshStandardMaterial color="#7d5433" /></mesh>
          ))}
          {e > 0 && [-0.5, 0.5].map(x => (
            <mesh key={'b' + x} position={[x, e + 0.31, z + 0.56]}><boxGeometry args={[0.4, 0.06, 0.08]} /><meshStandardMaterial color={['#e74c3c', '#f1c40f', '#9b59b6'][(id + e) % 3]} /></mesh>
          ))}
        </group>
      ))}
      <Teil m="stadt/roofGable" p={[-0.5, stock, z]} farben={farben} />
      <Teil m="stadt/roofGable" p={[0.5, stock, z]} farben={farben} />
      <Teil m="stadt/chimney" p={[0.6, stock - 0.25, z - 0.1]} r={SEITE.N} />
      <Teil m="stadt/fence" p={[0.5, 0, 0.5]} r={SEITE.S} />
      <Teil m="natur/plant_bushLarge" p={[0.55, 0, 0.75]} s={1.3} />
      {level >= 7 && <Teil m="stadt/lantern" p={[-0.95, 0, 0.6]} s={0.7} />}
    </group>
  );
}

// ===== Wohnblock (Level 8–10): moderner Block über das ganze Feld, 3–5 Stockwerke, Balkone =====
const PUTZ = ['#e8dcc8', '#d9e0e3', '#e9d2bb', '#dfe6d3'];
function Wohnblock({ level, id }: { level: number; id: number }) {
  const stock = level - 5; // Level 8 = 3 Stockwerke … Level 10 = 5
  const putz: Farben = { stone: PUTZ[id % PUTZ.length], stoneDark: '#b9ad9c' };
  const fenster = (e: number, k: number) => ((e + k) % 2 ? 'wallWindowGlass' : 'wallWindowStone');
  return (
    <group>
      {Array.from({ length: stock }, (_, e) => (
        <group key={e}>
          <Raum x={-0.5} z={-0.5} ebene={e} farben={putz} w={{ W: fenster(e, 0), N: fenster(e, 1) }} />
          <Raum x={0.5} z={-0.5} ebene={e} farben={putz} w={{ E: fenster(e, 1), N: fenster(e, 0) }} />
          <Raum x={-0.5} z={0.5} ebene={e} farben={putz} w={{ W: fenster(e, 1), S: e === 0 ? 'wallDoor' : fenster(e, 0) }} />
          <Raum x={0.5} z={0.5} ebene={e} farben={putz} w={{ E: fenster(e, 0), S: fenster(e, 1) }} />
          {/* Balkone vorne (ab dem 1. Stock) */}
          {e > 0 && (
            <group position={[0.5, e, 1.12]}>
              <mesh castShadow receiveShadow><boxGeometry args={[0.8, 0.06, 0.28]} /><meshStandardMaterial color="#c9c4ba" /></mesh>
              <mesh position={[0, 0.17, 0.13]}><boxGeometry args={[0.8, 0.28, 0.03]} /><meshStandardMaterial color="#5a6470" transparent opacity={0.75} /></mesh>
            </group>
          )}
        </group>
      ))}
      {/* Flachdach mit Treppenhaus und Antenne */}
      {[[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].map(([x, z], i) => (
        <Teil key={i} m="stadt/roofFlat" p={[x, stock, z]} farben={{ roof: '#7d858c' }} />
      ))}
      <mesh position={[-0.5, stock + 0.3, -0.5]} castShadow><boxGeometry args={[0.6, 0.5, 0.6]} /><meshStandardMaterial color={PUTZ[id % PUTZ.length]} /></mesh>
      <mesh position={[0.6, stock + 0.5, -0.6]}><cylinderGeometry args={[0.015, 0.015, 0.9, 5]} /><meshStandardMaterial color="#555" /></mesh>
      {level >= 9 && <mesh position={[0.3, stock + 0.2, 0.3]} rotation={[-0.4, 0, 0]} castShadow><boxGeometry args={[0.7, 0.04, 0.45]} /><meshStandardMaterial color="#2c3e66" metalness={0.6} roughness={0.3} /></mesh>}
    </group>
  );
}

function Einfamilienhaus({ level, id }: { level: number; id: number }) {
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

// ===== Strasse: 4 Pflaster-Platten, ohne Rand – so gehen Strassen nahtlos ineinander über =====
const PFLASTER: Farben = { stone: '#cbbd9c' };
function Strasse() {
  return (
    <group position={[0, 0.006, 0]}>
      {[[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].map(([x, z], i) => (
        <Teil key={i} m="stadt/road" p={[x, 0, z]} r={(i % 2) * (Math.PI / 2)} farben={PFLASTER} />
      ))}
    </group>
  );
}

// ===== Bauernhof: kleine Scheune und Getreidefelder (ab Level 3 auch Mais) =====
const WEIZEN: Farben = { woodInner: '#e3bd4f' };
function Feld({ x, z, mais }: { x: number; z: number; mais?: boolean }) {
  return (
    <group position={[x, 0, z]}>
      <Teil m="natur/crops_dirtDoubleRow" s={[0.95, 1, 0.95]} />
      {[[-0.25, -0.22], [0.25, -0.22], [-0.25, 0.25], [0.25, 0.25]].map(([px, pz], i) => (
        mais
          ? <Teil key={i} m="natur/crops_cornStageD" p={[px, 0, pz]} r={i} s={0.7} />
          : <Teil key={i} m="natur/crops_wheatStageB" p={[px, 0, pz]} r={i * 0.4} s={0.95} farben={WEIZEN} />
      ))}
    </group>
  );
}
function Bauernhof({ level }: { level: number }) {
  return (
    <group>
      <Raum x={-0.5} z={-0.5} w={{ W: 'wallWood', N: 'wallWood', E: 'wallWoodWindowShutters', S: 'wallWoodDoor' }} />
      <Teil m="stadt/roofGable" p={[-0.5, 1, -0.5]} r={Math.PI / 2} farben={dachFarben('#a8432c')} />
      <Feld x={0.5} z={-0.5} mais={level >= 3} />
      <Feld x={0.5} z={0.5} />
      <Feld x={-0.5} z={0.5} />
      {level >= 2 && (
        <>
          <Teil m="natur/fence_simple" p={[-0.5, 0, 0.5]} r={Math.PI} />
          <Teil m="natur/fence_simple" p={[0.5, 0, 0.5]} r={Math.PI} />
        </>
      )}
      {level >= 4 && <Teil m="stadt/cartHigh" p={[-0.85, 0, -0.1]} s={0.6} />}
    </group>
  );
}

// ===== Windmühle: Steinturm, Spitzdach und Flügel, die sich drehen =====
function Windmuehle({ level }: { level: number }) {
  const fluegel = useRef<Group>(null!);
  useFrame((_, dt) => { fluegel.current.rotation.x += dt * 0.9; });
  const stock = level >= 3 ? 3 : 2;
  return (
    <group>
      {Array.from({ length: stock }, (_, e) => (
        <Raum key={e} x={0} z={0} ebene={e} w={{
          W: 'wallWindowStone', N: 'wall', E: 'wallWindowStone', S: e === 0 ? 'wallDoor' : 'wallWindowStone'
        }} />
      ))}
      <Teil m="stadt/roofHighPoint" p={[0, stock, 0]} farben={dachFarben('#7d5433')} />
      {/* Die Flügel liegen im Modell quer – darum zuerst nach vorne drehen, dann um die Nabe kreisen */}
      <group position={[0, stock - 0.25, 0.62]} rotation={[0, Math.PI / 2, 0]}>
        <group ref={fluegel}><Teil m="stadt/windmill" s={0.62} /></group>
      </group>
      {/* Mehlsäcke und Getreide */}
      <Teil m="natur/pot_large" p={[-0.75, 0, 0.75]} s={1.4} />
      <Teil m="natur/crops_wheatStageB" p={[0.75, 0, -0.75]} s={1.1} farben={WEIZEN} />
      {level >= 2 && <Teil m="natur/crops_wheatStageB" p={[-0.75, 0, -0.75]} r={1} s={1.1} farben={WEIZEN} />}
      {level >= 3 && <Teil m="stadt/cart" p={[0.8, 0, 0.6]} r={Math.PI / 2} s={0.6} />}
    </group>
  );
}

// ===== Sägewerk: offener Schuppen mit Kreissäge, davor ein Stapel Bretter =====
function Saegewerk({ level }: { level: number }) {
  const saege = useRef<Mesh>(null!);
  useFrame((_, dt) => { saege.current.rotation.z -= dt * 12; });
  const z = -0.4;
  return (
    <group>
      <Raum x={-0.5} z={z} w={{ W: 'poles', N: 'wallWood' }} />
      <Raum x={0.5} z={z} w={{ E: 'poles', N: 'wallWood' }} />
      <Teil m="stadt/roofGable" p={[-0.5, 1, z]} farben={dachFarben('#6b4a2b')} />
      <Teil m="stadt/roofGable" p={[0.5, 1, z]} farben={dachFarben('#6b4a2b')} />
      {/* Werkbank mit Baumstamm und Säge */}
      <mesh position={[0, 0.22, z]} castShadow receiveShadow><boxGeometry args={[1.3, 0.08, 0.45]} /><meshStandardMaterial color="#8a5a32" /></mesh>
      {[-0.55, 0.55].map(x => (
        <mesh key={x} position={[x, 0.1, z]} castShadow><boxGeometry args={[0.08, 0.2, 0.4]} /><meshStandardMaterial color="#6b4628" /></mesh>
      ))}
      <Teil m="natur/log_large" p={[-0.25, 0.26, z - 0.02]} s={[0.7, 0.7, 0.7]} />
      <mesh ref={saege} position={[0.32, 0.33, z]} castShadow>
        <cylinderGeometry args={[0.17, 0.17, 0.02, 20]} />
        <meshStandardMaterial color="#c9ced6" metalness={0.8} roughness={0.25} />
      </mesh>
      {/* Fertige Bretter: mehr Bretter bei höherem Level */}
      {Array.from({ length: Math.min(7, 2 + level) }, (_, i) => (
        <mesh key={i} position={[0.35, 0.035 + i * 0.065, 0.6]} rotation={[0, (i % 2) * 0.08, 0]} castShadow>
          <boxGeometry args={[0.95, 0.055, 0.28]} />
          <meshStandardMaterial color={i % 2 ? '#d9a86c' : '#e3b57a'} />
        </mesh>
      ))}
      <Teil m="natur/log_stack" p={[-0.55, 0, 0.6]} r={Math.PI / 2} s={1.3} />
    </group>
  );
}

// ===== Bäckerei: Steinhaus mit rauchendem Kamin und einem Marktstand =====
function Rauch({ p }: { p: V3 }) {
  const wolken = useRef<Group>(null!);
  useFrame(({ clock }) => {
    wolken.current.children.forEach((w, i) => {
      const t = (clock.elapsedTime * 0.35 + i / 3) % 1; // jede Wolke steigt auf und fängt unten neu an
      w.position.set(Math.sin(t * 5 + i) * 0.06, t * 0.9, 0);
      w.scale.setScalar(0.08 + t * 0.14);
      ((w as Mesh).material as { opacity: number }).opacity = 0.55 * (1 - t);
    });
  });
  return (
    <group ref={wolken} position={p}>
      {[0, 1, 2].map(i => (
        <mesh key={i}><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial color="#e8e8e8" transparent depthWrite={false} /></mesh>
      ))}
    </group>
  );
}
function Baeckerei({ level }: { level: number }) {
  const stock = level >= 3 ? 2 : 1;
  const z = -0.35;
  return (
    <group>
      {Array.from({ length: stock }, (_, e) => (
        <group key={e}>
          <Raum x={-0.5} z={z} ebene={e} w={{ W: 'wallWindowStone', N: 'wall', S: e === 0 ? 'wallDoor' : 'wallWindowShutters' }} />
          <Raum x={0.5} z={z} ebene={e} w={{ E: 'wallWindowStone', N: 'wall', S: 'wallWindowShutters' }} />
        </group>
      ))}
      <Teil m="stadt/roofGable" p={[-0.5, stock, z]} farben={dachFarben('#8e3b2a')} />
      <Teil m="stadt/roofGable" p={[0.5, stock, z]} farben={dachFarben('#8e3b2a')} />
      <Teil m="stadt/chimney" p={[0.6, stock - 0.25, z - 0.1]} r={SEITE.N} />
      <Rauch p={[0.62, stock + 0.75, z - 0.1]} />
      <Teil m="stadt/stallRed" p={[0.35, 0, 0.62]} s={0.62} />
      {/* Brotkorb */}
      <mesh position={[-0.55, 0.1, 0.65]} castShadow><boxGeometry args={[0.4, 0.2, 0.3]} /><meshStandardMaterial color="#9a6a3a" /></mesh>
      {[-0.65, -0.55, -0.45].map((x, i) => (
        <mesh key={i} position={[x, 0.23, 0.65]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.75]} castShadow>
          <capsuleGeometry args={[0.045, 0.08, 4, 8]} />
          <meshStandardMaterial color="#c8843c" />
        </mesh>
      ))}
      {level >= 2 && <Teil m="natur/log_stack" p={[-0.85, 0, -0.2]} s={1.1} />}
    </group>
  );
}

// ===== Spielhalle: Steinhaus mit lila Dach, Fahnen und leuchtendem Schild =====
function Spielhalle({ level }: { level: number }) {
  const stock = level >= 3 ? 2 : 1;
  const z = -0.35;
  const schild = useMemo(() => textTextur('♠ SPIELHALLE ♥', '#ffd45c', '#3a1f4d'), []);
  const licht = useRef<Mesh>(null!);
  // Das Schild blinkt ein bisschen wie Leuchtreklame
  useFrame(({ clock }) => {
    ((licht.current.material as unknown) as { emissiveIntensity: number }).emissiveIntensity = 0.5 + Math.abs(Math.sin(clock.elapsedTime * 2)) * 0.6;
  });
  const lila = dachFarben('#5b2a6e');
  return (
    <group>
      {Array.from({ length: stock }, (_, e) => (
        <group key={e}>
          <Raum x={-0.5} z={z} ebene={e} w={{ W: 'wallWindowStone', N: 'wall', S: e === 0 ? 'wallDoor' : 'wallWindowShutters' }} />
          <Raum x={0.5} z={z} ebene={e} w={{ E: 'wallWindowStone', N: 'wall', S: e === 0 ? 'wallWindowGlass' : 'wallWindowShutters' }} />
        </group>
      ))}
      <Teil m="stadt/roofGable" p={[-0.5, stock, z]} farben={lila} />
      <Teil m="stadt/roofGable" p={[0.5, stock, z]} farben={lila} />
      <mesh ref={licht} position={[0, 0.9, z + 0.53]}>
        <planeGeometry args={[schild.verhaeltnis * 0.2, 0.2]} />
        <meshStandardMaterial map={schild.tex} emissive="#ffd45c" emissiveMap={schild.tex} emissiveIntensity={0.8} />
      </mesh>
      <Teil m="stadt/bannerGreen" p={[-0.5, stock - 1, z]} r={SEITE.S} />
      <Teil m="stadt/bannerGreen" p={[0.5, stock - 1, z]} r={SEITE.S} />
      <Teil m="stadt/lantern" p={[-0.95, 0, 0.55]} s={0.7} />
      <Teil m="stadt/lantern" p={[0.95, 0, 0.55]} s={0.7} />
      {level >= 2 && <Teil m="natur/plant_bushLarge" p={[0.5, 0, 0.65]} s={1.4} />}
      {level >= 4 && <Teil m="stadt/fountainRound" p={[-0.4, 0, 0.7]} s={0.35} />}
    </group>
  );
}

// ===== Industrie =====
const ERZ: Farben = { stone: '#6b4a3a', stoneDark: '#57392c' };
const BETON: Farben = { stone: '#9a9894', stoneDark: '#7c7a77' };

// Erzmine: Berg mit Stollen, Schienen und einem Grubenwagen, der hin und her fährt
function Erzmine({ level }: { level: number }) {
  const wagen = useRef<Group>(null!);
  useFrame(({ clock }) => { wagen.current.position.z = 0.1 + Math.sin(clock.elapsedTime * 0.8) * 0.45; });
  return (
    <group>
      <Teil m="natur/stone_largeB" p={[-0.2, 0, -0.55]} s={3.2} />
      <Teil m="natur/stone_tallA" p={[0.6, 0, -0.6]} r={1} s={2.4} />
      {/* Stolleneingang */}
      <mesh position={[-0.05, 0.38, -0.02]}><boxGeometry args={[0.55, 0.75, 0.1]} /><meshStandardMaterial color="#1b1612" /></mesh>
      {[-0.32, 0.22].map(x => <mesh key={x} position={[x, 0.4, 0.02]} castShadow><boxGeometry args={[0.08, 0.8, 0.08]} /><meshStandardMaterial color="#7d5433" /></mesh>)}
      <mesh position={[-0.05, 0.82, 0.02]} castShadow><boxGeometry args={[0.7, 0.08, 0.1]} /><meshStandardMaterial color="#7d5433" /></mesh>
      {/* Schienen */}
      {[-0.17, 0.07].map(x => <mesh key={x} position={[x, 0.02, 0.45]}><boxGeometry args={[0.03, 0.03, 1.0]} /><meshStandardMaterial color="#8a8f95" metalness={0.7} /></mesh>)}
      <group ref={wagen} position={[-0.05, 0, 0.1]}>
        <mesh position={[0, 0.13, 0]} castShadow><boxGeometry args={[0.32, 0.16, 0.38]} /><meshStandardMaterial color="#5d6166" metalness={0.5} /></mesh>
        <mesh position={[0, 0.23, 0]}><boxGeometry args={[0.26, 0.06, 0.3]} /><meshStandardMaterial color="#6b4a3a" /></mesh>
      </group>
      {Array.from({ length: Math.min(4, level + 1) }, (_, k) => (
        <Teil key={k} m={k % 2 ? 'natur/stone_smallA' : 'natur/stone_smallB'} p={[0.55 + (k % 2) * 0.25, 0, 0.35 + Math.floor(k / 2) * 0.3]} r={k} s={1.5} farben={ERZ} />
      ))}
      <Teil m="stadt/lantern" p={[-0.6, 0, 0.3]} s={0.6} />
    </group>
  );
}

// Stahlwerk: dunkle Halle, zwei rauchende Schlote, ein glühender Ofen
function Stahlwerk({ level }: { level: number }) {
  const glut = useRef<Mesh>(null!);
  useFrame(({ clock }) => {
    ((glut.current.material as unknown) as { emissiveIntensity: number }).emissiveIntensity = 1.2 + Math.sin(clock.elapsedTime * 5) * 0.4;
  });
  const z = -0.3;
  return (
    <group>
      {[0, ...(level >= 4 ? [1] : [])].map(e => (
        <group key={e}>
          <Raum x={-0.5} z={z} ebene={e} farben={BETON} w={{ W: 'wall', N: 'wall', S: e === 0 ? 'wallDoorwaySquareWide' : 'wallWindowStone' }} />
          <Raum x={0.5} z={z} ebene={e} farben={BETON} w={{ E: 'wall', N: 'wall', S: 'wallWindowStone' }} />
        </group>
      ))}
      {[-0.5, 0.5].map(x => <Teil key={x} m="stadt/roofFlat" p={[x, level >= 4 ? 2 : 1, z]} farben={{ roof: '#4a4f55' }} />)}
      <mesh ref={glut} position={[-0.5, 0.35, z + 0.45]}><boxGeometry args={[0.5, 0.45, 0.05]} /><meshStandardMaterial color="#ff7a1a" emissive="#ff5a00" emissiveIntensity={1.2} /></mesh>
      {[-0.65, -0.3].map((x, i) => (
        <group key={x}>
          <mesh position={[x, (level >= 4 ? 2 : 1) + 0.6 + i * 0.15, -0.65]} castShadow><cylinderGeometry args={[0.1, 0.13, 1.2 + i * 0.3, 10]} /><meshStandardMaterial color="#8a5a44" /></mesh>
          <Rauch p={[x, (level >= 4 ? 2 : 1) + 1.3 + i * 0.3, -0.65]} />
        </group>
      ))}
      <Teil m="natur/stone_smallB" p={[0.6, 0, 0.6]} s={1.6} farben={ERZ} />
      <mesh position={[0.1, 0.06, 0.7]} castShadow><boxGeometry args={[0.5, 0.12, 0.25]} /><meshStandardMaterial color="#9aa3ad" metalness={0.8} roughness={0.3} /></mesh>
    </group>
  );
}

// Maschinenfabrik: Halle mit Sägezahn-Dach, drehendes Zahnrad, Fliessband mit Kisten
function Maschinenfabrik({ level }: { level: number }) {
  const rad = useRef<Group>(null!);
  const band = useRef<Group>(null!);
  useFrame(({ clock }, dt) => {
    rad.current.rotation.z += dt * 0.8;
    band.current.children.forEach((k, i) => { k.position.x = ((clock.elapsedTime * 0.3 + i / 3) % 1) * 1.6 - 0.8; });
  });
  const z = -0.35;
  const stock = level >= 5 ? 2 : 1;
  return (
    <group>
      {Array.from({ length: stock }, (_, e) => (
        <group key={e}>
          <Raum x={-0.5} z={z} ebene={e} farben={BETON} w={{ W: 'wallWindowGlass', N: 'wall', S: e === 0 ? 'wallDoorwaySquareWide' : 'wallWindowGlass' }} />
          <Raum x={0.5} z={z} ebene={e} farben={BETON} w={{ E: 'wallWindowGlass', N: 'wall', S: 'wallWindowGlass' }} />
        </group>
      ))}
      <Teil m="stadt/roofGable" p={[-0.5, stock, z]} r={Math.PI / 2} farben={dachFarben('#5b6f82')} />
      <Teil m="stadt/roofGable" p={[0.5, stock, z]} r={Math.PI / 2} farben={dachFarben('#5b6f82')} />
      {/* Zahnrad an der Wand */}
      <group ref={rad} position={[0.5, stock - 0.45, z + 0.56]}>
        <mesh><cylinderGeometry args={[0.2, 0.2, 0.05, 16]} /><meshStandardMaterial color="#d4a017" metalness={0.7} roughness={0.3} /></mesh>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} rotation={[0, (i / 8) * Math.PI * 2, 0]} position={[Math.cos((i / 8) * Math.PI * 2) * 0.22, 0, -Math.sin((i / 8) * Math.PI * 2) * 0.22]}>
            <boxGeometry args={[0.08, 0.05, 0.06]} /><meshStandardMaterial color="#d4a017" metalness={0.7} />
          </mesh>
        ))}
      </group>
      {/* Fliessband */}
      <mesh position={[0, 0.12, 0.68]} receiveShadow><boxGeometry args={[1.7, 0.08, 0.3]} /><meshStandardMaterial color="#2f3439" /></mesh>
      <group ref={band} position={[0, 0.22, 0.68]}>
        {[0, 1, 2].map(i => <mesh key={i} castShadow><boxGeometry args={[0.18, 0.13, 0.18]} /><meshStandardMaterial color={i % 2 ? '#c98b4a' : '#9aa3ad'} metalness={i % 2 ? 0 : 0.7} /></mesh>)}
      </group>
    </group>
  );
}

// Möbelfirma: Holzwerkstatt mit Stühlen und Tischen davor
function Moebelfirma({ level }: { level: number }) {
  const z = -0.35;
  const stuhl = (x: number, zz: number, r: number, farbe: string) => (
    <group position={[x, 0, zz]} rotation={[0, r, 0]}>
      <mesh position={[0, 0.12, 0]} castShadow><boxGeometry args={[0.16, 0.03, 0.16]} /><meshStandardMaterial color={farbe} /></mesh>
      <mesh position={[0, 0.2, -0.07]} castShadow><boxGeometry args={[0.16, 0.18, 0.03]} /><meshStandardMaterial color={farbe} /></mesh>
      {[[-0.06, -0.06], [0.06, -0.06], [-0.06, 0.06], [0.06, 0.06]].map(([a, b], i) => (
        <mesh key={i} position={[a, 0.055, b]}><boxGeometry args={[0.025, 0.11, 0.025]} /><meshStandardMaterial color={farbe} /></mesh>
      ))}
    </group>
  );
  return (
    <group>
      <Raum x={-0.5} z={z} w={{ W: 'wallWoodWindowShutters', N: 'wallWood', S: 'wallWoodDoorwaySquareWide' }} />
      <Raum x={0.5} z={z} w={{ E: 'wallWoodWindowShutters', N: 'wallWood', S: 'wallWoodWindowShutters' }} />
      <Teil m="stadt/roofGable" p={[-0.5, 1, z]} farben={dachFarben('#7a6a3a')} />
      <Teil m="stadt/roofGable" p={[0.5, 1, z]} farben={dachFarben('#7a6a3a')} />
      {stuhl(-0.55, 0.55, 0.3, '#b9824c')}
      {stuhl(-0.25, 0.7, -0.4, '#8e5b34')}
      {level >= 2 && stuhl(0.65, 0.75, 2.5, '#c9a06a')}
      <mesh position={[0.25, 0.18, 0.55]} castShadow><boxGeometry args={[0.45, 0.04, 0.3]} /><meshStandardMaterial color="#a0703f" /></mesh>
      {[[-0.18, -0.12], [0.18, -0.12], [-0.18, 0.12], [0.18, 0.12]].map(([a, b], i) => (
        <mesh key={i} position={[0.25 + a, 0.08, 0.55 + b]}><boxGeometry args={[0.03, 0.16, 0.03]} /><meshStandardMaterial color="#7d5433" /></mesh>
      ))}
      <Teil m="natur/log_stack" p={[0.8, 0, 0.1]} r={Math.PI / 2} s={1.1} />
    </group>
  );
}

// Handelsfirma: Bürohaus aus Glas, wird mit dem Level höher, Leuchtschild und Fahne
function Handelsfirma({ level }: { level: number }) {
  const stock = Math.min(5, 2 + Math.floor(level / 2));
  const schild = useMemo(() => textTextur('★ HANDEL & CO ★', '#ffffff', '#1f4e8c'), []);
  const fahne = useRef<Mesh>(null!);
  useFrame(({ clock }) => { fahne.current.rotation.y = Math.sin(clock.elapsedTime * 3) * 0.3; });
  const glas: Farben = { stone: '#c7d3dc', stoneDark: '#9fb0bd' };
  return (
    <group>
      {Array.from({ length: stock }, (_, e) => (
        <group key={e}>
          <Raum x={-0.5} z={-0.4} ebene={e} farben={glas} w={{ W: 'wallWindowGlass', N: 'wallWindowGlass', S: e === 0 ? 'wallDoor' : 'wallWindowGlass' }} />
          <Raum x={0.5} z={-0.4} ebene={e} farben={glas} w={{ E: 'wallWindowGlass', N: 'wallWindowGlass', S: 'wallWindowGlass' }} />
        </group>
      ))}
      {[-0.5, 0.5].map(x => <Teil key={x} m="stadt/roofFlat" p={[x, stock, -0.4]} farben={{ roof: '#5b6470' }} />)}
      <mesh position={[0, 1.08, 0.13]}>
        <planeGeometry args={[schild.verhaeltnis * 0.18, 0.18]} />
        <meshStandardMaterial map={schild.tex} emissive="#ffffff" emissiveMap={schild.tex} emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0.8, 0.6, 0.65]}><cylinderGeometry args={[0.02, 0.02, 1.2, 6]} /><meshStandardMaterial color="#777" /></mesh>
      <mesh ref={fahne} position={[0.8, 1.05, 0.65]}><planeGeometry args={[0.35, 0.22]} /><meshStandardMaterial color="#1f4e8c" side={2} /></mesh>
      <Teil m="natur/plant_bushLarge" p={[-0.6, 0, 0.6]} s={1.3} />
      <mesh position={[0.1, 0.04, 0.6]} receiveShadow><boxGeometry args={[0.9, 0.04, 0.5]} /><meshStandardMaterial color="#b8b2a6" /></mesh>
    </group>
  );
}

// ===== Baustelle: Gerüst, Kisten und ein Balken, der zeigt, wie weit der Bau ist =====
function Baustelle({ b, neu, dauer }: { b: PlacedBuilding; neu: boolean; dauer: number }) {
  const balken = useRef<Mesh>(null!);
  useFrame(() => {
    const rest = Math.max(0, ((b.bauEnde ?? 0) - serverJetzt()) / 1000);
    const k = Math.max(0.02, Math.min(1, 1 - rest / Math.max(1, dauer)));
    balken.current.scale.x = k;
    balken.current.position.x = -0.6 + 0.6 * k;
  });
  const hoch = neu ? 1.1 : 2.2;
  return (
    <group>
      {neu && (
        <>
          <mesh position={[0, 0.05, 0]} receiveShadow><boxGeometry args={[1.8, 0.1, 1.8]} /><meshStandardMaterial color="#b8ae9c" /></mesh>
          <Teil m="stadt/planks" p={[0.45, 0.1, 0.45]} s={[0.8, 1, 0.8]} />
          <mesh position={[-0.5, 0.25, 0.5]} castShadow><boxGeometry args={[0.3, 0.3, 0.3]} /><meshStandardMaterial color="#b9824c" /></mesh>
          <mesh position={[-0.2, 0.2, 0.62]} castShadow><boxGeometry args={[0.22, 0.2, 0.22]} /><meshStandardMaterial color="#a0703f" /></mesh>
        </>
      )}
      {/* Gerüst-Stangen an den Ecken */}
      {[[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]].map(([x, z], i) => (
        <mesh key={i} position={[x, hoch / 2, z]} castShadow><boxGeometry args={[0.06, hoch, 0.06]} /><meshStandardMaterial color="#c9a26b" /></mesh>
      ))}
      {[0.6, hoch - 0.05].map(y => (
        <group key={y}>
          <mesh position={[0, y, 0.95]}><boxGeometry args={[1.9, 0.05, 0.08]} /><meshStandardMaterial color="#c9a26b" /></mesh>
          <mesh position={[0, y, -0.95]}><boxGeometry args={[1.9, 0.05, 0.08]} /><meshStandardMaterial color="#c9a26b" /></mesh>
          <mesh position={[0.95, y, 0]}><boxGeometry args={[0.08, 0.05, 1.9]} /><meshStandardMaterial color="#c9a26b" /></mesh>
          <mesh position={[-0.95, y, 0]}><boxGeometry args={[0.08, 0.05, 1.9]} /><meshStandardMaterial color="#c9a26b" /></mesh>
        </group>
      ))}
      {/* Fortschrittsbalken über der Baustelle */}
      <group position={[0, hoch + 0.6, 0]}>
        <mesh><planeGeometry args={[1.3, 0.2]} /><meshBasicMaterial color="#1c2433" depthTest={false} transparent opacity={0.85} /></mesh>
        <mesh ref={balken} position={[0, 0, 0.01]}><planeGeometry args={[1.2, 0.12]} /><meshBasicMaterial color="#ffc93c" depthTest={false} transparent /></mesh>
      </group>
    </group>
  );
}

function Modell({ b }: { b: PlacedBuilding }) {
  switch (b.type) {
    case 'townhall': return <Rathaus level={b.level} />;
    case 'road': return <Strasse />;
    case 'lumberjack': return <Holzfaeller level={b.level} />;
    case 'quarry': return <Steinbruch level={b.level} />;
    case 'house': return <Wohnhaus level={b.level} id={b.id} />;
    case 'farm': return <Bauernhof level={b.level} />;
    case 'windmill': return <Windmuehle level={b.level} />;
    case 'sawmill': return <Saegewerk level={b.level} />;
    case 'bakery': return <Baeckerei level={b.level} />;
    case 'warehouse': return <Lagerhaus level={b.level} />;
    case 'casino': return <Spielhalle level={b.level} />;
    case 'mine': return <Erzmine level={b.level} />;
    case 'steelworks': return <Stahlwerk level={b.level} />;
    case 'factory': return <Maschinenfabrik level={b.level} />;
    case 'furnitureworks': return <Moebelfirma level={b.level} />;
    case 'company': return <Handelsfirma level={b.level} />;
  }
}

// Ein Gebäude auf seinem Feld: wächst beim Bauen aus dem Boden, hüpft beim Verbessern
export function Gebaeude({ b, ausgewaehlt, bauarbeiter, onTipp }: { b: PlacedBuilding; ausgewaehlt: boolean; bauarbeiter: number; onTipp: (id: number) => void }) {
  const gruppe = useRef<Group>(null!);
  // Während des Baus: das alte Level zeigen (bei einem neuen Gebäude nur die Baustelle)
  const baut = (b.bauEnde ?? 0) > serverJetzt();
  const zeigeLevel = baut ? b.level - 1 : b.level;
  const huepf = useRef({ level: zeigeLevel, t: 0 });
  const pos = feldZuWelt(b.x, b.y);
  const schild = useMemo(() => textTextur(`Lvl ${b.level}`, '#3d2a00', '#ffc93c'), [b.level]);

  useFrame((_, dt) => {
    const h = huepf.current;
    if (h.level !== zeigeLevel) { h.level = zeigeLevel; h.t = 0; }
    h.t = Math.min(1, h.t + dt * 2.2);
    // Federnde Animation: von 0 auf volle Grösse mit leichtem Überschwingen
    const k = h.t >= 1 ? 1 : 1 - Math.pow(1 - h.t, 3) + Math.sin(h.t * Math.PI) * 0.15;
    // Strassen ohne Rand, damit sie lückenlos aneinanderpassen
    gruppe.current.scale.setScalar((b.type === 'road' ? 1 : MASS) * Math.max(0.01, k));
  });

  const tipp = (e: ThreeEvent<MouseEvent>) => { if (e.delta > 10) return; e.stopPropagation(); onTipp(b.id); };

  return (
    <group position={pos}>
      <group ref={gruppe} onClick={tipp}>
        {zeigeLevel > 0 && <Modell b={{ ...b, level: zeigeLevel }} />}
        {baut && <Baustelle b={b} neu={zeigeLevel === 0} dauer={bauzeit(b.type, b.level, bauarbeiter)} />}
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
  'natur/stump_roundDetailed', 'natur/stone_tallA', 'natur/stone_tallB', 'natur/stone_largeB', 'natur/stone_smallA', 'natur/stone_smallB', 'natur/pot_large',
  // Strasse und Produktionsketten
  'stadt/road', 'stadt/windmill', 'stadt/poles', 'stadt/stallRed', 'natur/crops_dirtDoubleRow', 'natur/crops_wheatStageB',
  'natur/crops_cornStageD', 'natur/fence_simple', 'natur/log_large',
  // Spielhalle, Wohnblock, Industrie
  'stadt/wallWindowGlass', 'stadt/bannerGreen', 'stadt/fountainRound', 'stadt/roofFlat'
];

export type { V3 };
