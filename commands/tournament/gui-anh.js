// File: commands/tournament/gui-anh.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { pool, getPlayer } = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gui-anh')
        .setDescription('Tải ảnh bằng chứng kết quả trận đấu để mở khóa báo cáo')
        .addAttachmentOption(option =>
            option.setName('image')
                .setDescription('Hình ảnh chụp màn hình kết quả trận đấu')
                .setRequired(true)
        ),

    async execute(interaction) {
        const channelId = interaction.channel.id;

        const matchRes = await pool.query('SELECT * FROM matches WHERE channel_id = $1', [channelId]);
        const match = matchRes.rows[0];

        if (!match) {
            return interaction.reply({ content: '❌ Kênh này không phải là kênh trận đấu hợp lệ!', ephemeral: true });
        }

        if (interaction.user.id !== match.player1_id && interaction.user.id !== match.player2_id) {
            return interaction.reply({ content: '❌ Bạn không phải là tuyển thủ của trận đấu này!', ephemeral: true });
        }

        if (match.is_proof_submitted === 1) {
            return interaction.reply({ content: '⚠️ Ảnh kết quả trận đấu đã được gửi trước đó rồi!', ephemeral: true });
        }

        const image = interaction.options.getAttachment('image');

        // Danh sách các phần mở rộng hình ảnh phổ biến
        const validExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
        const fileName = image.name ? image.name.toLowerCase() : '';
        const isValidExt = validExtensions.some(ext => fileName.endsWith(ext));

        const isValidContentType = image.contentType && image.contentType.startsWith('image/');

        if (!isValidContentType && !isValidExt) {
            return interaction.reply({ content: '❌ File tải lên phải là hình ảnh (PNG, JPG, WEBP...)!', ephemeral: true });
        }

        // Cập nhật DB trong PostgreSQL
        await pool.query(
            'UPDATE matches SET proof_image = $1, is_proof_submitted = 1 WHERE match_id = $2',
            [image.url, match.match_id]
        );

        const p1 = await getPlayer(match.player1_id);
        const p2 = await getPlayer(match.player2_id);

        const proofEmbed = new EmbedBuilder()
            .setTitle('📸 BẰNG CHỨNG KẾT QUẢ TRẬN ĐẤU')
            .setDescription(`Người gửi: <@${interaction.user.id}>\n\n✅ **Ảnh đã được ghi nhận.** Vui lòng bấm một trong các nút bên dưới để chọn kết quả!`)
            .setImage(image.url)
            .setColor(0x2ECC71);

        // Mở khóa 4 nút bấm
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`win_p1_${match.match_id}`)
                .setLabel(`🏆 ${p1 ? p1.in_game_name : 'Player 1'} thắng`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(false),
            new ButtonBuilder()
                .setCustomId(`win_p2_${match.match_id}`)
                .setLabel(`🏆 ${p2 ? p2.in_game_name : 'Player 2'} thắng`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(false),
            new ButtonBuilder()
                .setCustomId(`draw_${match.match_id}`)
                .setLabel(`🤝 Hòa`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(false),
            new ButtonBuilder()
                .setCustomId(`call_mod_${match.match_id}`)
                .setLabel(`⚠️ Gọi Mod`)
                .setStyle(ButtonStyle.Danger)
                .setDisabled(false)
        );

        await interaction.reply({ embeds: [proofEmbed], components: [row] });
    }
};