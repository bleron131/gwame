import { useMemo, useRef, useSyncExternalStore } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Sprite, SpriteMaterial } from 'three';
import { schwebtexteAbo, schwebtexteJetzt, type Schwebtext } from '../game/effects';
import { textTextur } from './textSprite';

// Ein Text wie "+5 🪵", der nach oben fliegt und verblasst
function Text({ t }: { t: Schwebtext }) {
  const sprite = useRef<Sprite>(null!);
  const bild = useMemo(() => textTextur(t.text, t.farbe), [t.text, t.farbe]);
  const alter = useRef(0);
  useFrame((_, dt) => {
    alter.current += dt;
    const k = alter.current / 1.4;
    sprite.current.position.set(t.pos[0], t.pos[1] + 1.8 + k * 1.2, t.pos[2]);
    (sprite.current.material as SpriteMaterial).opacity = Math.max(0, 1 - k * k);
  });
  return (
    <sprite ref={sprite} scale={[bild.verhaeltnis * 0.5, 0.5, 1]}>
      <spriteMaterial map={bild.tex} transparent depthTest={false} />
    </sprite>
  );
}

export function Schwebtexte() {
  const texte = useSyncExternalStore(schwebtexteAbo, schwebtexteJetzt);
  return <>{texte.map(t => <Text key={t.id} t={t} />)}</>;
}
