-- Die Datenbank speichert nur den Fortschritt des Spielers.
-- Die Spielwerte (Kosten, Produktion …) stehen im Code: shared/src/buildings.ts
-- Neue Spalten für bestehende Tabellen kommen NICHT hierher, sondern in db/migrationen.ts
-- (sonst würden alte Spielstände sie nie bekommen).

-- Ein Spielstand = eine Stadt
CREATE TABLE IF NOT EXISTS game_saves (
    id INTEGER PRIMARY KEY,
    city_name TEXT NOT NULL DEFAULT 'Neuanfang',
    level INTEGER NOT NULL DEFAULT 1,
    experience INTEGER NOT NULL DEFAULT 0,
    seed INTEGER NOT NULL DEFAULT 1,                     -- Samen für die Karte
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_calculated_at INTEGER NOT NULL,                 -- bis hierhin ist die Produktion berechnet (ms)
    last_harvest_at INTEGER NOT NULL DEFAULT 0           -- letzter Schlag des Bürgermeisters (ms)
);

-- Jeder Rohstoff ist eine eigene Zeile. Neue Rohstoffe brauchen keine neue Spalte.
CREATE TABLE IF NOT EXISTS resources (
    save_id INTEGER NOT NULL,
    resource_type TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0 CHECK (amount >= 0),
    PRIMARY KEY (save_id, resource_type),
    FOREIGN KEY (save_id) REFERENCES game_saves(id) ON DELETE CASCADE
);

-- Jedes Gebäude mit Platz und Level. Zwei Gebäude auf einem Feld gehen nicht.
CREATE TABLE IF NOT EXISTS buildings (
    id INTEGER PRIMARY KEY,
    save_id INTEGER NOT NULL,
    building_type TEXT NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (save_id) REFERENCES game_saves(id) ON DELETE CASCADE,
    UNIQUE (save_id, x, y)
);

-- Bäume und Felsen auf der Karte
CREATE TABLE IF NOT EXISTS nodes (
    id INTEGER PRIMARY KEY,
    save_id INTEGER NOT NULL,
    node_type TEXT NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    hits_left INTEGER NOT NULL,
    FOREIGN KEY (save_id) REFERENCES game_saves(id) ON DELETE CASCADE,
    UNIQUE (save_id, x, y)
);

-- Fertige Forschungen (die laufende steht in game_saves.research_active)
CREATE TABLE IF NOT EXISTS research (
    save_id INTEGER NOT NULL,
    research_id TEXT NOT NULL,
    completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (save_id, research_id),
    FOREIGN KEY (save_id) REFERENCES game_saves(id) ON DELETE CASCADE
);

-- Aufgaben von Greta: erledigte (completed = 1) und die aktive mit ihrem Zähler (progress)
CREATE TABLE IF NOT EXISTS quests (
    save_id INTEGER NOT NULL,
    quest_id TEXT NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (save_id, quest_id),
    FOREIGN KEY (save_id) REFERENCES game_saves(id) ON DELETE CASCADE
);

-- Schon erledigte Aktionen. Kommt dieselbe Anfrage zweimal (z. B. Doppelklick),
-- schicken wir die alte Antwort zurück, statt zweimal zu bauen.
CREATE TABLE IF NOT EXISTS processed_actions (
    save_id INTEGER NOT NULL,
    request_id TEXT NOT NULL,
    response TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (save_id, request_id),
    FOREIGN KEY (save_id) REFERENCES game_saves(id) ON DELETE CASCADE
);

-- Die aktuelle (oder letzte) Blackjack-Runde. "data" enthält Karten und Stapel als JSON.
-- Der Stapel liegt nur hier auf dem Server – der Browser sieht ihn nie.
CREATE TABLE IF NOT EXISTS blackjack_games (
    save_id INTEGER PRIMARY KEY,
    data TEXT NOT NULL,
    FOREIGN KEY (save_id) REFERENCES game_saves(id) ON DELETE CASCADE
);
