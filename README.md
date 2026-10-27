# 🏰 Empire Builder

Ein 3D-Aufbauspiel im Browser: Du bist der Bürgermeister, läufst durch deine Stadt,
fällst Bäume, baust Häuser und machst aus einem kleinen Dorf ein Imperium.
Der Spielstand liegt in einer SQLite-Datenbank auf dem Server – er bleibt also erhalten,
auch wenn du den Browser schliesst. Während du weg bist, produziert deine Stadt weiter (höchstens 8 Stunden).

## Starten

Du brauchst **Node.js 20 oder neuer** (https://nodejs.org, die „LTS“-Version).

```bash
npm install     # einmalig: alle Bausteine herunterladen
npm run dev     # Server und Spiel starten
```

Dann im Browser **http://localhost:5173** öffnen.
Auf dem Handy (im selben WLAN) geht die Adresse, die im Terminal bei „Network“ steht.

Weitere Befehle:

| Befehl | Was es macht |
|---|---|
| `npm test` | Prüft die Spielregeln (Kosten, Lager, Offline-Produktion …) |
| `npm run typecheck` | Sucht Tippfehler im TypeScript-Code |
| `npm run build` | Baut die fertige Webseite in `client/dist` |

## Online spielen (GitHub Pages)

**https://bleron131.github.io/gwame/**

Die Online-Version braucht keinen Server: Die SQLite-Datenbank läuft mit *sql.js* direkt im Browser,
mit genau denselben Spielregeln (`server/src/services`). Der Spielstand wird im Browser gespeichert
(IndexedDB) – jedes Gerät hat also seine eigene Stadt.

Bei jedem Update auf `main` baut GitHub die Seite automatisch neu (`.github/workflows/pages.yml`).
Selbst bauen: `npm run build:pages` → fertige Seite in `client/dist`.

## Steuerung

- **Kamera wechseln:** Knopf oben rechts – 🗺️ Von oben → 🧍 Third Person → 👁️ Ego-Perspektive
- **Laufen von oben:** Finger (oder Maus) auf die Welt legen und ziehen – oder **W A S D** / Pfeiltasten
- **Laufen in Third Person / Ego:** hoch = vorwärts, runter = rückwärts, links/rechts = drehen (W/S und A/D)
- **Zoomen:** Mausrad oder zwei Finger
- **Baum fällen / Felsen abbauen:** hingehen und auf den gelben Knopf tippen (oder **E**)
- **Bauen:** 🏗️ Bauen → Gebäude wählen → auf einen freien Platz tippen → ✓ Bauen
- **Gebäude verbessern oder abreissen:** Gebäude antippen

## So ist das Projekt aufgebaut

```
shared/   Spielregeln, die Server UND Browser benutzen
  src/buildings.ts   alle Gebäude mit Kosten, Produktion, Level  ← hier neue Gebäude eintragen
  src/resources.ts   alle Rohstoffe
  src/rules.ts       Formeln: Verbesserungskosten, Lager, Einwohner, Erfahrung
  src/production.ts  Produktion = Rate × vergangene Zeit (nie über die Lagergrenze)
server/   Node.js + Express + SQLite – entscheidet, was erlaubt ist
  src/db/schema.sql  die Tabellen der Datenbank
  src/services/      Bauen, Abbauen, Speichern, Produktion nachrechnen
  src/routes/game.ts die Adressen (API), die der Browser aufruft
  tests/             automatische Tests
client/   React + three.js – zeigt die 3D-Stadt und die Menüs
  src/scene/         3D: Gebäude, Bürgermeister, Einwohner, Bäume, Landschaft
  src/components/    Menüs: Rohstoffleiste, Baumenü, Gebäude-Info …
  src/game/          Spielstand laden, Steuerung, Wegsuche der Einwohner
```

**Wichtig:** Der Browser zeigt nur an. Ob genug Gold da ist oder ein Platz frei ist,
prüft immer der Server – und zwar in einer *Transaktion*: Entweder klappt alles, oder es wird nichts geändert.

## Die Datenbank

Du musst nichts einrichten. Beim ersten `npm run dev` legt der Server die Datei
`server/data/empire.db` selbst an, mit allen Tabellen aus `server/src/db/schema.sql`.

- **Sie gehört nicht auf GitHub** (steht in `.gitignore`). Jeder Spieler hat seine eigene.
- **Sichern:** Server beenden (Strg+C) und die Datei `empire.db` irgendwohin kopieren.
- **Von vorne anfangen:** ⚙️ im Spiel → neue Stadt – oder bei beendetem Server die Datei löschen.
- **Hineinschauen:** mit dem kostenlosen Programm „DB Browser for SQLite“ (https://sqlitebrowser.org).
  Nur lesen, solange der Server läuft!

## 3D-Modelle

Gebäude, Bäume, Felsen und Blumen stammen aus den kostenlosen Sets von **Kenney** (www.kenney.nl):
*Fantasy Town Kit* und *Nature Kit*, Lizenz **CC0** – frei nutzbar, auch kommerziell.
Sie liegen in `client/public/modelle/` (mit den Lizenzdateien). Die Gebäude werden in
`client/src/scene/Gebaeude.tsx` aus Wänden, Dächern und Türen zusammengesetzt („Baupläne“)
und wachsen mit dem Level. Die Farben werden in `client/src/scene/modelle.tsx` angepasst.

## Ein neues Gebäude hinzufügen

1. In `shared/src/buildings.ts` einen Eintrag anlegen (Name, Kosten, Produktion, ab welchem Level).
2. In `client/src/scene/Gebaeude.tsx` einen Bauplan aus Kenney-Teilen schreiben und in `Modell()` eintragen
   (die verfügbaren Teile siehst du in `client/public/modelle/`).
3. `npm run typecheck` zeigt dir, ob etwas vergessen wurde.

## Fahrplan

- [x] **Phase 1–3:** Datenbank, 3D-Stadt mit Raster, Bauen/Verbessern/Abreissen, Speichern
- [x] **Phase 4 (Anfang):** automatische Produktion, Lagergrenzen, Steuern, Offline-Fortschritt
- [x] **Phase 5 (Anfang):** Einwohner, Erfahrung und Level, freischaltbare Gebäude
- [ ] Nahrung und Produktionsketten (Holz → Sägewerk → Bretter)
- [ ] Forschung und Aufgaben
- [ ] Neue Gebiete, Zeitalter, Handel und Monumente
- [ ] Veröffentlichen (Hosting, Backups, Benutzerkonten)
