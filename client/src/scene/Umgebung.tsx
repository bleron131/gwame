import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { CanvasTexture, Object3D, RepeatWrapping, SRGBColorSpace, type DirectionalLight, type Group, type InstancedMesh } from 'three';
import { PARZELLE, WELT, alleParzellen, feldGebiet, parzelleVon, parzellenSchluessel, seededRandom, type Gebiet } from '@empire/shared';
import { PARZELLE_BREIT, TILE, WELT_3D, feldSchluessel, feldZuWelt, parzellenMitte } from '../game/coords';
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

// ===== Boden: grosse Wiese + jede Parzelle, die dir gehört, mit feinem Raster =====
// Das Industrie-Gebiet ist grau gepflastert – solange es gesperrt ist, steht ein Zaun darum.
export function Boden({ besitz, industrie, onTipp }: { besitz: Set<string>; industrie: boolean; onTipp: (wx: number, wz: number) => void }) {
  const wiese = useMemo(() => { const t = grasTextur('#78ad55', 'rgba(40,90,30,0.18)', false); t.repeat.set(60, 60); return t; }, []);
  const stadt = useMemo(() => { const t = grasTextur('#86bb60', 'rgba(40,90,30,0.15)', true); t.repeat.set(PARZELLE, PARZELLE); return t; }, []);
  const pflaster = useMemo(() => { const t = grasTextur('#9a9f9c', 'rgba(0,0,0,0.12)', true); t.repeat.set(PARZELLE, PARZELLE); return t; }, []);
  const kies = useMemo(() => { const t = grasTextur('#a3a58f', 'rgba(60,60,40,0.2)', false); t.repeat.set(PARZELLE, PARZELLE); return t; }, []);
  const tipp = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (e.delta > 10) return; onTipp(e.point.x, e.point.z); };
  const parzellen = alleParzellen();
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow onClick={tipp}>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial map={wiese} roughness={1} />
      </mesh>
      {parzellen.map(p => {
        const meins = besitz.has(parzellenSchluessel(p));
        if (!meins && p.gebiet === 'stadt') return null;
        const [x, , z] = parzellenMitte(p);
        const textur = p.gebiet === 'stadt' ? stadt : meins ? pflaster : kies;
        return (
          <mesh key={parzellenSchluessel(p)} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.005, z]} receiveShadow onClick={tipp}>
            <planeGeometry args={[PARZELLE_BREIT, PARZELLE_BREIT]} />
            <meshStandardMaterial map={textur} roughness={1} />
          </mesh>
        );
      })}
      {!industrie && <IndustrieZaun />}
    </group>
  );
}

// Zaun um das gesperrte Industrie-Gebiet
function IndustrieZaun() {
  const pfosten = useMemo(() => {
    const ind = alleParzellen().filter(p => p.gebiet === 'industrie');
    const minPx = Math.min(...ind.map(p => p.px)), maxPx = Math.max(...ind.map(p => p.px));
    const minPy = Math.min(...ind.map(p => p.py)), maxPy = Math.max(...ind.map(p => p.py));
    const [x0, , z0] = feldZuWelt(minPx * PARZELLE, minPy * PARZELLE);
    const [x1, , z1] = feldZuWelt((maxPx + 1) * PARZELLE - 1, (maxPy + 1) * PARZELLE - 1);
    const l = { x0: x0 - TILE / 2, x1: x1 + TILE / 2, z0: z0 - TILE / 2, z1: z1 + TILE / 2 };
    const p: [number, number][] = [];
    for (let x = l.x0; x <= l.x1 + 0.01; x += 2) { p.push([x, l.z0]); p.push([x, l.z1]); }
    for (let z = l.z0 + 2; z < l.z1; z += 2) { p.push([l.x0, z]); p.push([l.x1, z]); }
    return { p, l };
  }, []);
  const { l } = pfosten;
  const lang = l.x1 - l.x0, tief = l.z1 - l.z0;
  return (
    <group>
      {pfosten.p.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.5, z]} castShadow><boxGeometry args={[0.12, 1, 0.12]} /><meshStandardMaterial color="#6e7378" metalness={0.4} /></mesh>
      ))}
      {[[l.x0 + lang / 2, l.z0, lang, 0.04], [l.x0 + lang / 2, l.z1, lang, 0.04], [l.x0, l.z0 + tief / 2, 0.04, tief], [l.x1, l.z0 + tief / 2, 0.04, tief]].map(([x, z, b, t], i) => (
        [0.35, 0.8].map(h => (
          <mesh key={`${i}-${h}`} position={[x, h, z]}><boxGeometry args={[b, 0.05, t]} /><meshStandardMaterial color="#8a9096" metalness={0.5} /></mesh>
        ))
      ))}
    </group>
  );
}

