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
        const components = [];

        if (players.length > 0) {
            players.forEach((p, index) => {
                const globalIndex = offset + index + 1;
                let rankEmoji = '▫️';
                if (globalIndex === 1) rankEmoji = '🥇';
                else if (globalIndex === 2) rankEmoji = '🥈';
                else if (globalIndex === 3) rankEmoji = '🥉';

                const playerName = p.in_game_name || 'User';
                
                // Text hiển thị thông tin ở mỗi dòng (hoặc đưa vào label của nút)
                const label = `${rankEmoji} #${globalIndex} — ${playerName} [${p.wins}-${p.losses}]`;

                // MỖI THÍ SINH LÀ MỘT ACTION ROW RIÊNG BIỆT ĐỂ NÓ NẰM TRÊN 1 DÒNG ĐỘC LẬP
                components.push({
                    type: 1, // Action Row
                    components: [
                        {
                            type: 2, // Button
                            style: 5, // Link style
                            label: label.substring(0, 80), // Giới hạn tối đa 80 ký tự của Discord
                            url: p.team_sheet_url || 'https://discord.com'
                        }
                    ]
                });
            });
        }

        // Thêm hàng nút điều hướng trang (Pagination Row) ở cuối cùng
        const paginationRow = {
            type: 1,
            components: [
                {
                    type: 2,
                    style: 2,
                    custom_id: `bxh_page_1`,
                    label: '⏪ Đầu',
                    disabled: page === 1
                },
                {
                    type: 2,
                    style: 1,
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

        components.push(paginationRow);

        return {
            content: `### 🏆 BẢNG XẾP HẠNG GIẢI ĐẤU (Trang ${page}/${totalPages})`,
            components: components
        };
    } catch (err) {
        console.error('[LEADERBOARD ERROR]:', err);
        return null;
    }
}

module.exports = { generateLeaderboardPage };