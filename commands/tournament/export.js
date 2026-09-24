// File: commands/tournament/export.js
const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { pool } = require('../../utils/database');
const { exportStandingsToExcel } = require('../../utils/excelHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('export_standings')
        .setDescription('Xuất bảng xếp hạng vòng Thụy Sĩ ra file Excel'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            console.log('[EXPORT] Bắt đầu export bảng xếp hạng...');

            const res = await pool.query(`
            SELECT 
                in_game_name AS "Người chơi",
                discord_id AS "Discord ID",
                wins AS "Thắng",
                losses AS "Thua",
                draws AS "Hòa",
                (wins * 3 + draws) AS "Điểm"
            FROM players 
            ORDER BY "Điểm" DESC, wins DESC
        `);

            const players = res.rows;

            console.log(
                '[EXPORT] Số lượng người chơi:',
                players.length
            );

            if (players.length === 0) {
                return interaction.editReply(
                    '❌ Hiện chưa có dữ liệu tuyển thủ trong hệ thống!'
                );
            }

            const buffer = await exportStandingsToExcel(players);

            if (!buffer) {
                return interaction.editReply(
                    '❌ Không thể tạo file Excel bảng xếp hạng!'
                );
            }

            console.log(
                '[EXPORT] Buffer Excel:',
                buffer.length,
                'bytes'
            );

            const file = new AttachmentBuilder(buffer, {
                name: 'bang-xep-hang.xlsx'
            });

            console.log('[EXPORT] Đang gửi file lên Discord...');

            await interaction.editReply({
                content: '📊 Bảng xếp hạng mới nhất của giải đấu:',
                files: [file]
            });

            console.log('[EXPORT] Gửi file thành công!');

        } catch (error) {
            console.error('[EXPORT ERROR]', error);

            try {
                await interaction.editReply(
                    `❌ Có lỗi khi xuất file Excel: ${error.message}`
                );
            } catch (replyError) {
                console.error(
                    '[EXPORT] Không thể gửi thông báo lỗi:',
                    replyError
                );
            }
        }
    },
};