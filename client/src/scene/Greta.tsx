import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type { Group, Sprite } from 'three';
import { TOWNHALL_POS } from '@empire/shared';
import { feldZuWelt } from '../game/coords';
import { spielerPos } from '../game/effects';
import { Figur, type Aussehen, type Bewegung } from './Figur';
import { FIGUR_MASS } from './Spieler';
import { textTextur } from './textSprite';

const AUSSEHEN: Aussehen = { jacke: '#2e8b57', hose: '#5d4037', haut: '#f1c27d', hut: 'tuch', hutFarbe: '#c0392b' };

// Greta, die Beraterin: steht vor dem Rathaus, schaut zum Bürgermeister
// und hat ein Zeichen über dem Kopf. Antippen öffnet die Aufgaben.
export function Greta({ belohnung, onTipp }: { belohnung: boolean; onTipp: () => void }) {
  const [rx, , rz] = feldZuWelt(TOWNHALL_POS.x, TOWNHALL_POS.y);
  const pos: [number, number, number] = [rx + 1.0, 0, rz + 1.0]; // an der vorderen Ecke des Rathauses
  const figur = useRef<Group>(null!);
  const zeichen = useRef<Sprite>(null!);
  const bewegung = useRef<Bewegung>({ laeuft: false, tempo: 0, schlagAt: -9 });
  // "!" = Belohnung wartet, "?" = es gibt eine Aufgabe
  const schild = useMemo(() => belohnung ? textTextur('!', '#3d2a00', '#ffc93c') : textTextur('?', '#1c2433', 'rgba(255,255,255,0.92)'), [belohnung]);

  useFrame(({ clock }, dt) => {
    // Zum Spieler drehen, wenn er in der Nähe ist
    const dx = spielerPos.x - pos[0], dz = spielerPos.z - pos[2];
    const ziel = Math.hypot(dx, dz) < 5 ? Math.atan2(dx, dz) : 0.6;
    const g = figur.current;
    g.rotation.y += Math.atan2(Math.sin(ziel - g.rotation.y), Math.cos(ziel - g.rotation.y)) * Math.min(1, dt * 4);
    // Das Zeichen hüpft
    const h = belohnung ? Math.abs(Math.sin(clock.elapsedTime * 4)) * 0.15 : Math.sin(clock.elapsedTime * 2) * 0.04;
    zeichen.current.position.y = 1.15 + h;
  });

  const tipp = (e: ThreeEvent<MouseEvent>) => { if (e.delta > 10) return; e.stopPropagation(); onTipp(); };
  return (
    <group position={pos} onClick={tipp}>
      <Figur ref={figur} aussehen={AUSSEHEN} bewegung={bewegung} skala={FIGUR_MASS} />
      {/* Unsichtbare, grössere Fläche zum Antippen (die Figur selbst ist klein) */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 1.1, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <sprite ref={zeichen} scale={[schild.verhaeltnis * 0.38, 0.38, 1]}>
        <spriteMaterial map={schild.tex} depthTest={false} />
      </sprite>
    </group>
  );
}
