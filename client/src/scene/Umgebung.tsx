import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { CanvasTexture, Object3D, RepeatWrapping, SRGBColorSpace, type DirectionalLight, type Group, type InstancedMesh } from 'three';
import { GRID_SIZE, seededRandom } from '@empire/shared';
import { STADT_HALB, TILE, feldSchluessel, feldZuWelt } from '../game/coords';
import { spielerPos } from '../game/effects';
import { Teil } from './modelle';

// ===== Licht: Himmel + Sonne, die dem Bürgermeister folgt (für scharfe Schatten) =====
export function Licht() {
  const sonne = useRef<DirectionalLight>(null!);
  const { scene } = useThree();
  useEffect(() => {
    const ziel = sonne.current.target;
    scene.add(ziel);
    return () => { scene.remove(ziel); };
  }, [scene]);
  useFrame(() => {
    sonne.current.position.set(spielerPos.x + 14, 26, spielerPos.z + 10);
    sonne.current.target.position.set(spielerPos.x, 0, spielerPos.z);
    sonne.current.target.updateMatrixWorld();
  });
  return (
    <>
      <hemisphereLight args={['#e6f2ff', '#5d6b45', 1.1]} />
      <directionalLight
        ref={sonne} castShadow intensity={2.4} color="#fff1dc"
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02}
        shadow-camera-left={-26} shadow-camera-right={26} shadow-camera-top={26} shadow-camera-bottom={-26}
        shadow-camera-near={1} shadow-camera-far={90}
      />
    </>
  );
}

// Gras mit leichtem Muster
function grasTextur(hell: string, dunkel: string, linien: boolean) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = hell; g.fillRect(0, 0, 128, 128);
  for (let k = 0; k < 900; k++) {
    g.fillStyle = Math.random() < 0.5 ? dunkel : 'rgba(255,255,255,0.08)';
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 3);
  }
  if (linien) { g.strokeStyle = 'rgba(0,0,0,0.07)'; g.lineWidth = 2; g.strokeRect(1, 1, 126, 126); }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

// ===== Boden: grosse Wiese + Stadtgebiet mit feinem Raster =====
export function Boden({ onTipp }: { onTipp: (wx: number, wz: number) => void }) {
  const wiese = useMemo(() => { const t = grasTextur('#78ad55', 'rgba(40,90,30,0.18)', false); t.repeat.set(60, 60); return t; }, []);
  const stadt = useMemo(() => { const t = grasTextur('#86bb60', 'rgba(40,90,30,0.15)', true); t.repeat.set(GRID_SIZE, GRID_SIZE); return t; }, []);
  const tipp = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (e.delta > 10) return; onTipp(e.point.x, e.point.z); };
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow onClick={tipp}>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial map={wiese} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow onClick={tipp}>
        <planeGeometry args={[STADT_HALB * 2, STADT_HALB * 2]} />
        <meshStandardMaterial map={stadt} roughness={1} />
      </mesh>
      {/* Steinrand um das Stadtgebiet */}
      {[[0, -STADT_HALB, STADT_HALB * 2 + 0.6, 0.3], [0, STADT_HALB, STADT_HALB * 2 + 0.6, 0.3], [-STADT_HALB, 0, 0.3, STADT_HALB * 2], [STADT_HALB, 0, 0.3, STADT_HALB * 2]].map(([x, z, b, t], k) => (
        <mesh key={k} position={[x, 0.06, z]} receiveShadow castShadow><boxGeometry args={[b, 0.12, t]} /><meshStandardMaterial color="#c9c2b0" /></mesh>
      ))}
    </group>
  );
}

