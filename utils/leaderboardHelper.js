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

        if (players.length === 0) {
            components.push({
                type: 17, // Container component type
                components: [
                    {
                        type: 14, // Text display block
                        content: "Chưa có dữ liệu thí sinh nào."
                    }
                ]
            });
        } else {
            // Duyệt qua từng thí sinh để tạo các section/container riêng biệt hoặc gom nhóm
            players.forEach((p, index) => {
                const globalIndex = offset + index + 1;
                let rankEmoji = '▫️';
                if (globalIndex === 1) rankEmoji = '🥇';
                else if (globalIndex === 2) rankEmoji = '🥈';
                else if (globalIndex === 3) rankEmoji = '🥉';

                const playerName = p.in_game_name || 'User';
                const displayText = `${rankEmoji} **#${globalIndex}** — **${playerName}** | Thắng: **${p.wins}** | Thua: **${p.losses}** (<@${p.discord_id}>)`;

                // Tạo component dòng kèm nút bấm (Accessory Button hoặc Action Row đi kèm)
                const rowComponents = [
                    {
                        type: 1, // Action Row
                        components: [
                            {
                                type: 2, // Button
                                style: 5, // Link style
                                label: `TS #${globalIndex}`,
                                url: p.team_sheet_url || 'https://discord.com' // Fallback nếu chưa có link
                            }
                        ]
                    }
                ];

                components.push({
                    type: 17, // Container / Section block
                    accent_color: globalIndex === 1 ? 0xFFD700 : (globalIndex === 2 ? 0xC0C0C0 : (globalIndex === 3 ? 0xCD7F32 : 0x00AE86)),
                    components: [
                        {
                            type: 14, // Text block
                            content: displayText
                        },
                        ...rowComponents
                    ]
                });
            });
        }

        // Thêm hàng nút điều hướng trang (Pagination Row) ở cuối
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

        // Trả về payload hoàn chỉnh không cần dùng Embed truyền thống nếu dùng cấu trúc Layout V2 hoàn toàn,
        // hoặc kết hợp Embed ở trên cùng. Dưới đây là cấu trúc payload thuần component layout:
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