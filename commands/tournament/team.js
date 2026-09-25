// File: commands/tournament/team.js
const { SlashCommandBuilder } = require('discord.js');
const { analyzePokemonTeamImage } = require('../../utils/geminiVision');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('team')
        .setDescription('Gửi ảnh team Pokémon để Gemini AI phân tích chi tiết')
        .addAttachmentOption(option =>
            option
                .setName('image')
                .setDescription('Hình ảnh team sheet của bạn')
                .setRequired(true)
        ),

    async execute(interaction) {
        // Vì AI phân tích ảnh có thể mất vài giây, dùng deferReply để bot hiển thị trạng thái đang suy nghĩ
        await interaction.deferReply();

        const attachment = interaction.options.getAttachment('image');

        if (!attachment || !attachment.contentType?.startsWith('image/')) {
            return interaction.editReply('❌ Vui lòng đính kèm một tệp hình ảnh hợp lệ!');
        }

        // Gọi hàm phân tích ảnh từ module geminiVision.js
        const analysisResult = await analyzePokemonTeamImage(attachment.url);

        // Trả kết quả phân tích về cho người dùng
        return interaction.editReply({
            content: `🔍 **Phân tích Team Pokémon bởi Gemini AI:**\n\n${analysisResult}`
        });
    }
};