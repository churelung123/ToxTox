// File: commands/tournament/menu.js (hoặc file lệnh tùy ý của bạn)
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('menu')
        .setDescription('Hiển thị bảng điều khiển giải đấu'),
    async execute(interaction) {
        const payload = {
            flags: 32768, // Components V2
            components: [
                {
                    type: 17, // Container
                    accent_color: 0x3498DB,

                    components: [
                        {
                            type: 10, // Text Display
                            content:
                                "### 🎮 BẢNG ĐIỀU KHIỂN GIẢI ĐẤU\n" +
                                "Chọn các tính năng bên dưới để tương tác với hệ thống:"
                        },

                        {
                            type: 14, // Separator
                            spacing: 1,
                            divider: true
                        },

                        {
                            type: 1, // Action Row
                            components: [
                                {
                                    type: 2, // Button
                                    style: 1, // Primary
                                    custom_id: 'btn_open_leaderboard',
                                    label: '🏆 Xem Bảng Xếp Hạng'
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        await interaction.reply(payload);
    }
};