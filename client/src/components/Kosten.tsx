import { RESOURCES, RESOURCE_IDS, type Amounts, type Stock } from '@empire/shared';
import { zahl } from '../game/format';

// Zeigt Kosten als kleine Chips. Was du dir nicht leisten kannst, ist rot.
export function Kosten({ kosten, vorrat }: { kosten: Amounts; vorrat: Stock }) {
  const liste = RESOURCE_IDS.filter(r => kosten[r]);
  if (!liste.length) return <span className="kosten gratis">gratis</span>;
  return (
    <span className="kosten">
      {liste.map(r => (
        <span key={r} className={vorrat[r] + 1e-9 >= kosten[r]! ? 'k' : 'k fehlt'}>
          {RESOURCES[r].icon} {zahl(kosten[r]!)}
        </span>
      ))}
    </span>
  );
}
