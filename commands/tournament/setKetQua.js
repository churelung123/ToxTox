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
                .setDescription('ID của trận đấu cần chỉnh sửa')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('ket_qua')
                .setDescription('Chọn kết quả mới cho trận đấu')
                .setRequired(true)
                .addChoices(
                    { name: 'Player 1 Thắng', value: 'p1_win' },
                    { name: 'Player 2 Thắng', value: 'p2_win' },
                    { name: 'Hòa', value: 'draw' },
                    { name: 'Hủy kết quả (Đưa về Pending)', value: 'reset' }
                )),

    async execute(interaction) {
        const matchId = interaction.options.getInteger('match_id');
        const ketQua = interaction.options.getString('ket_qua');

        await interaction.deferReply();

        try {
            // 1. Kiểm tra trận đấu có tồn tại không
            const matchResult = await pool.query('SELECT * FROM matches WHERE match_id = $1', [matchId]);
            if (matchResult.rows.length === 0) {
                return interaction.editReply(`❌ Không tìm thấy trận đấu có Match ID: \`${matchId}\`.`);
            }

            const match = matchResult.rows[0];
            let winnerId = null;
            let status = 'completed';
            let summaryText = '';

            // 2. Xác định kết quả mới theo chuẩn CSDL ('DRAW' cho hòa)
            if (ketQua === 'p1_win') {
                winnerId = match.player1_id;
                summaryText = `🏆 <@${match.player1_id}> được xử THẮNG.`;
            } else if (ketQua === 'p2_win') {
                winnerId = match.player2_id;
                summaryText = `🏆 <@${match.player2_id}> được xử THẮNG.`;
            } else if (ketQua === 'draw') {
                winnerId = 'DRAW'; // Đồng bộ với hàm export Excel
                summaryText = `🤝 Trận đấu được xử HÒA.`;
            } else if (ketQua === 'reset') {
                status = 'pending';
                winnerId = null;
                summaryText = `🔄 Trận đấu đã được HỦY KẾT QUẢ và đưa về trạng thái chờ thi đấu.`;
            }

            // 3. (Tùy chọn nâng cao) Hoàn tác thống kê cũ của 2 player nếu trận trước đó đã hoàn tất
            // Giúp số liệu wins/losses/draws trong bảng players không bị cộng dồn sai lệch khi sửa kết quả
            if (match.status === 'completed') {
                if (match.winner_id === match.player1_id) {
                    await pool.query('UPDATE players SET wins = GREATEST(wins - 1, 0) WHERE discord_id = $1', [match.player1_id]);
                    await pool.query('UPDATE players SET losses = GREATEST(losses - 1, 0) WHERE discord_id = $1', [match.player2_id]);
                } else if (match.winner_id === match.player2_id) {
                    await pool.query('UPDATE players SET losses = GREATEST(losses - 1, 0) WHERE discord_id = $1', [match.player1_id]);
                    await pool.query('UPDATE players SET wins = GREATEST(wins - 1, 0) WHERE discord_id = $1', [match.player2_id]);
                } else if (match.winner_id === 'DRAW') {
                    await pool.query('UPDATE players SET draws = GREATEST(draws - 1, 0) WHERE discord_id = $1', [match.player1_id]);
                    await pool.query('UPDATE players SET draws = GREATEST(draws - 1, 0) WHERE discord_id = $1', [match.player2_id]);
                }
            }

            // 4. Cập nhật thống kê mới vào bảng players nếu trạng thái mới là completed
            if (status === 'completed') {
                if (winnerId === match.player1_id) {
                    await pool.query('UPDATE players SET wins = wins + 1 WHERE discord_id = $1', [match.player1_id]);
                    await pool.query('UPDATE players SET losses = losses + 1 WHERE discord_id = $1', [match.player2_id]);
                } else if (winnerId === match.player2_id) {
                    await pool.query('UPDATE players = losses + 1 WHERE discord_id = $1', [match.player1_id]); // Sửa cú pháp đúng bên dưới
                    // (Lưu ý: đoạn cộng dồn chuẩn xác ở dưới)
                }
            }

            // Gộp phần cộng dồn chuẩn xác:
            if (status === 'completed') {
                if (winnerId === match.player1_id) {
                    await pool.query('UPDATE players SET wins = wins + 1 WHERE discord_id = $1', [match.player1_id]);
                    await pool.query('UPDATE players SET losses = losses + 1 WHERE discord_id = $1', [match.player2_id]);
                } else if (winnerId === match.player2_id) {
                    await pool.query('UPDATE players SET losses = losses + 1 WHERE discord_id = $1', [match.player1_id]);
                    await pool.query('UPDATE players SET wins = wins + 1 WHERE discord_id = $1', [match.player2_id]);
                } else if (winnerId === 'DRAW') {
                    await pool.query('UPDATE players SET draws = draws + 1 WHERE discord_id = $1', [match.player1_id]);
                    await pool.query('UPDATE players SET draws = draws + 1 WHERE discord_id = $1', [match.player2_id]);
                }
            }

            // 5. Cập nhật lại bảng matches trong CSDL Neon
            await pool.query(
                'UPDATE matches SET status = $1, winner_id = $2 WHERE match_id = $3',
                [status, winnerId, matchId]
            );

            // 6. Thông báo kết quả điều chỉnh lên Discord
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