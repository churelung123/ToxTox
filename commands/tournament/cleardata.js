// File: commands/tournament/cleardata.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cleardata')
        .setDescription('Xóa toàn bộ dữ liệu tuyển thủ và lịch thi đấu trong CSDL')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            db.prepare('DELETE FROM matches').run();
            db.prepare('DELETE FROM players').run();
            db.prepare("DELETE FROM sqlite_sequence WHERE name = 'matches'").run();

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