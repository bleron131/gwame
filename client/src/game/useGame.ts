import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BUILDINGS, OFFLINE_LIMIT_SECONDS, RESEARCH, produce,
  type BuildingType, type GameResponse, type GameState, type OfflineReport, type ResearchId, type Stock
} from '@empire/shared';
import { ApiError, api } from '../api/client';

export type Status = 'laden' | 'keinSpiel' | 'bereit' | 'fehler';
export interface Meldung { id: number; text: string; art: 'info' | 'fehler' | 'erfolg' }

let meldungId = 0;

// Hält den Spielstand vom Server und bietet alle Aktionen an
export function useGame() {
  const [state, setState] = useState<GameState | null>(null);
  const [status, setStatus] = useState<Status>('laden');
  const [fehlerText, setFehlerText] = useState('');
  const [offline, setOffline] = useState<OfflineReport | null>(null);
  const [meldungen, setMeldungen] = useState<Meldung[]>([]);
  const zeitVersatz = useRef(0);        // Unterschied zwischen Server-Uhr und Browser-Uhr
  const stateRef = useRef<GameState | null>(null);

  const melden = useCallback((text: string, art: Meldung['art'] = 'info') => {
    const id = ++meldungId;
    setMeldungen(m => [...m.slice(-2), { id, text, art }]);
    setTimeout(() => setMeldungen(m => m.filter(x => x.id !== id)), 3200);
  }, []);

  const uebernehmen = useCallback((r: GameResponse) => {
    // Ist seit dem letzten Mal eine Forschung fertig geworden?
    const vorher = stateRef.current?.forschung.aktiv;
    if (vorher && r.state.forschung.fertig.includes(vorher)) {
      melden(`🔬 Forschung fertig: ${RESEARCH[vorher].icon} ${RESEARCH[vorher].name}`, 'erfolg');
    }
    zeitVersatz.current = r.state.serverTime - Date.now();
    stateRef.current = r.state;
    setState(r.state);
    setStatus('bereit');
    const e = r.events;
    if (e?.levelUp) {
      const neu = (e.unlocked ?? []).map(t => `${BUILDINGS[t].icon} ${BUILDINGS[t].name}`).join(', ');
      melden(`🎉 Level ${e.levelUp}!${neu ? ` Neu: ${neu}` : ''}`, 'erfolg');
    }
    if (r.offline && Object.keys(r.offline.gained).length > 0) setOffline(r.offline);
  }, [melden]);

  const laden = useCallback(async (willkommen: boolean) => {
    try {
      uebernehmen(await api.laden(willkommen));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'NO_SAVE') { setStatus('keinSpiel'); return; }
      const text = e instanceof Error ? e.message : String(e);
      if (stateRef.current) melden(text, 'fehler'); // mitten im Spiel: nur eine Meldung
      else { setFehlerText(text); setStatus('fehler'); }
    }
  }, [uebernehmen, melden]);

  // Beim Start laden, dann alle 15 Sekunden mit dem Server abgleichen
  useEffect(() => {
    laden(true);
    const t = setInterval(() => laden(false), 15000);
    const sichtbar = () => { if (!document.hidden) laden(true); };
    document.addEventListener('visibilitychange', sichtbar);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', sichtbar); };
  }, [laden]);

  // Wenn die laufende Forschung fertig ist, sofort neu laden (nicht erst beim nächsten Abgleich)
  const forschungEnde = state?.forschung.aktiv ? state.forschung.endetAm : 0;
  useEffect(() => {
    if (!forschungEnde) return;
    const warten = forschungEnde - (Date.now() + zeitVersatz.current) + 300;
    const t = setTimeout(() => laden(false), Math.max(300, warten));
    return () => clearTimeout(t);
  }, [forschungEnde, laden]);

  // Eine Aktion ausführen; Fehler werden als Meldung angezeigt
  const ausfuehren = useCallback(async (f: () => Promise<GameResponse>, leiseCodes: string[] = []) => {
    try {
      const r = await f();
      uebernehmen(r);
      return r;
    } catch (e) {
      if (!(e instanceof ApiError && leiseCodes.includes(e.code))) melden(e instanceof Error ? e.message : String(e), 'fehler');
      return null;
    }
  }, [uebernehmen, melden]);

  const aktionen = useMemo(() => ({
    neueStadt: (name: string, ersetzen = false) => ausfuehren(() => api.neueStadt(name, ersetzen)),
    bauen: (type: BuildingType, x: number, y: number) => ausfuehren(() => api.bauen(type, x, y)),
    verbessern: (id: number) => ausfuehren(() => api.verbessern(id)),
    abreissen: (id: number) => ausfuehren(() => api.abreissen(id)),
    abbauen: (nodeId: number) => ausfuehren(() => api.abbauen(nodeId), ['TOO_FAST']),
    forschen: (id: ResearchId) => ausfuehren(() => api.forschen(id)),
    abholen: (aufgabeId: string) => ausfuehren(() => api.abholen(aufgabeId))
  }), [ausfuehren]);

  const serverJetzt = useCallback(() => Date.now() + zeitVersatz.current, []);

  return {
    state, status, fehlerText, offline, meldungen, aktionen, serverJetzt, melden,
    offlineSchliessen: () => setOffline(null),
    nochmal: () => { setStatus('laden'); laden(true); }
  };
}

export type Spiel = ReturnType<typeof useGame>;

// Der aktuelle Vorrat, der flüssig hochzählt (zwischen den Server-Abgleichen)
export function useLiveVorrat(state: GameState | null, serverJetzt: () => number): Stock | null {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick(x => x + 1), 500);
    return () => clearInterval(t);
  }, []);
  if (!state) return null;
  const sekunden = Math.min(OFFLINE_LIMIT_SECONDS, Math.max(0, (serverJetzt() - state.save.lastCalculatedAt) / 1000));
  return produce(state.resources, state.stats, sekunden);
}
