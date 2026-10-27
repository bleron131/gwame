import { forwardRef, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { jetztSek } from '../game/effects';

// Wie eine Figur aussieht
export interface Aussehen {
  jacke: string;
  hose: string;
  haut: string;
  hut: 'zylinder' | 'kappe' | 'tuch' | 'keiner';
  hutFarbe: string;
  schaerpe?: string;   // die rote Schärpe des Bürgermeisters
  haar?: string;
}

// Was die Figur gerade macht (wird jedes Bild gelesen)
export interface Bewegung {
  laeuft: boolean;
  tempo: number;
  schlagAt: number;   // wann zuletzt zugeschlagen wurde (Sekunden)
  werkzeug?: boolean; // Axt in der Hand zeigen?
}

// Ein Quader mit Farbe und Schatten
function Teil({ g, p, c }: { g: [number, number, number]; p: [number, number, number]; c: string }) {
  return (
    <mesh position={p} castShadow>
      <boxGeometry args={g} />
      <meshStandardMaterial color={c} roughness={0.8} />
    </mesh>
  );
}

// Eine Figur aus einfachen Formen: Beine und Arme schwingen beim Laufen
export const Figur = forwardRef<Group, { aussehen: Aussehen; bewegung: MutableRefObject<Bewegung> }>(function Figur({ aussehen: a, bewegung }, ref) {
  const koerper = useRef<Group>(null!);
  const beinL = useRef<Group>(null!), beinR = useRef<Group>(null!);
  const armL = useRef<Group>(null!), armR = useRef<Group>(null!);
  const axt = useRef<Group>(null!);
  const anim = useRef({ phase: 0, amp: 0 });

  useFrame((_, dt) => {
    const b = bewegung.current, an = anim.current;
    if (b.laeuft) an.phase += dt * (4 + b.tempo * 1.6);
    an.amp += ((b.laeuft ? 1 : 0) - an.amp) * Math.min(1, dt * 10);
    const s = Math.sin(an.phase) * 0.7 * an.amp;
    beinL.current.rotation.x = s;
    beinR.current.rotation.x = -s;
    armL.current.rotation.x = -s * 0.8;
    // Zuschlagen: Arm hoch, dann schnell nach unten
    const seit = jetztSek() - b.schlagAt;
    if (seit < 0.35) {
      const k = seit / 0.35;
      armR.current.rotation.x = k < 0.3 ? -2.6 * (k / 0.3) : -2.6 + 2.3 * ((k - 0.3) / 0.7);
    } else {
      armR.current.rotation.x = s * 0.8;
    }
    axt.current.visible = !!b.werkzeug && seit < 0.7;
    koerper.current.position.y = Math.abs(Math.sin(an.phase)) * 0.06 * an.amp;
  });

  return (
    <group ref={ref}>
      <group ref={koerper}>
        {/* Beine */}
        <group ref={beinL} position={[-0.15, 0.86, 0]}>
          <Teil g={[0.24, 0.78, 0.27]} p={[0, -0.4, 0]} c={a.hose} />
          <Teil g={[0.27, 0.15, 0.38]} p={[0, -0.8, 0.05]} c="#2a2a2a" />
        </group>
        <group ref={beinR} position={[0.15, 0.86, 0]}>
          <Teil g={[0.24, 0.78, 0.27]} p={[0, -0.4, 0]} c={a.hose} />
          <Teil g={[0.27, 0.15, 0.38]} p={[0, -0.8, 0.05]} c="#2a2a2a" />
        </group>
        {/* Oberkörper */}
        <Teil g={[0.62, 0.74, 0.36]} p={[0, 1.24, 0]} c={a.jacke} />
        <Teil g={[0.64, 0.1, 0.38]} p={[0, 0.9, 0]} c="#2b2b2b" />
        {a.schaerpe && (
          <mesh position={[0, 1.25, 0]} rotation={[0, 0, 0.7]} castShadow>
            <boxGeometry args={[0.12, 0.95, 0.4]} />
            <meshStandardMaterial color={a.schaerpe} roughness={0.6} />
          </mesh>
        )}
        {/* Arme */}
        <group ref={armL} position={[-0.41, 1.54, 0]}>
          <Teil g={[0.18, 0.6, 0.2]} p={[0, -0.28, 0]} c={a.jacke} />
          <mesh position={[0, -0.62, 0]} castShadow><sphereGeometry args={[0.1, 10, 8]} /><meshStandardMaterial color={a.haut} /></mesh>
        </group>
        <group ref={armR} position={[0.41, 1.54, 0]}>
          <Teil g={[0.18, 0.6, 0.2]} p={[0, -0.28, 0]} c={a.jacke} />
          <mesh position={[0, -0.62, 0]} castShadow><sphereGeometry args={[0.1, 10, 8]} /><meshStandardMaterial color={a.haut} /></mesh>
          {/* Axt (nur beim Zuschlagen sichtbar) */}
          <group ref={axt} position={[0, -0.66, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh position={[0, 0.25, 0]} castShadow><cylinderGeometry args={[0.03, 0.03, 0.7, 6]} /><meshStandardMaterial color="#8b5a2b" /></mesh>
            <mesh position={[0.1, 0.55, 0]} castShadow><boxGeometry args={[0.22, 0.16, 0.04]} /><meshStandardMaterial color="#c9ced6" metalness={0.7} roughness={0.3} /></mesh>
          </group>
        </group>
        {/* Kopf mit Augen */}
        <mesh position={[0, 1.87, 0]} castShadow><sphereGeometry args={[0.25, 16, 12]} /><meshStandardMaterial color={a.haut} roughness={0.8} /></mesh>
        <mesh position={[-0.09, 1.9, 0.225]}><sphereGeometry args={[0.035, 8, 6]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
        <mesh position={[0.09, 1.9, 0.225]}><sphereGeometry args={[0.035, 8, 6]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
        {a.haar && <mesh position={[0, 1.97, -0.04]} castShadow><sphereGeometry args={[0.255, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={a.haar} /></mesh>}
        {/* Hut */}
        {a.hut === 'zylinder' && (
          <group position={[0, 2.08, 0]}>
            <mesh castShadow><cylinderGeometry args={[0.36, 0.36, 0.04, 20]} /><meshStandardMaterial color={a.hutFarbe} /></mesh>
            <mesh position={[0, 0.22, 0]} castShadow><cylinderGeometry args={[0.22, 0.22, 0.42, 20]} /><meshStandardMaterial color={a.hutFarbe} /></mesh>
            <mesh position={[0, 0.07, 0]}><cylinderGeometry args={[0.225, 0.225, 0.07, 20]} /><meshStandardMaterial color="#c9a227" metalness={0.6} roughness={0.3} /></mesh>
          </group>
        )}
        {a.hut === 'kappe' && (
          <group position={[0, 2.0, 0]}>
            <mesh castShadow><sphereGeometry args={[0.27, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={a.hutFarbe} /></mesh>
            <mesh position={[0, 0.01, 0.2]}><boxGeometry args={[0.3, 0.03, 0.22]} /><meshStandardMaterial color={a.hutFarbe} /></mesh>
          </group>
        )}
        {a.hut === 'tuch' && (
          <mesh position={[0, 1.98, -0.02]} castShadow><sphereGeometry args={[0.27, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.2]} /><meshStandardMaterial color={a.hutFarbe} /></mesh>
        )}
      </group>
    </group>
  );
});

export const BUERGERMEISTER: Aussehen = {
  jacke: '#2c4a8c', hose: '#20263a', haut: '#f1c27d', hut: 'zylinder', hutFarbe: '#1d1d24', schaerpe: '#c0392b'
};
