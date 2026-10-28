import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Box3, Vector3, type Group, type Mesh } from 'three';
import { MOEBEL, type MoebelId } from '@empire/shared';
import { jetztSek } from '../game/effects';
import { MOEBEL_MASS, type Gegenstand, type InnenPlan } from '../game/innen';
import { Figur, type Aussehen, type Bewegung } from './Figur';
import { FIGUR_MASS } from './Spieler';
import { useModell } from './modelle';
import { textTextur } from './textSprite';

// Ein Teil aus dem Furniture Kit – auf seine Mitte gestellt (die Modelle haben den Ursprung an einer Ecke)
function MoebelTeil({ m, p = [0, 0, 0], r = 0, s = 1 }: { m: string; p?: [number, number, number]; r?: number; s?: number }) {
  const objekt = useModell('moebel/' + m);
  const mitte = useMemo(() => {
    const box = new Box3().setFromObject(objekt);
    const c = box.getCenter(new Vector3());
    return [-c.x, -box.min.y, -c.z] as const;
  }, [objekt]);
  return (
    <group position={p} rotation={[0, r, 0]} scale={s}>
      <primitive object={objekt} position={mitte} />
    </group>
  );
}

// Ein Möbelstück aus dem Katalog (aus mehreren Teilen)
export function MoebelStueck({ id }: { id: MoebelId }) {
  return (
    <group scale={MOEBEL_MASS}>
      {MOEBEL[id].modelle.map((t, i) => <MoebelTeil key={i} m={t.m} p={t.p} r={t.r} />)}
    </group>
  );
}

// ===== Besondere Dinge, die es nicht im Möbel-Set gibt =====
function Kuh() {
  const kopf = useRef<Group>(null!);
  useFrame(({ clock }) => { kopf.current.rotation.x = Math.sin(clock.elapsedTime * 1.3) * 0.15 + 0.2; });
  const fleck = (x: number, y: number, z: number, g: number) => (
    <mesh position={[x, y, z]}><boxGeometry args={[g, g * 0.6, g * 0.9]} /><meshStandardMaterial color="#2b2b2b" /></mesh>
  );
  return (
    <group>
      <mesh position={[0, 0.55, 0]} castShadow><boxGeometry args={[0.55, 0.45, 1.0]} /><meshStandardMaterial color="#f4f1ea" /></mesh>
      {fleck(0.2, 0.68, 0.1, 0.2)}{fleck(-0.18, 0.6, -0.25, 0.22)}
      {[[-0.2, 0.35], [0.2, 0.35], [-0.2, -0.35], [0.2, -0.35]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.17, z]}><boxGeometry args={[0.1, 0.34, 0.1]} /><meshStandardMaterial color="#f4f1ea" /></mesh>
      ))}
      <group ref={kopf} position={[0, 0.7, 0.55]}>
        <mesh position={[0, 0, 0.12]} castShadow><boxGeometry args={[0.32, 0.3, 0.3]} /><meshStandardMaterial color="#f4f1ea" /></mesh>
        <mesh position={[0, -0.06, 0.29]}><boxGeometry args={[0.26, 0.14, 0.06]} /><meshStandardMaterial color="#e8a0a0" /></mesh>
        {[-0.13, 0.13].map(x => <mesh key={x} position={[x, 0.18, 0.1]}><boxGeometry args={[0.04, 0.1, 0.04]} /><meshStandardMaterial color="#d9cfae" /></mesh>)}
      </group>
    </group>
  );
}

