// File: commands/tournament/startround.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../utils/database'); // Đã destructure đúng { db }
const { createMatchChannels } = require('../../utils/channelManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('startround')
        .setDescription('Bắt đầu Round đấu: Tự động tạo kênh chat ẩn hàng loạt')
        .addIntegerOption(opt => 
            opt.setName('round')
               .setDescription('Số Round đấu (VD: 1, 2, 3)')
               .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const roundNumber = interaction.options.getInteger('round');

            // ĐÃ SỬA: Dùng binding parameter ? cho cả round_number và status
            const matches = db.prepare('SELECT * FROM matches WHERE round_number = ? AND status = ?').all(roundNumber, 'pending');

            if (!matches || matches.length === 0) {
                return await interaction.editReply(`❌ Không tìm thấy trận đấu nào đang chờ (pending) ở Round ${roundNumber}!`);
            }

            await interaction.editReply(`🚀 Đang khởi tạo ${matches.length} kênh chat ẩn cho Round ${roundNumber}...`);

            await createMatchChannels(interaction.guild, matches, roundNumber);

            await interaction.editReply(`✅ **Hoàn tất!** Đã tạo xong tất cả các bàn thi đấu cho Round ${roundNumber}.`);

        } catch (error) {
            console.error('[STARTROUND ERROR]:', error);
            await interaction.editReply(`❌ Lỗi khi thực thi lệnh: \`${error.message}\``);
        }
    }
};