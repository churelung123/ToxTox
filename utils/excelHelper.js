// File: utils/excelHelper.js
const xlsx = require('xlsx');
const path = require('node:path');
const { pool } = require('./database');

const STANDINGS_EXCEL_PATH = path.join(__dirname, '../VGC_Standings.xlsx');
const MATCHES_EXCEL_PATH = path.join(__dirname, '../VGC_Matches_By_Round.xlsx');

/**
 * Đọc dữ liệu Tuyển thủ & Pairings từ file Excel
 */
function readTournamentDataFromExcel(filePath) {
    try {
        const workbook = xlsx.readFile(filePath);
        let players = [];
        if (workbook.SheetNames.includes('Players')) {
            players = xlsx.utils.sheet_to_json(workbook.Sheets['Players']);
        } else {
            players = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        }

        let pairings = [];
        if (workbook.SheetNames.includes('Pairings')) {
            pairings = xlsx.utils.sheet_to_json(workbook.Sheets['Pairings']);
        }

        return { players, pairings };
    } catch (error) {
        console.error('[EXCEL] Lỗi khi đọc file Excel:', error.message);
        return { players: [], pairings: [] };
    }
}

/**
 * Xuất Bảng xếp hạng tổng ra file Excel
 */
async function exportStandingsToExcel(data, fileName = STANDINGS_EXCEL_PATH) {
    const worksheet = xlsx.utils.json_to_sheet(data);
    
    worksheet['!cols'] = [
        { wch: 20 }, // Discord ID
        { wch: 20 }, // In-game Name
        { wch: 8 },  // Wins
        { wch: 8 },  // Losses
        { wch: 8 },  // Draws
        { wch: 10 }  // Points
    ];

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Standings');
    xlsx.writeFile(workbook, fileName);
    
    return fileName;
}

/**
 * Xuất Lịch sử Trận đấu chia theo từng Vòng (Mỗi Round 1 Sheet)
 */
async function exportMatchesByRoundToExcel(fileName = MATCHES_EXCEL_PATH) {
    try {
        const workbook = xlsx.utils.book_new();

        const roundsRes = await pool.query(`SELECT DISTINCT round_number FROM matches ORDER BY round_number ASC`);
        const rounds = roundsRes.rows;

        if (rounds.length === 0) return null;

        for (const r of rounds) {
            const roundNumber = r.round_number;
            
            const matchesDataRes = await pool.query(`
                SELECT 
                    m.match_id AS "Match ID",
                    p1.in_game_name AS "Player 1",
                    p2.in_game_name AS "Player 2",
                    m.player1_score AS "Tỷ số P1",
                    m.player2_score AS "Tỷ số P2",
                    CASE 
                        WHEN m.winner_id = 'DRAW' THEN 'Hòa'
                        WHEN m.winner_id = p1.discord_id THEN p1.in_game_name
                        WHEN m.winner_id = p2.discord_id THEN p2.in_game_name
                        ELSE 'Chưa hoàn tất'
                    END AS "Kết Quả",
                    m.status AS "Trạng Thái",
                    m.proof_image AS "Link Ảnh Bằng Chứng"
                FROM matches m
                LEFT JOIN players p1 ON m.player1_id = p1.discord_id
                LEFT JOIN players p2 ON m.player2_id = p2.discord_id
                WHERE m.round_number = $1
            `, [roundNumber]);

            const worksheet = xlsx.utils.json_to_sheet(matchesDataRes.rows);
            worksheet['!cols'] = [
                { wch: 12 }, { wch: 20 }, { wch: 20 }, 
                { wch: 10 }, { wch: 10 }, { wch: 20 }, 
                { wch: 15 }, { wch: 60 }
            ];

            xlsx.utils.book_append_sheet(workbook, worksheet, `Round ${roundNumber}`);
        }

        xlsx.writeFile(workbook, fileName);
        return fileName;
    } catch (error) {
        console.error('[EXCEL] Lỗi khi xuất lịch sử theo vòng:', error.message);
        return null;
    }
}

module.exports = { 
    readTournamentDataFromExcel,
    exportStandingsToExcel,
    exportMatchesByRoundToExcel
};