function Huhn() {
  const g = useRef<Group>(null!);
  const versatz = useMemo(() => Math.random() * 6, []);
  useFrame(({ clock }) => { const t = clock.elapsedTime + versatz; g.current.rotation.x = Math.max(0, Math.sin(t * 3)) * 0.5; });
  return (
    <group ref={g}>
      <mesh position={[0, 0.14, 0]} castShadow><sphereGeometry args={[0.13, 10, 8]} /><meshStandardMaterial color="#f2ead8" /></mesh>
      <mesh position={[0, 0.27, 0.08]}><sphereGeometry args={[0.07, 8, 6]} /><meshStandardMaterial color="#f2ead8" /></mesh>
      <mesh position={[0, 0.34, 0.08]}><boxGeometry args={[0.03, 0.05, 0.06]} /><meshStandardMaterial color="#d8312b" /></mesh>
      <mesh position={[0, 0.26, 0.16]}><coneGeometry args={[0.025, 0.06, 6]} /><meshStandardMaterial color="#f0a830" /></mesh>
    </group>
  );
}

function Extra({ art }: { art: NonNullable<Gegenstand['extra']> }) {
  const licht = useRef<Mesh>(null!);
  useFrame(({ clock }) => {
    if (licht.current) ((licht.current.material as unknown) as { emissiveIntensity: number }).emissiveIntensity = 0.8 + Math.sin(clock.elapsedTime * 6) * 0.4;
  });
  const tafel = useMemo(() => (art === 'tafel' ? textTextur('🏆 RANGLISTE', '#ffd45c', '#1f2a1c') : null), [art]);
  switch (art) {
    case 'kuh': return <Kuh />;
    case 'huhn': return <Huhn />;
    case 'heu':
      return (
        <group>
          <mesh position={[0, 0.3, 0]} castShadow><boxGeometry args={[1.0, 0.6, 0.7]} /><meshStandardMaterial color="#e3c770" /></mesh>
          <mesh position={[0.1, 0.85, 0]} castShadow><boxGeometry args={[0.9, 0.5, 0.65]} /><meshStandardMaterial color="#d9bb5e" /></mesh>
        </group>
      );
    case 'saecke':
      return (
        <group>
          {[[-0.3, 0], [0.3, 0.05], [0, 0.45]].map(([x, z], i) => (
            <mesh key={i} position={[x, i === 2 ? 0.55 : 0.25, z * 0.2 + (i === 2 ? 0 : 0)]} castShadow>
              <capsuleGeometry args={[0.2, 0.2, 4, 8]} /><meshStandardMaterial color="#d8c8a0" />
            </mesh>
          ))}
        </group>
      );
    case 'spieltisch':
      return (
        <group>
          {/* Halbrunder Tisch: die gerade Seite beim Croupier, die runde Seite zu den Spielern */}
          <mesh position={[0, 0.5, 0]} castShadow receiveShadow><cylinderGeometry args={[1.1, 1.1, 0.08, 32, 1, false, -Math.PI / 2, Math.PI]} /><meshStandardMaterial color="#1f7a4a" /></mesh>
          <mesh position={[0, 0.5, 0]}><cylinderGeometry args={[1.16, 1.16, 0.06, 32, 1, true, -Math.PI / 2, Math.PI]} /><meshStandardMaterial color="#5a3a22" side={2} /></mesh>
          <mesh position={[0, 0.25, 0.35]} castShadow><boxGeometry args={[1.4, 0.5, 0.6]} /><meshStandardMaterial color="#4a2e1a" /></mesh>
          {/* Karten und Chips auf dem Tisch */}
          {[-0.4, 0, 0.4].map(x => <mesh key={x} position={[x, 0.55, 0.55]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.14, 0.2]} /><meshStandardMaterial color="#ffffff" /></mesh>)}
          {[['#c0392b', -0.6], ['#2980b9', 0.6], ['#f1c40f', 0.2]].map(([c, x]) => (
            <mesh key={String(c)} position={[Number(x), 0.57, 0.25]}><cylinderGeometry args={[0.07, 0.07, 0.06, 12]} /><meshStandardMaterial color={String(c)} /></mesh>
          ))}
          {/* Der Croupier */}
          <group position={[0, 0, -0.75]}>
            <Figur aussehen={CROUPIER} bewegung={{ current: STILL }} skala={FIGUR_MASS * 1.15} />
          </group>
        </group>
      );
    case 'automat':
      return (
        <group>
          <mesh position={[0, 0.55, 0]} castShadow><boxGeometry args={[0.6, 1.1, 0.5]} /><meshStandardMaterial color="#b7322c" /></mesh>
          <mesh ref={licht} position={[0, 0.75, 0.26]}><planeGeometry args={[0.42, 0.3]} /><meshStandardMaterial color="#ffe27a" emissive="#ffcc33" emissiveIntensity={1} /></mesh>
          <mesh position={[0.34, 0.75, 0]}><cylinderGeometry args={[0.025, 0.025, 0.3, 6]} /><meshStandardMaterial color="#cccccc" metalness={0.8} /></mesh>
          <mesh position={[0.34, 0.92, 0]}><sphereGeometry args={[0.05, 8, 6]} /><meshStandardMaterial color="#e74c3c" /></mesh>
        </group>
      );
    case 'ofen':
      return (
        <group>
          <mesh position={[0, 0.55, 0]} castShadow><boxGeometry args={[1.3, 1.1, 0.9]} /><meshStandardMaterial color="#a0522d" /></mesh>
          <mesh position={[0, 1.15, -0.1]}><sphereGeometry args={[0.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#8e4424" /></mesh>
          <mesh ref={licht} position={[0, 0.45, 0.46]}><planeGeometry args={[0.6, 0.4]} /><meshStandardMaterial color="#ff7a1a" emissive="#ff5a00" emissiveIntensity={1} /></mesh>
        </group>
      );
    case 'brote':
      return (
        <group>
          <MoebelTeil m="bookcaseOpen" s={MOEBEL_MASS} />
          {[0.15, 0.42, 0.68].flatMap(y => [-0.12, 0.05].map(x => (
            <mesh key={`${x}-${y}`} position={[x, y, 0.02]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.8]}>
              <capsuleGeometry args={[0.05, 0.1, 4, 8]} /><meshStandardMaterial color="#c8843c" />
            </mesh>
          )))}
        </group>
      );
    case 'kisten':
      return (
        <group>
          {[[0, 0], [0.55, 0.1], [-0.5, 0.2], [0.1, 0.6], [0.3, 0.05]].map(([x, z], i) => (
            <mesh key={i} position={[x, i === 4 ? 0.65 : 0.22, z]} rotation={[0, i * 0.4, 0]} castShadow>
              <boxGeometry args={[0.45, 0.45, 0.45]} /><meshStandardMaterial color={i % 2 ? '#b9824c' : '#a0703f'} />
            </mesh>
          ))}
        </group>
      );
    case 'tafel':
      return (
        <group>
          <mesh position={[0, 0.9, 0.03]}><planeGeometry args={[1.5, 1.0]} /><meshStandardMaterial color="#1f2a1c" /></mesh>
          <mesh position={[0, 1.25, 0.04]}><planeGeometry args={[tafel!.verhaeltnis * 0.2, 0.2]} /><meshBasicMaterial map={tafel!.tex} /></mesh>
          {[0, 1, 2].map(i => <mesh key={i} position={[0, 1.0 - i * 0.18, 0.04]}><planeGeometry args={[1.1 - i * 0.2, 0.06]} /><meshBasicMaterial color="#cfd8c8" /></mesh>)}
        </group>
      );
    case 'fahne':
      return (
        <group>
          <mesh position={[0, 0.7, 0]}><cylinderGeometry args={[0.02, 0.02, 1.4, 6]} /><meshStandardMaterial color="#c9a227" metalness={0.6} /></mesh>
          <mesh position={[0.25, 1.2, 0]}><planeGeometry args={[0.5, 0.32]} /><meshStandardMaterial color="#c0392b" side={2} /></mesh>
        </group>
      );
    case 'buch':
      return (
        <group>
          <mesh position={[0, 0.45, 0]} castShadow><boxGeometry args={[0.4, 0.9, 0.3]} /><meshStandardMaterial color="#6b4628" /></mesh>
          <mesh position={[0, 0.95, 0.02]} rotation={[-0.4, 0, 0]}><boxGeometry args={[0.55, 0.06, 0.4]} /><meshStandardMaterial color="#8e2b2b" /></mesh>
          <mesh position={[0, 0.99, 0.02]} rotation={[-0.4, 0, 0]}><boxGeometry args={[0.48, 0.02, 0.34]} /><meshStandardMaterial color="#f4ecd8" /></mesh>
        </group>
      );
  }
}

