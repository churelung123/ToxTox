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

            if (players.length === 0) {
                return interaction.editReply('❌ Hiện chưa có dữ liệu tuyển thủ trong hệ thống!');
            }

            // Nhận về buffer thay vì tên file
            const excelBuffer = await exportStandingsToExcel(players);
            
            if (!excelBuffer) {
                return interaction.editReply('❌ Không thể tạo file Excel bảng xếp hạng.');
            }

            // Truyền buffer và chỉ định tên file hiển thị trên Discord
            const file = new AttachmentBuilder(excelBuffer, { name: 'standings.xlsx' });

            await interaction.editReply({ 
                content: '📊 Bảng xếp hạng mới nhất của giải đấu:', 
                files: [file] 
            });
        } catch (error) {
            console.error('[EXPORT ERROR]', error);
            await interaction.editReply('❌ Có lỗi xảy ra khi xuất file Excel Bảng xếp hạng!');
        }
    },
};