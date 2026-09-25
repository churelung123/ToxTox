// File: events/interactionCreate.js
const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { pool } = require('../utils/database');
const { exportStandingsToExcel, exportMatchesByRoundToExcel } = require('../utils/excelHelper');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {

        // 1. SLASH COMMANDS
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                const errorMessage = { content: 'Có lỗi xảy ra khi thực thi lệnh này!', ephemeral: true };
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            }
            return;
        }

        // 2. NÚT BẤM (BUTTONS)
        if (interaction.isButton()) {
            const customId = interaction.customId;

            // --- BÁO KẾT QUẢ BẰNG NÚT (P1 thắng / P2 thắng / Hòa / Gọi Mod) ---
            if (customId.startsWith('win_p1_') || customId.startsWith('win_p2_') || customId.startsWith('draw_') || customId.startsWith('call_mod_')) {
                const matchId = customId.split('_').pop();
                const matchRes = await pool.query('SELECT * FROM matches WHERE match_id = $1', [matchId]);
                const match = matchRes.rows[0];

                if (!match) {
                    return interaction.reply({ content: '❌ Không tìm thấy thông tin trận đấu!', ephemeral: true });
                }

                if (interaction.user.id !== match.player1_id && interaction.user.id !== match.player2_id) {
                    return interaction.reply({ content: '❌ Bạn không phải tuyển thủ trong trận đấu này!', ephemeral: true });
                }

                if (match.is_proof_submitted !== 1) {
                    return interaction.reply({ content: '⚠️ Bạn phải dùng lệnh `/gui-anh` để gửi bằng chứng trước khi chọn kết quả!', ephemeral: true });
                }

                if (match.status === 'completed') {
                    return interaction.reply({ content: '✅ Trận đấu này đã kết thúc!', ephemeral: true });
                }

                // Xử lý nút "Gọi Mod"
                if (customId.startsWith('call_mod_')) {
                    return interaction.reply({
                        content: `⚠️ <@${userId}> đã yêu cầu trợ giúp. <@&1534802354480746656> (Ban Tổ Chức / Trọng tài) hãy vào kiểm tra bàn đấu này ngay!`,
                        ephemeral: false
                    });
                }

                // Xác định tỷ số và người thắng dựa trên nút được bấm
                let reportedWinner = null;
                let scoreP1 = 0;
                let scoreP2 = 0;

                if (customId.startsWith('win_p1_')) {
                    reportedWinner = match.player1_id;
                    scoreP1 = 1;
                    scoreP2 = 0;
                } else if (customId.startsWith('win_p2_')) {
                    reportedWinner = match.player2_id;
                    scoreP1 = 0;
                    scoreP2 = 1;
                } else if (customId.startsWith('draw_')) {
                    reportedWinner = 'DRAW';
                    scoreP1 = 0;
                    scoreP2 = 0;
                }

                // Lưu kết quả tạm thời vào DB và chờ đối thủ xác nhận
                await pool.query(`
                    UPDATE matches 
                    SET player1_score = $1, player2_score = $2, reported_by = $3, winner_id = $4, status = 'waiting_confirm' 
                    WHERE match_id = $5
                `, [scoreP1, scoreP2, interaction.user.id, reportedWinner, matchId]);

                const opponentId = (interaction.user.id === match.player1_id) ? match.player2_id : match.player1_id;
                const resultText = reportedWinner === 'DRAW' ? 'Hòa' : `<@${reportedWinner}> Thắng`;

                const confirmEmbed = new EmbedBuilder()
                    .setTitle('⏳ CHỜ XÁC NHẬN KẾT QUẢ')
                    .setDescription(
                        `<@${interaction.user.id}> đã báo kết quả: **${resultText}**\n\n` +
                        `<@${opponentId}> vui lòng bấm **Xác nhận** nếu thông tin chính xác, hoặc **Khiếu nại** nếu có sai sót.`
                    )
                    .setColor(0xF1C40F);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`confirm_match_${matchId}`).setLabel('Xác nhận ✅').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`dispute_match_${matchId}`).setLabel('Khiếu nại ❌').setStyle(ButtonStyle.Danger)
                );

                await interaction.reply({ embeds: [confirmEmbed], components: [row] });
            }

            // --- ĐỐI THỦ BẤM "XÁC NHẬN ✅" ---
            else if (customId.startsWith('confirm_match_')) {
                const matchId = customId.split('_')[2];
                const matchRes = await pool.query('SELECT * FROM matches WHERE match_id = $1', [matchId]);
                const match = matchRes.rows[0];

                if (!match) return interaction.reply({ content: '❌ Trận đấu không tồn tại!', ephemeral: true });

                if (interaction.user.id === match.reported_by) {
                    return interaction.reply({ content: '❌ Bạn là người báo kết quả, hãy chờ đối thủ bấm xác nhận!', ephemeral: true });
                }

                if (interaction.user.id !== match.player1_id && interaction.user.id !== match.player2_id) {
                    return interaction.reply({ content: '❌ Bạn không có quyền xác nhận!', ephemeral: true });
                }

                const winnerId = match.winner_id;

                // Cập nhật trạng thái completed
                await pool.query(`UPDATE matches SET status = 'completed' WHERE match_id = $1`, [matchId]);

                // Cập nhật điểm cho Players
                if (winnerId === 'DRAW') {
                    await pool.query('UPDATE players SET draws = draws + 1 WHERE discord_id = $1', [match.player1_id]);
                    await pool.query('UPDATE players SET draws = draws + 1 WHERE discord_id = $1', [match.player2_id]);
                } else if (winnerId) {
                    const loserId = (winnerId === match.player1_id) ? match.player2_id : match.player1_id;
                    await pool.query('UPDATE players SET wins = wins + 1 WHERE discord_id = $1', [winnerId]);
                    await pool.query('UPDATE players SET losses = losses + 1 WHERE discord_id = $1', [loserId]);
                }

                // Khóa quyền gửi tin nhắn của 2 tuyển thủ trong kênh
                await interaction.channel.permissionOverwrites.edit(match.player1_id, { SendMessages: false }).catch(() => null);
                await interaction.channel.permissionOverwrites.edit(match.player2_id, { SendMessages: false }).catch(() => null);

                // Xuất lại 2 file Excel (Standings & Lịch sử đối đầu theo vòng)
                const allPlayersRes = await pool.query(
                    'SELECT discord_id, in_game_name, wins, losses, draws, (wins * 3 + draws) as points FROM players ORDER BY points DESC, wins DESC'
                );

                if (typeof exportStandingsToExcel === 'function') {
                    await exportStandingsToExcel(allPlayersRes.rows);
                }
                if (typeof exportMatchesByRoundToExcel === 'function') {
                    await exportMatchesByRoundToExcel();
                }

                const resultDisplay = winnerId === 'DRAW' ? '🤝 Hòa' : `🏆 Người thắng: <@${winnerId}>`;

                const embedSuccess = new EmbedBuilder()
                    .setTitle('🎉 TRẬN ĐẤU HOÀN TẤT')
                    .setDescription(`Kết quả đã được xác nhận!\n\n**${resultDisplay}**\n\n*Kênh đã chuyển sang chế độ Xem.*`)
                    .setColor(0x2ECC71);

                await interaction.update({ embeds: [embedSuccess], components: [] });
            }

            // --- ĐỐI THỦ BẤM "KHIẾU NẠI ❌" ---
            else if (customId.startsWith('dispute_match_')) {
                return interaction.reply({
                    content: `⚠️ **Đã gửi khiếu nại!** <@&1534802354480746656> (Ban Tổ Chức / Trọng tài) sẽ vào kiểm tra bàn đấu này.`,
                    ephemeral: false
                });
            }
        }
    },
};