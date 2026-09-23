// File: utils/database.js
const Database = require('better-sqlite3');
const path = require('node:path');

const dbPath = path.join(__dirname, '../vgc_tournament.db');
const db = new Database(dbPath);

function initDatabase() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS players (
            discord_id TEXT PRIMARY KEY,
            in_game_name TEXT NOT NULL,
            team_sheet_url TEXT,
            wins INTEGER DEFAULT 0,
            losses INTEGER DEFAULT 0,
            draws INTEGER DEFAULT 0,
            is_dropped INTEGER DEFAULT 0
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS matches (
            match_id INTEGER PRIMARY KEY AUTOINCREMENT,
            round_number INTEGER NOT NULL,
            player1_id TEXT NOT NULL,
            player2_id TEXT NOT NULL,
            channel_id TEXT,
            winner_id TEXT,
            player1_score INTEGER DEFAULT 0,
            player2_score INTEGER DEFAULT 0,
            reported_by TEXT,
            proof_image TEXT,
            is_proof_submitted INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending'
        )
    `);

    const addColumnIfNotExist = (tableName, columnName, columnDefinition) => {
        const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
        const hasColumn = columns.some(col => col.name === columnName);
        if (!hasColumn) {
            db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
            console.log(`[DATABASE MIGRATION] Đã bổ sung cột '${columnName}' vào bảng '${tableName}'.`);
        }
    };

    addColumnIfNotExist('matches', 'channel_id', 'TEXT');
    addColumnIfNotExist('matches', 'winner_id', 'TEXT');
    addColumnIfNotExist('matches', 'player1_score', 'INTEGER DEFAULT 0');
    addColumnIfNotExist('matches', 'player2_score', 'INTEGER DEFAULT 0');
    addColumnIfNotExist('matches', 'reported_by', 'TEXT');
    addColumnIfNotExist('matches', 'proof_image', 'TEXT');
    addColumnIfNotExist('matches', 'is_proof_submitted', 'INTEGER DEFAULT 0');
    addColumnIfNotExist('matches', 'status', "TEXT DEFAULT 'pending'");

    console.log('[DATABASE] Cơ sở dữ liệu đã được khởi tạo và đồng bộ thành công!');
}

initDatabase();

function upsertPlayer(discordId, inGameName, teamSheetUrl = null) {
    const stmt = db.prepare(`
        INSERT INTO players (discord_id, in_game_name, team_sheet_url)
        VALUES (?, ?, ?)
        ON CONFLICT(discord_id) DO UPDATE SET
            in_game_name = excluded.in_game_name,
            team_sheet_url = COALESCE(excluded.team_sheet_url, players.team_sheet_url)
    `);
    return stmt.run(discordId, inGameName, teamSheetUrl);
}

function getPlayer(discordId) {
    return db.prepare(`SELECT * FROM players WHERE discord_id = ?`).get(discordId);
}

function createMatch(roundNumber, player1Id, player2Id) {
    const stmt = db.prepare(`
        INSERT INTO matches (round_number, player1_id, player2_id, status)
        VALUES (?, ?, ?, 'pending')
    `);
    const info = stmt.run(roundNumber, player1Id, player2Id);
    return info.lastInsertRowid;
}

function updateMatchChannel(matchId, channelId) {
    const stmt = db.prepare(`UPDATE matches SET channel_id = ? WHERE match_id = ?`);
    return stmt.run(channelId, matchId);
}

function getMatchByChannel(channelId) {
    return db.prepare(`SELECT * FROM matches WHERE channel_id = ? AND status != 'completed'`).get(channelId);
}

module.exports = {
    db,
    upsertPlayer,
    getPlayer,
    createMatch,
    updateMatchChannel,
    getMatchByChannel
};