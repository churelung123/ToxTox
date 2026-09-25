// File: commands/tournament/sync.js
const { SlashCommandBuilder, REST, Routes } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sync')
        .setDescription('Đồng bộ hóa toàn bộ các Slash Commands lên Discord'),

    async execute(interaction) {
        // Kiểm tra quyền hạn (ví dụ chỉ cho phép Administrator dùng lệnh này)
        if (!interaction.member.permissions.has('Administrator')) {
            return interaction.reply({
                content: '❌ Bạn không có quyền sử dụng lệnh đồng bộ này!',
                ephemeral: true
            });
        }

        try {
            await interaction.deferReply({ ephemeral: true });

            // Danh sách các file lệnh hiện tại của bạn
            const commandFiles = [
                require('./setKetQua'),
                require('./cleardata'),
                require('./export'),
                require('./gui-anh'),
                require('./import'),
                require('./override'),
                require('./startround'),
                require('./vong-tiep-theo'),
                require('./xoa-kenh-dau'),
                require('./sync'),
            ];

            const body = [];
            for (const cmd of commandFiles) {
                if (cmd && cmd.data) {
                    body.push(cmd.data.toJSON());
                }
            }

            const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

            // Đồng bộ lệnh cho riêng Server hiện tại (Cập nhật lập tức không mất thời gian chờ Global)
            await rest.put(
                Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, interaction.guildId),
                { body },
            );

            return interaction.editReply(`✅ Đã đồng bộ thành công **${body.length}** lệnh lên server này!`);
        } catch (error) {
            console.error('[SYNC ERROR]:', error);
            return interaction.editReply('❌ Đã xảy ra lỗi khi đồng bộ lệnh lên Discord.');
        }
    }
};