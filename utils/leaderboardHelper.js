// File: utils/leaderboardHelper.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { pool } = require('./database');

async function generateLeaderboardPage(page = 1) {
    try {
        const pageSize = 10;
        const offset = (page - 1) * pageSize;

        // Lấy tổng số lượng thí sinh để tính tổng số trang
        const countRes = await pool.query('SELECT COUNT(*) FROM players');
        const totalPlayers = parseInt(countRes.rows[0].count, 10);
        const totalPages = Math.ceil(totalPlayers / pageSize) || 1;

        // Đảm bảo page nằm trong khoảng hợp lệ
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

        let description = '';
        const components = [];

        if (players.length === 0) {
            description = 'Chưa có dữ liệu thí sinh nào.';
        } else {
            players.forEach((p, index) => {
                const globalIndex = offset + index + 1;
                let rankEmoji = '▫️';
                if (globalIndex === 1) rankEmoji = '🥇';
                else if (globalIndex === 2) rankEmoji = '🥈';
                else if (globalIndex === 3) rankEmoji = '🥉';

                const playerName = p.in_game_name || `User`;
                description += `${rankEmoji} **#${globalIndex}** — **${playerName}** | Thắng: **${p.wins}** | Thua: **${p.losses}** (<@${p.discord_id}>)\n`;
            });

            // Tạo các nút Link (Button Style.Link) cho từng thí sinh hiển thị ở trang này
            // Discord cho phép tối đa 5 nút trên 1 ActionRow, nên ta chia thành các hàng (mỗi hàng tối đa 5 nút)
            let currentRow = new ActionRowBuilder();
            let buttonCount = 0;

            players.forEach((p, index) => {
                const globalIndex = offset + index + 1;
                if (p.team_sheet_url) {
                    if (buttonCount >= 5) {
                        components.push(currentRow);
                        currentRow = new ActionRowBuilder();
                        buttonCount = 0;
                    }

                    const label = `TS #${globalIndex}: ${p.in_game_name ? p.in_game_name.substring(0, 10) : 'Link'}`;
                    currentRow.addComponents(
                        new ButtonBuilder()
                            .setLabel(label)
                            .setStyle(ButtonStyle.Link)
                            .setURL(p.team_sheet_url)
                    );
                    buttonCount++;
                }
            });

            if (buttonCount > 0) {
                components.push(currentRow);
            }
        }

        // Tạo hàng nút điều hướng trang (Pagination Row)
        const paginationRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`bxh_page_1`)
                .setLabel('⏪ Đầu')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === 1),
            new ButtonBuilder()
                .setCustomId(`bxh_page_${page - 1}`)
                .setLabel('◀️ Trước')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page <= 1),
            new ButtonBuilder()
                .setCustomId(`bxh_page_info`)
                .setLabel(`Trang ${page}/${totalPages}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId(`bxh_page_${page + 1}`)
                .setLabel('Sau ▶️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page >= totalPages),
            new ButtonBuilder()
                .setCustomId(`bxh_page_${totalPages}`)
                .setLabel('Cuối ⏩')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(page === totalPages)
        );

        components.push(paginationRow);

        const embed = new EmbedBuilder()
            .setTitle(`🏆 BẢNG XẾP HẠNG GIẢI ĐẤU (Trang ${page}/${totalPages})`)
            .setDescription(description)
            .setColor(0x00AE86)
            .setTimestamp()
            .setFooter({ text: `Tổng số thí sinh: ${totalPlayers} | Cập nhật theo thời gian thực` });

        return { embeds: [embed], components: components };
    } catch (err) {
        console.error('[LEADERBOARD ERROR]:', err);
        return null;
    }
}

module.exports = { generateLeaderboardPage };