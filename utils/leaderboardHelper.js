// File: utils/leaderboardHelper.js
const { EmbedBuilder } = require('discord.js');
const { pool } = require('./database');

async function generateLeaderboardEmbed() {
    try {
        // Truy vấn lấy danh sách tuyển thủ sắp xếp theo số điểm (wins) và phụ là losses
        const res = await pool.query(`
            SELECT discord_id, in_game_name, wins, losses, team_sheet_url 
            FROM players 
            ORDER BY wins DESC, losses ASC
        `);

        const players = res.rows;

        let description = '';
        if (players.length === 0) {
            description = 'Chưa có dữ liệu thí sinh nào.';
        } else {
            players.forEach((p, index) => {
                let rankEmoji = '▫️';
                if (index === 0) rankEmoji = '🥇';
                else if (index === 1) rankEmoji = '🥈';
                else if (index === 2) rankEmoji = '🥉';

                // Tạo link gắn kèm tên nếu có team_sheet_url
                let nameDisplay = p.in_game_name || `User <@${p.discord_id}>`;
                if (p.team_sheet_url) {
                    nameDisplay = `[${nameDisplay}](${p.team_sheet_url})`;
                }

                description += `${rankEmoji} **#${index + 1}** — **${nameDisplay}** | Thắng: **${p.wins}** | Thua: **${p.losses}** (<@${p.discord_id}>)\n`;
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('🏆 BẢNG XẾP HẠNG GIẢI ĐẤU & TEAM SHEET')
            .setDescription(description)
            .setColor(0x00AE86)
            .setTimestamp()
            .setFooter({ text: 'Bảng xếp hạng cập nhật tự động theo thời gian thực' });

        return embed;
    } catch (err) {
        console.error('[LEADERBOARD ERROR]:', err);
        return null;
    }
}

module.exports = { generateLeaderboardEmbed };