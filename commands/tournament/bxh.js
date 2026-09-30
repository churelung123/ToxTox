// File: commands/bxh.js
const { SlashCommandBuilder } = require('discord.js');
const { generateLeaderboardEmbed } = require('../utils/leaderboardHelper');

// Biến lưu trữ tạm thời message_id của bảng xếp hạng (hoặc bạn có thể lưu vào DB)
let leaderboardMessageCache = { channelId: null, messageId: null };

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bxh')
        .setDescription('Hiển thị và tạo bảng xếp hạng trực tiếp của giải đấu'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const embed = await generateLeaderboardEmbed();
        if (!embed) {
            return interaction.editReply('❌ Lỗi khi tạo bảng xếp hạng!');
        }

        // Gửi ra kênh hiện tại (hoặc kênh thông báo chung)
        const sentMessage = await interaction.channel.send({ embeds: [embed] });
        
        // Lưu lại để các trận đấu sau cập nhật vào đúng tin nhắn này
        leaderboardMessageCache.channelId = sentMessage.channel.id;
        leaderboardMessageCache.messageId = sentMessage.id;

        await interaction.editReply('✅ Đã khởi tạo bảng xếp hạng thành công ở kênh này!');
    },

    leaderboardMessageCache
};