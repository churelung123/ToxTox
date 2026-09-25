const {
    SlashCommandBuilder,
    REST,
    Routes,
    PermissionFlagsBits
} = require('discord.js');

const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sync')
        .setDescription('Đồng bộ hóa toàn bộ các Slash Commands lên Discord'),

    async execute(interaction) {
        // Kiểm tra quyền Administrator
        const permissions = interaction.member?.permissions;

        let isAdmin = false;

        if (permissions) {
            if (typeof permissions.has === 'function') {
                isAdmin = permissions.has(PermissionFlagsBits.Administrator);
            } else {
                try {
                    const permissionBits = BigInt(permissions);
                    isAdmin =
                        (permissionBits & BigInt(PermissionFlagsBits.Administrator)) !== 0n;
                } catch (error) {
                    console.error('[SYNC] Không thể đọc permissions:', permissions);
                }
            }
        }

        if (!isAdmin) {
            return interaction.reply({
                content: '❌ Bạn không có quyền sử dụng lệnh đồng bộ này!',
                ephemeral: true
            });
        }

        try {
            await interaction.deferReply({ ephemeral: true });

            // Tự động lấy tất cả file .js trong thư mục hiện tại
            const commandDir = __dirname;

            const commandFiles = fs
                .readdirSync(commandDir)
                .filter(file => file.endsWith('.js'));

            const body = [];

            for (const file of commandFiles) {
                try {
                    const command = require(path.join(commandDir, file));

                    if (command?.data) {
                        body.push(command.data.toJSON());
                    }
                } catch (error) {
                    console.error(
                        `[SYNC] Không thể load command ${file}:`,
                        error
                    );
                }
            }

            const rest = new REST({ version: '10' })
                .setToken(process.env.DISCORD_TOKEN);

            await rest.put(
                Routes.applicationGuildCommands(
                    process.env.CLIENT_ID,
                    interaction.guildId
                ),
                { body }
            );

            return interaction.editReply(
                `✅ Đã đồng bộ thành công **${body.length}** lệnh lên server này!`
            );

        } catch (error) {
            console.error('[SYNC ERROR]:', error);

            return interaction.editReply(
                '❌ Đã xảy ra lỗi khi đồng bộ lệnh lên Discord.'
            );
        }
    }
};