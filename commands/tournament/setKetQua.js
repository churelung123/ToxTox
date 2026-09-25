// File: commands/setKetQua.js
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { pool } = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('set-ket-qua')
        .setDescription('⚙️ [ADMIN] Can thiệp và điều chỉnh kết quả trận đấu khi có khiếu nại')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
        .addIntegerOption(option =>
            option.setName('match_id')
                .setDescription('Chọn trận đấu cần chỉnh sửa (Nhập ID hoặc chọn từ gợi ý)')
                .setRequired(true)
                .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('ket_qua')
                .setDescription('Chọn kết quả mới cho trận đấu')
                .setRequired(true)
                .addChoices(
                    { name: 'Player 1 Thắng', value: 'p1_win' },
                    { name: 'Player 2 Thắng', value: 'p2_win' },
                    { name: 'Hủy kết quả (Đưa về Pending)', value: 'reset' }
                )),

    async autocomplete(interaction) {
        try {
            const focusedValue = interaction.options.getFocused();
            
            // Lấy danh sách các trận chưa hoàn tất hoặc toàn bộ trận gần đây từ DB
            const query = `
                m.match_id, 
                p1.in_game_name as p1_name, 
                p2.in_game_name as p2_name 
                FROM matches m
                LEFT JOIN players p1 ON m.player1_id = p1.discord_id
                LEFT JOIN players p2 ON m.player2_id = p2.discord_id
                ORDER BY m.match_id DESC LIMIT 25
            `;
            const res = await pool.query(`SELECT ${query}`);
            
            const choices = res.rows.map(row => {
                const name = `Bàn #${row.match_id}: ${row.p1_name || 'P1'} vs ${row.p2_name || 'P2'}`;
                return { name: name.substring(0, 100), value: row.match_id };
            });

            const filtered = choices.filter(choice => 
                choice.name.toLowerCase().includes(focusedValue.toLowerCase()) ||
                String(choice.value).includes(focusedValue)
            );

            await interaction.respond(filtered);
        } catch (error) {
            console.error('Lỗi Autocomplete set-ket-qua:', error);
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        const matchId = interaction.options.getInteger('match_id');
        const ketQua = interaction.options.getString('ket_qua');

        await interaction.deferReply();

        try {
            const matchResult = await pool.query('SELECT * FROM matches WHERE match_id = $1', [matchId]);
            if (matchResult.rows.length === 0) {
                return interaction.editReply(`❌ Không tìm thấy trận đấu có Match ID: \`${matchId}\`.`);
            }

            const match = matchResult.rows[0];
            let winnerId = null;
            let status = 'completed';
            let summaryText = '';

            if (ketQua === 'p1_win') {
                winnerId = match.player1_id;
                summaryText = `🏆 <@${match.player1_id}> được xử THẮNG.`;
            } else if (ketQua === 'p2_win') {
                winnerId = match.player2_id;
                summaryText = `🏆 <@${match.player2_id}> được xử THẮNG.`;
            } else if (ketQua === 'reset') {
                status = 'pending';
                winnerId = null;
                summaryText = `🔄 Trận đấu đã được HỦY KẾT QUẢ và đưa về trạng thái chờ thi đấu.`;
            }

            await pool.query(
                'UPDATE matches SET status = $1, winner_id = $2 WHERE match_id = $3',
                [status, winnerId, matchId]
            );

            // Cập nhật lại bảng điểm cho các player liên quan
            const playersToUpdate = [match.player1_id, match.player2_id];
            for (const playerId of playersToUpdate) {
                if (!playerId) continue;

                const winsRes = await pool.query(
                    `SELECT COUNT(*) FROM matches WHERE (player1_id = $1 AND winner_id = $1) OR (player2_id = $1 AND winner_id = $1)`,
                    [playerId]
                );
                const wins = parseInt(winsRes.rows[0].count, 10);

                const lossesRes = await pool.query(
                    `SELECT COUNT(*) FROM matches WHERE status = 'completed' AND winner_id IS NOT NULL AND ((player1_id = $1 OR player2_id = $1) AND winner_id != $1)`,
                    [playerId]
                );
                const losses = parseInt(lossesRes.rows[0].count, 10);

                await pool.query(
                    'UPDATE players SET wins = $1, losses = $2 WHERE discord_id = $3',
                    [wins, losses, playerId]
                );
            }

            const embed = new EmbedBuilder()
                .setTitle(`⚖️ Quyết định của Trọng Tài / Ban Tổ Chức`)
                .setDescription(`Đã cập nhật lại kết quả cho **Match ID: ${matchId}**\n\n**Kết quả mới:** ${summaryText}\n**Người can thiệp:** <@${interaction.user.id}>`)
                .setColor(0xF1C40F)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            if (match.channel_id) {
                const channel = await interaction.guild.channels.fetch(match.channel_id).catch(() => null);
                if (channel) {
                    await channel.send({ embeds: [embed] });
                }
            }

        } catch (error) {
            console.error('Lỗi khi set kết quả:', error);
            await interaction.editReply('❌ Đã xảy ra lỗi khi cập nhật CSDL.');
        }
    }
};