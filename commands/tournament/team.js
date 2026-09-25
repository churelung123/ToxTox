// File: commands/tournament/team.js
const { SlashCommandBuilder } = require('discord.js');
const { analyzePokemonTeamImages } = require('../../utils/geminiVision');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('team')
        .setDescription('Gửi 1 hoặc 2 ảnh team Pokémon để Gemini AI phân tích chi tiết')
        .addAttachmentOption(option =>
            option
                .setName('image1')
                .setDescription('Hình ảnh team sheet thứ nhất')
                .setRequired(true)
        )
        .addAttachmentOption(option =>
            option
                .setName('image2')
                .setDescription('Hình ảnh team sheet thứ hai (tùy chọn)')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const attachment1 = interaction.options.getAttachment('image1');
        const attachment2 = interaction.options.getAttachment('image2');

        if (!attachment1 || !attachment1.url) {
            return interaction.editReply('❌ Vui lòng đính kèm ít nhất hình ảnh hợp lệ đầu tiên!');
        }

        // Gom các URL ảnh lại thành một mảng
        const imageUrls = [attachment1.url];
        if (attachment2 && attachment2.url) {
            imageUrls.push(attachment2.url);
        }

        // Gọi hàm xử lý nhiều ảnh
        const analysisResult = await analyzePokemonTeamImages(imageUrls);
        
        return interaction.editReply({
            content: `${analysisResult}`
        });
    }
};