// ===== Freie Felder beim Bauen grün anzeigen =====
export function FreieFelder({ belegt }: { belegt: Set<string> }) {
  const ref = useRef<InstancedMesh>(null!);
  const felder = useMemo(() => {
    const f: [number, number][] = [];
    for (let y = 0; y < GRID_SIZE; y++) for (let x = 0; x < GRID_SIZE; x++) if (!belegt.has(feldSchluessel(x, y))) f.push([x, y]);
    return f;
  }, [belegt]);
  useEffect(() => {
    const o = new Object3D();
    felder.forEach(([x, y], i) => {
      const [wx, , wz] = feldZuWelt(x, y);
      o.position.set(wx, 0.02, wz); o.rotation.set(-Math.PI / 2, 0, 0); o.updateMatrix();
      ref.current.setMatrixAt(i, o.matrix);
    });
    ref.current.count = felder.length;
    ref.current.instanceMatrix.needsUpdate = true;
  }, [felder]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, GRID_SIZE * GRID_SIZE]} raycast={() => null}>
      <planeGeometry args={[TILE * 0.86, TILE * 0.86]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.22} />
    </instancedMesh>
  );
}

// ===== Wald, Blumen, Berge und Wolken rund um die Stadt (nur Deko) =====
const WALD = ['natur/tree_pineRoundA', 'natur/tree_pineRoundC', 'natur/tree_pineTallA', 'natur/tree_default', 'natur/tree_oak',
  'natur/tree_detailed', 'natur/tree_cone', 'natur/tree_fat', 'natur/tree_pineDefaultA'];
const KLEIN = ['natur/grass_large', 'natur/grass', 'natur/flower_redA', 'natur/flower_yellowA', 'natur/flower_purpleA',
  'natur/plant_bush', 'natur/plant_bushLarge', 'natur/mushroom_redGroup', 'natur/stump_old', 'natur/log'];
export const LANDSCHAFT_MODELLE = [...WALD, ...KLEIN];

export function Landschaft() {
  const deko = useMemo(() => {
    const r = seededRandom(2024);
    const baeume: { m: string; x: number; z: number; s: number; rot: number }[] = [];
    while (baeume.length < 150) {
      const x = (r() * 2 - 1) * 60, z = (r() * 2 - 1) * 55;
      if (Math.abs(x) < STADT_HALB + 4 && Math.abs(z) < STADT_HALB + 4) continue;
      baeume.push({ m: WALD[Math.floor(r() * WALD.length)], x, z, s: 2 + r() * 1.4, rot: r() * 6 });
    }
    const klein: { m: string; x: number; z: number; s: number; rot: number }[] = [];
    while (klein.length < 140) {
      const x = (r() * 2 - 1) * 34, z = (r() * 2 - 1) * 34;
      if (Math.abs(x) < STADT_HALB + 0.8 && Math.abs(z) < STADT_HALB + 0.8) continue;
      klein.push({ m: KLEIN[Math.floor(r() * KLEIN.length)], x, z, s: 1.6 + r() * 0.8, rot: r() * 6 });
    }
    return [...baeume, ...klein];
  }, []);
  const wolken = useRef<Group>(null!);
  useFrame((_, dt) => {
    for (const w of wolken.current.children) { w.position.x += dt * 0.8; if (w.position.x > 70) w.position.x = -70; }
  });
  return (
    <group>
      {deko.map((d, k) => <Teil key={k} m={d.m} p={[d.x, 0, d.z]} r={d.rot} s={d.s} />)}
      {[[-60, -90, 30, 22], [-20, -100, 38, 30], [25, -95, 32, 26], [65, -88, 28, 20]].map(([x, z, r, h], k) => (
        <group key={k} position={[x, 0, z]}>
          <mesh position={[0, h / 2, 0]}><coneGeometry args={[r, h, 7]} /><meshStandardMaterial color="#7d8a7a" flatShading /></mesh>
          <mesh position={[0, h * 0.86, 0]}><coneGeometry args={[r * 0.3, h * 0.28, 7]} /><meshStandardMaterial color="#f4f6f8" flatShading /></mesh>
        </group>
      ))}
      <group ref={wolken}>
        {[[-40, 22, -30], [-5, 25, -45], [30, 21, -25], [55, 24, -50], [10, 23, 10]].map(([x, y, z], k) => (
          <group key={k} position={[x, y, z]}>
            {[[0, 0, 0, 3], [2.6, -0.4, 0.5, 2.2], [-2.5, -0.5, -0.3, 2.3], [0.8, 0.9, 0, 2]].map(([a, b, c, sc], j) => (
              <mesh key={j} position={[a, b, c]} scale={sc}><sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color="#ffffff" roughness={1} /></mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}
