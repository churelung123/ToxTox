// File: commands/tournament/cleardata.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { pool } = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cleardata')
        .setDescription('Xóa toàn bộ dữ liệu tuyển thủ và lịch thi đấu trong CSDL')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            // Trong PostgreSQL dùng TRUNCATE để xóa sạch dữ liệu và tự reset ID (RESTART IDENTITY)
            await pool.query('TRUNCATE TABLE matches, players RESTART IDENTITY');

            await interaction.reply({
                content: '🧹 **Đã xóa toàn bộ dữ liệu trong CSDL!** Bạn có thể tiến hành `/import_data` lại từ đầu.',
                ephemeral: true
            });
        } catch (error) {
            console.error('[CLEAR DATA ERROR]', error);
            await interaction.reply({
                content: '❌ Có lỗi xảy ra khi xóa dữ liệu.',
                ephemeral: true
            });
        }
    },
};