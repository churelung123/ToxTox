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

            // 2. Xử lý logic theo lựa chọn của Admin
            if (ketQua === 'p1_win') {
                winnerId = match.player1_id;
                summaryText = `🏆 <@${match.player1_id}> được xử THẮNG.`;
            } else if (ketQua === 'p2_win') {
                winnerId = match.player2_id;
                summaryText = `🏆 <@${match.player2_id}> được xử THẮNG.`;
            } else if (ketQua === 'draw') {
                winnerId = null;
                summaryText = `🤝 Trận đấu được xử HÒA.`;
            } else if (ketQua === 'reset') {
                status = 'pending';
                winnerId = null;
                summaryText = `🔄 Trận đấu đã được HỦY KẾT QUẢ và đưa về trạng thái chờ thi đấu.`;
            }

            // 3. Cập nhật CSDL Neon qua pool.query
            await pool.query(
                'UPDATE matches SET status = $1, winner_id = $2 WHERE match_id = $3',
                [status, winnerId, matchId]
            );

            // 4. Thông báo kết quả điều chỉnh
            const embed = new EmbedBuilder()
                .setTitle(`⚖️ Quyết định của Trọng Tài / Ban Tổ Chức`)
                .setDescription(`Đã cập nhật lại kết quả cho **Match ID: ${matchId}**\n\n**Kết quả mới:** ${summaryText}\n**Người can thiệp:** ${interaction.user}`)
                .setColor(0xF1C40F)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // Nếu trận đấu có kênh riêng, gửi 1 bản sao thông báo vào kênh đó
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