// ===== Freie Felder beim Bauen hell anzeigen (nur auf deinem Land und im passenden Gebiet) =====
export function FreieFelder({ belegt, besitz, gebiet }: { belegt: Set<string>; besitz: Set<string>; gebiet: Gebiet | 'ueberall' }) {
  const ref = useRef<InstancedMesh>(null!);
  const felder = useMemo(() => {
    const f: [number, number][] = [];
    for (let y = WELT.minY; y <= WELT.maxY; y++) for (let x = WELT.minX; x <= WELT.maxX; x++) {
      const g = feldGebiet(x, y, besitz);
      if (g && (gebiet === 'ueberall' || g === gebiet) && !belegt.has(feldSchluessel(x, y))) f.push([x, y]);
    }
    return f;
  }, [belegt, besitz, gebiet]);
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
  const max = (WELT.maxX - WELT.minX + 1) * (WELT.maxY - WELT.minY + 1);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, max]} raycast={() => null}>
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

// Wo darf Deko stehen? Nicht auf deinem Land und nicht im Industrie-Gebiet.
// (Kaufst du eine Parzelle, verschwindet der Deko-Wald dort – und echte Bäume wachsen.)
const INDUSTRIE_3D = (() => {
  const ind = alleParzellen().filter(p => p.gebiet === 'industrie').map(parzellenMitte);
  const h = PARZELLE_BREIT / 2;
  return { minX: Math.min(...ind.map(m => m[0])) - h, maxX: Math.max(...ind.map(m => m[0])) + h, minZ: Math.min(...ind.map(m => m[2])) - h, maxZ: Math.max(...ind.map(m => m[2])) + h };
})();
function frei(x: number, z: number, besitz: Set<string>, rand: number): boolean {
  const I = INDUSTRIE_3D;
  if (x > I.minX - rand && x < I.maxX + rand && z > I.minZ - rand && z < I.maxZ + rand) return false;
  const f = { x: Math.round(x / TILE + 7.5), y: Math.round(z / TILE + 7.5) };
  for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
    if (besitz.has(parzellenSchluessel(parzelleVon(f.x + dx, f.y + dy)))) return false;
  }
  return true;
}

export function Landschaft({ besitz }: { besitz: Set<string> }) {
  const alle = useMemo(() => {
    const r = seededRandom(2024);
    const W = WELT_3D;
    const baeume: { m: string; x: number; z: number; s: number; rot: number }[] = [];
    for (let k = 0; k < 330; k++) {
      const x = W.minX - 30 + r() * (W.maxX - W.minX + 60), z = W.minZ - 30 + r() * (W.maxZ - W.minZ + 60);
      baeume.push({ m: WALD[Math.floor(r() * WALD.length)], x, z, s: 2 + r() * 1.4, rot: r() * 6 });
    }
    const klein: { m: string; x: number; z: number; s: number; rot: number }[] = [];
    for (let k = 0; k < 180; k++) {
      const x = W.minX - 10 + r() * (W.maxX - W.minX + 20), z = W.minZ - 10 + r() * (W.maxZ - W.minZ + 20);
      klein.push({ m: KLEIN[Math.floor(r() * KLEIN.length)], x, z, s: 1.6 + r() * 0.8, rot: r() * 6 });
    }
    return { baeume, klein };
  }, []);
  const deko = useMemo(() => [
    ...alle.baeume.filter(d => frei(d.x, d.z, besitz, 3)),
    ...alle.klein.filter(d => frei(d.x, d.z, besitz, 0.5))
  ], [alle, besitz]);
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
