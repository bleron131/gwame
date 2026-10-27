import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { spielerPos } from './game/effects';
import './styles.css';

// Nur beim Entwickeln: Position des Bürgermeisters in der Browser-Konsole erreichbar (für Tests)
if (import.meta.env.DEV) (window as unknown as { __empire: unknown }).__empire = { spielerPos };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
