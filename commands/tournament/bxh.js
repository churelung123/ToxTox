// File: commands/tournament/bxh.js
const { SlashCommandBuilder } = require('discord.js');
const { generateLeaderboardPage } = require('../../utils/leaderboardHelper');

let leaderboardMessageCache = { channelId: null, messageId: null };

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bxh')
        .setDescription('Hiển thị bảng xếp hạng giải đấu phân trang và nút team sheet'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const msgPayload = await generateLeaderboardPage(1);
        if (!msgPayload) {
            return interaction.editReply('❌ Lỗi khi tạo bảng xếp hạng!');
        }

        const sentMessage = await interaction.channel.send(msgPayload);
        
        leaderboardMessageCache.channelId = sentMessage.channel.id;
        leaderboardMessageCache.messageId = sentMessage.id;

        await interaction.editReply('✅ Đã khởi tạo bảng xếp hạng thành công ở kênh này!');
    },

    leaderboardMessageCache
};