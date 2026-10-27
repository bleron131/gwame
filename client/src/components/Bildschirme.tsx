import { useState } from 'react';
import type { OfflineReport } from '@empire/shared';
import { dauer, mengenText } from '../game/format';
import { Fenster } from './Blatt';

// Startbildschirm: neue Stadt gründen
export function NeueStadt({ onGruenden, ersetzen, onZurueck }: { onGruenden: (name: string) => void; ersetzen?: boolean; onZurueck?: () => void }) {
  const [name, setName] = useState('');
  const ok = name.trim().length >= 1 && name.trim().length <= 24;
  return (
    <div className="startbild">
      <div className="logo">🏰</div>
      <h1>Empire <span>Builder</span></h1>
      <p>Vom kleinen Dorf zum mächtigen Imperium. Du bist der Bürgermeister – lauf durch deine Stadt, sammle Rohstoffe und bau sie gross!</p>
      <form onSubmit={e => { e.preventDefault(); if (ok) onGruenden(name.trim()); }}>
        <input value={name} onChange={e => setName(e.target.value)} maxLength={24} placeholder="Name deiner Stadt" autoFocus />
        <button className={'knopf gross' + (ok ? '' : ' aus')} disabled={!ok}>{ersetzen ? '🗑️ Alles löschen und neu gründen' : '🏛️ Stadt gründen'}</button>
      </form>
      {onZurueck && <button className="knopf leise" onClick={onZurueck}>Zurück</button>}
    </div>
  );
}

export function Ladebild({ text, onNochmal }: { text: string; onNochmal?: () => void }) {
  return (
    <div className="startbild">
      <div className="logo">{onNochmal ? '🔌' : '🏰'}</div>
      <p>{text}</p>
      {onNochmal && <button className="knopf gross" onClick={onNochmal}>Nochmal versuchen</button>}
    </div>
  );
}

// "Willkommen zurück! Deine Stadt hat produziert …"
export function OfflineFenster({ bericht, onOk }: { bericht: OfflineReport; onOk: () => void }) {
  return (
    <Fenster>
      <div className="gross-emoji">😴</div>
      <h2>Willkommen zurück!</h2>
      <p>Du warst {dauer(bericht.seconds)} weg. Deine Stadt hat weitergearbeitet:</p>
      <div className="betrag">{mengenText(bericht.gained)}</div>
      <button className="knopf gross" onClick={onOk}>Super!</button>
    </Fenster>
  );
}
