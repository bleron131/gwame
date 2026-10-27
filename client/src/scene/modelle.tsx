import { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { Color, MeshStandardMaterial, type Material, type Mesh, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// 3D-Modelle aus den kostenlosen Kenney-Sets (Lizenz CC0, siehe public/modelle/*/LIZENZ-*.txt)
//   "stadt/..." = Fantasy Town Kit (Wände, Dächer, Türen, Brunnen …)
//   "natur/..." = Nature Kit (Bäume, Felsen, Blumen …)

// Unsere Farben: Jedes Material im Modell hat einen Namen (z. B. "stone"),
// und wir geben ihm eine eigene, freundlichere Farbe.
const PALETTE: Record<string, string> = {
  'stadt:stone': '#e3dccb', 'stadt:stoneDark': '#b8ae9c',
  'stadt:wood': '#b9824c', 'stadt:woodDark': '#7d5433',
  'stadt:roof': '#b5452f', 'stadt:roofLight': '#cc5a40', 'stadt:roofRed': '#b5452f', 'stadt:roofRedLight': '#cc5a40',
  'stadt:foliage': '#4f9a3c', 'stadt:water': '#5ab8e8', 'stadt:hay': '#e8c070',
  'natur:grass': '#5fae45', 'natur:leafsGreen': '#4c9a3c', 'natur:leafsDark': '#3c8235', 'natur:leafsFall': '#e08a3c',
  'natur:stone': '#a3a6ab', 'natur:stoneDark': '#80838a',
  'natur:wood': '#a8713f', 'natur:woodBark': '#7a5232', 'natur:woodBarkDark': '#5e3f26', 'natur:woodDark': '#6b4628',
  'natur:woodInner': '#e9c99c', 'natur:woodBirch': '#efe8dc', 'natur:dirt': '#8d6a48', 'natur:dirtDark': '#6e5136',
  'natur:water': '#5ab8e8'
};

const materialCache = new Map<string, Material>();
function farbMaterial(farbe: string, original: Material): Material {
  const key = farbe + (original.transparent ? 't' : '');
  let m = materialCache.get(key);
  if (!m) {
    m = new MeshStandardMaterial({ color: new Color(farbe), roughness: 0.85, metalness: 0, transparent: original.transparent, opacity: (original as MeshStandardMaterial).opacity });
    materialCache.set(key, m);
  }
  return m;
}

export type Farben = Record<string, string>; // z. B. { roof: '#4f6d7a' } = dieses Haus bekommt ein blaues Dach

const url = (name: string) => `/modelle/${name}.glb`;

// Lädt ein Modell (nur einmal pro Datei) und gibt eine eigene Kopie zurück
export function useModell(name: string, farben?: Farben): Object3D {
  const gltf = useLoader(GLTFLoader, url(name));
  const kit = name.split('/')[0];
  const farbenKey = farben ? JSON.stringify(farben) : '';
  return useMemo(() => {
    const kopie = gltf.scene.clone(true);
    kopie.traverse(o => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const tausche = (m: Material) => {
        const farbe = farben?.[m.name] ?? PALETTE[`${kit}:${m.name}`];
        return farbe ? farbMaterial(farbe, m) : m;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(tausche) : tausche(mesh.material);
    });
    return kopie;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf, farbenKey]);
}

type V3 = [number, number, number];

// Ein Teil an eine Stelle setzen: m = Modellname, p = Position, r = Drehung (um die Hochachse), s = Grösse
export function Teil({ m, p = [0, 0, 0], r = 0, s = 1, farben }: { m: string; p?: V3; r?: number; s?: number | V3; farben?: Farben }) {
  const objekt = useModell(m, farben);
  return <primitive object={objekt} position={p} rotation={[0, r, 0]} scale={s} />;
}

// Alle Modelle schon beim Start laden, damit beim Bauen nichts ruckelt
export function modelleVorladen(namen: string[]) {
  useLoader.preload(GLTFLoader, namen.map(url));
}

// ===== Drehungen für Wände =====
// Eine Wand aus dem Baukasten steht immer an der Westkante (links) ihres Feldes.
// Mit diesen Drehungen kommt sie an die anderen Seiten.
export const SEITE = { W: 0, N: -Math.PI / 2, S: Math.PI / 2, E: Math.PI } as const;
export type Seite = keyof typeof SEITE;
