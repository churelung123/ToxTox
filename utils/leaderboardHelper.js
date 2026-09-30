// File: utils/leaderboardHelper.js
const { pool } = require('./database');

async function generateLeaderboardPage(page = 1) {
    try {
        const pageSize = 5; 
        const offset = (page - 1) * pageSize;

        // Lấy tổng số lượng thí sinh
        const countRes = await pool.query('SELECT COUNT(*) FROM players');
        const totalPlayers = parseInt(countRes.rows[0].count, 10);
        const totalPages = Math.ceil(totalPlayers / pageSize) || 1;

        if (page > totalPages) page = totalPages;
        if (page < 1) page = 1;

        console.log(`[HELPER DEBUG] Tổng thí sinh: ${totalPlayers}, Tổng số trang: ${totalPages}, Đang tải trang: ${page}`);

        // Lấy danh sách thí sinh phân trang
        const res = await pool.query(`
            SELECT discord_id, in_game_name, wins, losses, team_sheet_url 
            FROM players 
            ORDER BY wins DESC, losses ASC
            LIMIT $1 OFFSET $2
        `, [pageSize, offset]);

        const players = res.rows;
        const containerComponents = [];

        containerComponents.push({
            type: 10,
            content: `### 🏆 BẢNG XẾP HẠNG GIẢI ĐẤU (Trang ${page}/${totalPages})`
        });

        containerComponents.push({
            type: 14,
            spacing: 1,
            divider: true
        });

        if (players.length === 0) {
            containerComponents.push({
                type: 10,
                content: "Chưa có dữ liệu thí sinh nào."
            });
        } else {
            players.forEach((p, index) => {
                const globalIndex = offset + index + 1;
                let rankEmoji = '▫️';
                if (globalIndex === 1) rankEmoji = '🥇';
                else if (globalIndex === 2) rankEmoji = '🥈';
                else if (globalIndex === 3) rankEmoji = '🥉';

                const playerName = p.in_game_name || 'User';
                
                containerComponents.push({
                    type: 9, // Section Component
                    components: [
                        {
                            type: 10, // Text Display Component
                            content: `${rankEmoji} **#${globalIndex}:**${playerName}    \`[${p.wins}-${p.losses}]\``
                        }
                    ],
                    accessory: {
                        type: 2, // Button Component
                        style: 5, // Link Style
                        label: 'Team Sheet',
                        url: p.team_sheet_url || 'https://discord.com'
                    }
                });
            });
        }

        const payload = {
            flags: 32768, // IS_COMPONENTS_V2 flag
            components: [
                {
                    type: 17, // Container Component
                    accent_color: 0x00AE86,
                    components: containerComponents
                },
                {
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
                            label: `Cuối ⏩`,
                            disabled: page === totalPages
                        }
                    ]
                }
            ]
        };

        return payload;
    } catch (err) {
        console.error('[LEADERBOARD HELPER ERROR]:', err);
        return null;
    }
}

module.exports = { generateLeaderboardPage };