const STILL: Bewegung = { laeuft: false, tempo: 0, schlagAt: -9 };
const CROUPIER: Aussehen = { jacke: '#1d1d24', hose: '#1d1d24', haut: '#e0ac69', hut: 'keiner', hutFarbe: '#000', haar: '#3b2a1a', schaerpe: '#c0392b' };

// Wände: hinten und an den Seiten (vorne bleibt offen, damit man hineinschauen kann – wie ein Puppenhaus)
function Waende({ plan }: { plan: InnenPlan }) {
  const { breit: B, tief: T } = plan;
  const h = 1.6;
  const farbe = plan.wand;
  return (
    <group>
      <mesh position={[0, h / 2, -T / 2 - 0.05]} receiveShadow><boxGeometry args={[B + 0.2, h, 0.1]} /><meshStandardMaterial color={farbe} /></mesh>
      <mesh position={[-B / 2 - 0.05, h / 2, 0]} receiveShadow><boxGeometry args={[0.1, h, T + 0.1]} /><meshStandardMaterial color={farbe} /></mesh>
      <mesh position={[B / 2 + 0.05, h / 2, 0]} receiveShadow><boxGeometry args={[0.1, h, T + 0.1]} /><meshStandardMaterial color={farbe} /></mesh>
      {/* Fussleiste und Fenster in der Rückwand */}
      <mesh position={[0, 0.06, -T / 2 + 0.01]}><boxGeometry args={[B, 0.12, 0.04]} /><meshStandardMaterial color="#6b4628" /></mesh>
      {[-B / 4, B / 4].map(x => (
        <group key={x} position={[x, 1.0, -T / 2 + 0.01]}>
          <mesh><planeGeometry args={[0.9, 0.55]} /><meshBasicMaterial color="#bfe3f7" /></mesh>
          <mesh position={[0, 0, 0.01]}><boxGeometry args={[0.95, 0.05, 0.03]} /><meshStandardMaterial color="#ffffff" /></mesh>
          <mesh position={[0, 0, 0.01]}><boxGeometry args={[0.05, 0.6, 0.03]} /><meshStandardMaterial color="#ffffff" /></mesh>
        </group>
      ))}
      {/* Die Tür vorne: ein Rahmen und eine Fussmatte */}
      <group position={[0, 0, T / 2]}>
        {[-0.6, 0.6].map(x => <mesh key={x} position={[x, 0.6, 0]}><boxGeometry args={[0.12, 1.2, 0.12]} /><meshStandardMaterial color="#6b4628" /></mesh>)}
        <mesh position={[0, 1.2, 0]}><boxGeometry args={[1.32, 0.12, 0.12]} /><meshStandardMaterial color="#6b4628" /></mesh>
        <mesh position={[0, 0.012, -0.35]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.0, 0.5]} /><meshStandardMaterial color="#7a5232" /></mesh>
      </group>
      {/* Vorne links und rechts eine niedrige Mauer */}
      {[-1, 1].map(s => (
        <mesh key={s} position={[s * (B / 4 + 0.33), 0.2, T / 2]}><boxGeometry args={[B / 2 - 0.66, 0.4, 0.1]} /><meshStandardMaterial color={farbe} /></mesh>
      ))}
    </group>
  );
}

