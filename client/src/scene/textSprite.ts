import { CanvasTexture, SRGBColorSpace } from 'three';

// Malt einen Text (mit Emoji) auf ein Bild, das man in 3D als "Sprite" zeigen kann
export function textTextur(text: string, farbe = '#ffffff', hinten?: string): { tex: CanvasTexture; verhaeltnis: number } {
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  const schrift = 'bold 44px Fredoka, system-ui, sans-serif';
  g.font = schrift;
  const b = Math.ceil(g.measureText(text).width) + 36;
  c.width = b; c.height = 68;
  g.font = schrift;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (hinten) {
    g.fillStyle = hinten;
    g.beginPath();
    g.roundRect(2, 4, b - 4, 60, 20);
    g.fill();
  } else {
    g.lineWidth = 8;
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.strokeText(text, b / 2, 36);
  }
  g.fillStyle = farbe;
  g.fillText(text, b / 2, 36);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return { tex, verhaeltnis: b / 68 };
}
