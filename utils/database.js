// File: utils/database.js
require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ Thiếu biến môi trường DATABASE_URL trong file .env!');
}

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false } // Bắt buộc khi kết nối Neon Cloud
});

/**
 * Khởi tạo cấu trúc Bảng trên PostgreSQL (Neon)
 */
async function initDatabase() {
    try {
        const client = await pool.connect();

        // 1. Tạo bảng players
        await client.query(`
            CREATE TABLE IF NOT EXISTS players (
                discord_id VARCHAR(50) PRIMARY KEY,
                in_game_name VARCHAR(100) NOT NULL,
                team_sheet_url TEXT,
                wins INT DEFAULT 0,
                losses INT DEFAULT 0,
                is_dropped INT DEFAULT 0
            );
        `);

        // 2. Tạo bảng matches
        await client.query(`
            CREATE TABLE IF NOT EXISTS matches (
                match_id SERIAL PRIMARY KEY,
                round_number INT NOT NULL,
                player1_id VARCHAR(50) NOT NULL,
                player2_id VARCHAR(50) NOT NULL,
                channel_id VARCHAR(50),
                winner_id VARCHAR(50),
                player1_score INT DEFAULT 0,
                player2_score INT DEFAULT 0,
                reported_by VARCHAR(50),
                proof_image TEXT,
                is_proof_submitted INT DEFAULT 0,
                status VARCHAR(20) DEFAULT 'pending'
            );
        `);

        client.release();
        console.log('[DATABASE] Cơ sở dữ liệu PostgreSQL (Neon) đã kết nối và khởi tạo thành công!');
    } catch (err) {
        console.error('[DATABASE ERROR] Lỗi khởi tạo cơ sở dữ liệu:', err.message);
    }
}

initDatabase();

/**
 * Thêm mới hoặc Cập nhật thông tin tuyển thủ
 */
async function upsertPlayer(discordId, inGameName, teamSheetUrl = null) {
    const queryText = `
        INSERT INTO players (discord_id, in_game_name, team_sheet_url)
        VALUES ($1, $2, $3)
        ON CONFLICT(discord_id) DO UPDATE SET
            in_game_name = EXCLUDED.in_game_name,
            team_sheet_url = COALESCE(EXCLUDED.team_sheet_url, players.team_sheet_url)
    `;
    return await pool.query(queryText, [discordId, inGameName, teamSheetUrl]);
}

/**
 * Lấy thông tin tuyển thủ theo ID Discord
 */
async function getPlayer(discordId) {
    const res = await pool.query(`SELECT * FROM players WHERE discord_id = $1`, [discordId]);
    return res.rows[0] || null;
}

/**
 * Tạo trận đấu mới và trả về match_id vừa tạo
 */
async function createMatch(roundNumber, player1Id, player2Id) {
    const queryText = `
        INSERT INTO matches (round_number, player1_id, player2_id, status)
        VALUES ($1, $2, $3, 'pending')
        RETURNING match_id
    `;
    const res = await pool.query(queryText, [roundNumber, player1Id, player2Id]);
    return res.rows[0].match_id;
}

/**
 * Cập nhật channel_id cho trận đấu
 */
async function updateMatchChannel(matchId, channelId) {
    return await pool.query(
        `UPDATE matches SET channel_id = $1 WHERE match_id = $2`,
        [channelId, matchId]
    );
}

/**
 * Lấy thông tin trận đấu theo Channel ID
 */
async function getMatchByChannel(channelId) {
    const res = await pool.query(
        `SELECT * FROM matches WHERE channel_id = $1 AND status != 'completed'`,
        [channelId]
    );
    return res.rows[0] || null;
}

module.exports = {
    pool,
    query: (text, params) => pool.query(text, params),
    upsertPlayer,
    getPlayer,
    createMatch,
    updateMatchChannel,
    initDatabase,
    getMatchByChannel
};