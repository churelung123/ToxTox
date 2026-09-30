// File: utils/leaderboardHelper.js
const { pool } = require('./database');

async function generateLeaderboardPage(page = 1) {
    try {
        const pageSize = 10;
        const offset = (page - 1) * pageSize;

        // Lấy tổng số lượng thí sinh
        const countRes = await pool.query('SELECT COUNT(*) FROM players');
        const totalPlayers = parseInt(countRes.rows[0].count, 10);
        const totalPages = Math.ceil(totalPlayers / pageSize) || 1;

        if (page > totalPages) page = totalPages;
        if (page < 1) page = 1;

        // Lấy danh sách thí sinh phân trang
        const res = await pool.query(`
            SELECT discord_id, in_game_name, wins, losses, team_sheet_url 
            FROM players 
            ORDER BY wins DESC, losses ASC
            LIMIT $1 OFFSET $2
        `, [pageSize, offset]);

        const players = res.rows;

        let contentText = `🏆 **BẢNG XẾP HẠNG GIẢI ĐẤU (Trang ${page}/${totalPages})**\n` +
                          `───────────────────────────────\n`;

        if (players.length === 0) {
            contentText += `Chưa có dữ liệu thí sinh nào.`;
        } else {
            players.forEach((p, index) => {
                const globalIndex = offset + index + 1;
                let rankEmoji = '▫️';
                if (globalIndex === 1) rankEmoji = '🥇';
                else if (globalIndex === 2) rankEmoji = '🥈';
                else if (globalIndex === 3) rankEmoji = '🥉';

                const playerName = p.in_game_name || `User`;
                contentText += `${rankEmoji} **#${globalIndex}** — **${playerName}** | Thắng: **${p.wins}** | Thua: **${p.losses}** (<@${p.discord_id}>)\n`;
            });
        }

        contentText += `───────────────────────────────\n*Tổng số thí sinh: ${totalPlayers} | Cập nhật theo thời gian thực*`;

        // Tạo danh sách các hàng nút bấm (Action Rows) dưới dạng Raw Payload
        const rows = [];
        let currentRow = {
            type: 1, // ActionRow type
            components: []
        };

        // Thêm các nút Link Team Sheet cho từng tuyển thủ trong trang này (tối đa 5 nút mỗi hàng)
        players.forEach((p, index) => {
            const globalIndex = offset + index + 1;
            if (p.team_sheet_url) {
                if (currentRow.components.length >= 5) {
                    rows.push(currentRow);
                    currentRow = { type: 1, components: [] };
                }
                currentRow.components.push({
                    type: 2, // Button type
                    style: 5, // Link button style
                    label: `#${globalIndex}: ${p.in_game_name ? p.in_game_name.substring(0, 8) : 'Team Sheet'}`,
                    url: p.team_sheet_url
                });
            }
        });

        if (currentRow.components.length > 0) {
            rows.push(currentRow);
        }

        // Tạo hàng nút điều hướng phân trang (Pagination Row)
        const paginationRow = {
            type: 1,
            components: [
                {
                    type: 2,
                    style: 2, // Secondary
                    custom_id: `bxh_page_1`,
                    label: '⏪ Đầu',
                    disabled: page === 1
                },
                {
                    type: 2,
                    style: 1, // Primary
                    custom_id: `bxh_page_${page - 1}`,
                    label: '◀️ Trước',
                    disabled: page <= 1
                },
                {
                    type: 2,
                    style: 2,
                    custom_id: `bxh_page_info`,
                    label: `Trang ${page}/${totalPages}`,
                    disabled: true
                },
                {
                    type: 2,
                    style: 1,
                    custom_id: `bxh_page_${page + 1}`,
                    label: 'Sau ▶️',
                    disabled: page >= totalPages
                },
                {
                    type: 2,
                    style: 2,
                    custom_id: `bxh_page_${totalPages}`,
                    label: 'Cuối ⏩',
                    disabled: page === totalPages
                }
            ]
        };

        rows.push(paginationRow);

        // Trả về payload thô để gửi trực tiếp qua Discord API
        return {
            content: contentText,
            components: rows,
            allowed_mentions: { parse: [] }
        };

    } catch (err) {
        console.error('[LEADERBOARD ERROR]:', err);
        return null;
    }
}

module.exports = { generateLeaderboardPage };