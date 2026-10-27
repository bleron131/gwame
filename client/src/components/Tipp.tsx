import { BUILDINGS, type GameState, type Stock } from '@empire/shared';

// Ein kleiner Hinweis, was als Nächstes sinnvoll ist
export function Tipp({ state, vorrat }: { state: GameState; vorrat: Stock }) {
  const hat = (t: keyof typeof BUILDINGS) => state.buildings.some(b => b.type === t);
  const cap = state.stats.capacity;
  let text: string | null = null;
  if (!hat('lumberjack') && vorrat.wood < 10) text = '🌳 Lauf zu einem Baum und tippe auf „Fällen“ – so sammelst du Holz.';
  else if (!hat('lumberjack')) text = '🪓 Bau einen Holzfäller (🏗️ Bauen) – dann kommt Holz von allein.';
  else if (!hat('house')) text = '🏠 Bau ein Wohnhaus: Mehr Einwohner zahlen mehr Steuern.';
  else if (state.save.level < 2) text = '⭐ Bauen und Bäume fällen bringt Erfahrung. Ab Level 2 gibt es den Steinbruch.';
  else if (!hat('quarry')) text = '⛏️ Bau einen Steinbruch – Stein brauchst du für bessere Gebäude.';
  else if (cap.wood !== null && vorrat.wood >= cap.wood) text = state.save.level >= 3 ? '📦 Dein Lager ist voll – bau ein Lagerhaus!' : '📦 Dein Lager ist voll – gib Holz aus oder verbessere dein Rathaus.';
  else if (state.save.level < 3) text = '⭐ Ab Level 3 kannst du Lagerhäuser bauen.';
  if (!text) return null;
  return <div className="tipp">{text}</div>;
}
