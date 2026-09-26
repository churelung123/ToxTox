// File: utils/excelHelper.js

const xlsx = require('xlsx');
const { pool } = require('./database');

/**
 * Hàm phụ trợ: Chuyển đổi link Google Drive sang link tải/xem ảnh trực tiếp
 */
function convertGoogleDriveLink(url) {
    if (!url || typeof url !== 'string' || !url.includes('drive.google.com')) {
        return url;
    }
    
    let fileId = '';
    // Kiểm tra dạng /file/d/FILE_ID/view
    const matchFileD = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (matchFileD && matchFileD[1]) {
        fileId = matchFileD[1];
    } else {
        // Kiểm tra dạng ?id=FILE_ID hoặc /open?id=FILE_ID
        const urlParams = new URLSearchParams(url.split('?')[1]);
        if (urlParams.has('id')) {
            fileId = urlParams.get('id');
        }
    }

    if (fileId) {
        // Sử dụng endpoint export=download để lấy trực tiếp tệp ảnh
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
    return url;
}

/**
 * Đọc dữ liệu Tuyển thủ & Pairings từ file Excel
 *
 * Có thể nhận:
 * - Buffer: dùng cho Vercel Serverless
 * - filePath: tương thích với code cũ
 */
function readTournamentDataFromExcel(input) {
    try {
        const workbook = Buffer.isBuffer(input)
            ? xlsx.read(input, { type: 'buffer' })
            : xlsx.readFile(input);

        let players = [];

        if (workbook.SheetNames.includes('Players')) {
            players = xlsx.utils.sheet_to_json(
                workbook.Sheets['Players']
            );
        } else if (workbook.SheetNames.length > 0) {
            players = xlsx.utils.sheet_to_json(
                workbook.Sheets[workbook.SheetNames[0]]
            );
        }

        // Tự động chuẩn hóa team_sheet_url nếu là link Google Drive
        players = players.map(player => {
            if (player.team_sheet_url) {
                player.team_sheet_url = convertGoogleDriveLink(player.team_sheet_url);
            }
            return player;
        });

        let pairings = [];

        if (workbook.SheetNames.includes('Pairings')) {
            pairings = xlsx.utils.sheet_to_json(
                workbook.Sheets['Pairings']
            );
        }

        return {
            players,
            pairings
        };
    } catch (error) {
        console.error(
            '[EXCEL] Lỗi khi đọc file Excel:',
            error.message
        );

        return {
            players: [],
            pairings: []
        };
    }
}

/**
 * Xuất Bảng xếp hạng tổng ra Excel
 */
async function exportStandingsToExcel(data) {
    try {
        const worksheet = xlsx.utils.json_to_sheet(data);

        worksheet['!cols'] = [
            { wch: 20 },
            { wch: 20 },
            { wch: 8 },
            { wch: 8 },
            { wch: 8 },
            { wch: 10 }
        ];

        const workbook = xlsx.utils.book_new();

        xlsx.utils.book_append_sheet(
            workbook,
            worksheet,
            'Standings'
        );

        const buffer = xlsx.write(workbook, {
            type: 'buffer',
            bookType: 'xlsx'
        });

        return buffer;

    } catch (error) {
        console.error(
            '[EXCEL] Lỗi khi xuất bảng xếp hạng:',
            error
        );

        return null;
    }
}

/**
 * Xuất lịch sử trận đấu theo từng Round
 */
async function exportMatchesByRoundToExcel(fileName) {
    try {
        const workbook = xlsx.utils.book_new();

        const roundsRes = await pool.query(`
            SELECT DISTINCT round_number
            FROM matches
            ORDER BY round_number ASC
        `);

        const rounds = roundsRes.rows;

        if (rounds.length === 0) {
            return null;
        }

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
                        WHEN m.winner_id = p1.discord_id
                            THEN p1.in_game_name

                        WHEN m.winner_id = p2.discord_id
                            THEN p2.in_game_name

                        ELSE 'Chưa hoàn tất'
                    END AS "Kết Quả",

                    m.status AS "Trạng Thái",
                    m.proof_image AS "Link Ảnh Bằng Chứng"

                FROM matches m

                LEFT JOIN players p1
                    ON m.player1_id = p1.discord_id

                LEFT JOIN players p2
                    ON m.player2_id = p2.discord_id

                WHERE m.round_number = $1
            `, [roundNumber]);

            const worksheet = xlsx.utils.json_to_sheet(
                matchesDataRes.rows
            );

            worksheet['!cols'] = [
                { wch: 12 },
                { wch: 20 },
                { wch: 20 },
                { wch: 10 },
                { wch: 10 },
                { wch: 20 },
                { wch: 15 },
                { wch: 60 }
            ];

            xlsx.utils.book_append_sheet(
                workbook,
                worksheet,
                `Round ${roundNumber}`
            );
        }

        const buffer = xlsx.write(workbook, {
            type: 'buffer',
            bookType: 'xlsx'
        });

        return buffer;

    } catch (error) {
        console.error(
            '[EXCEL] Lỗi khi xuất lịch sử theo vòng:',
            error.message
        );

        return null;
    }
}

module.exports = {
    readTournamentDataFromExcel,
    exportStandingsToExcel,
    exportMatchesByRoundToExcel
};