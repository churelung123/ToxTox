// File: commands/tournament/xoa-kenh-dau.js
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { deleteAllMatchChannels } = require('../../utils/channelManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('xoa-kenh-dau')
        .setDescription('Xóa hàng loạt toàn bộ các kênh bàn đấu và Category vòng đấu')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Tương tác này có thể mất vài giây nếu số lượng kênh nhiều, dùng deferReply
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const count = await deleteAllMatchChannels(interaction.guild);

            if (count === 0) {
                return interaction.editReply('⚠️ Không tìm thấy kênh bàn đấu nào để xóa.');
            }

            await interaction.editReply(`🧹 **Đã xóa thành công ${count} kênh thi đấu!**`);
        } catch (error) {
            console.error('Lỗi khi xóa kênh đấu:', error);
            await interaction.editReply('❌ Có lỗi xảy ra trong quá trình xóa hàng loạt kênh đấu.');
        }
    }
};