// Ein Stellplatz im Einrichten-Modus: leuchtender Ring zum Antippen
function Stellplatz({ x, z, belegt, gewaehlt, onTipp }: { x: number; z: number; belegt: boolean; gewaehlt: boolean; onTipp: () => void }) {
  const ring = useRef<Mesh>(null!);
  useFrame(() => { ring.current.scale.setScalar(1 + Math.sin(jetztSek() * 4) * 0.06); });
  const tipp = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onTipp(); };
  return (
    <group position={[x, 0.03, z]} onClick={tipp}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.38, 0.5, 32]} />
        <meshBasicMaterial color={gewaehlt ? '#ffc93c' : belegt ? '#3fa3ff' : '#36d17f'} transparent opacity={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.5, 24]} /><meshBasicMaterial transparent opacity={0.12} color="#ffffff" /></mesh>
    </group>
  );
}

export function Innenraum({ plan, einrichten, gewaehlt, onPlatz, nahZiel }: {
  plan: InnenPlan; einrichten: boolean; gewaehlt: number | null; onPlatz: (i: number) => void; nahZiel: string | null;
}) {
  const boden = plan.boden;
  return (
    <group>
      <color attach="background" args={['#1d1a17']} />
      <ambientLight intensity={0.55} color="#fff2dd" />
      <hemisphereLight args={['#fff6e6', '#6b5a48', 0.6]} />
      <directionalLight position={[3, 7, 6]} intensity={1.5} color="#fff1dc" castShadow
        shadow-mapSize={[1024, 1024]} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} />
      <pointLight position={[0, 2.4, 0]} intensity={8} distance={12} color="#ffd9a0" />
      {/* Boden */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[plan.breit, plan.tief]} /><meshStandardMaterial color={boden} roughness={0.9} /></mesh>
      {Array.from({ length: Math.round(plan.tief / 0.5) - 1 }, (_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, -plan.tief / 2 + (i + 1) * 0.5]}>
          <planeGeometry args={[plan.breit, 0.02]} /><meshBasicMaterial color="#000000" transparent opacity={0.08} />
        </mesh>
      ))}
      <Waende plan={plan} />
      {plan.gegenstaende.map(g => (
        <group key={g.key} position={[g.x, 0, g.z]} rotation={[0, g.r, 0]}>
          {g.moebel && <MoebelStueck id={g.moebel} />}
          {g.teile && (
            <group scale={MOEBEL_MASS}>
              {g.teile.map((t, i) => <MoebelTeil key={i} m={t.m} p={t.p} r={t.r} s={t.s} />)}
            </group>
          )}
          {g.extra && <Extra art={g.extra} />}
        </group>
      ))}
      {/* Was man gerade benutzen kann, leuchtet */}
      {plan.ziele.filter(z => z.key === nahZiel).map(z => (
        <mesh key={z.key} rotation={[-Math.PI / 2, 0, 0]} position={[z.x, 0.02, z.z]}>
          <ringGeometry args={[0.28, 0.36, 28]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
        </mesh>
      ))}
      {einrichten && plan.stellplaetze.map((p, i) => (
        <Stellplatz key={i} x={p.x} z={p.z} belegt={plan.gegenstaende.some(g => g.key === 'platz' + i)} gewaehlt={gewaehlt === i} onTipp={() => onPlatz(i)} />
      ))}
    </group>
  );
}

// Alle Möbel-Modelle, die drinnen vorkommen (zum Vorladen)
export const INNEN_MODELLE = [
  ...new Set([
    ...Object.values(MOEBEL).flatMap(d => d.modelle.map(t => t.m)),
    'bedSingle', 'bedDouble', 'cabinetBedDrawer', 'kitchenBar', 'kitchenBarEnd', 'stoolBar', 'pottedPlant', 'kitchenStove', 'kitchenCabinet',
    'bookcaseClosedWide', 'bookcaseOpen', 'books', 'rugRounded', 'loungeSofa', 'cardboardBoxClosed', 'cardboardBoxOpen', 'desk', 'laptop'
  ])
].map(m => 'moebel/' + m);
