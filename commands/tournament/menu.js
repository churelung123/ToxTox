// File: commands/tournament/menu.js (hoặc file lệnh tùy ý của bạn)
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('menu')
        .setDescription('Hiển thị bảng điều khiển giải đấu'),
    async execute(interaction) {
        // Cấu trúc Components V2 cho Menu chính
        const payload = {
            flags: 32768, // Bắt buộc để dùng Components V2 (IS_COMPONENTS_V2)
            components: [
                {
                    type: 17, // Container component
                    accent_color: 0x3498DB,
                    components: [
                        {
                            type: 10, // Text Display
                            content: "### 🎮 BẢNG ĐIỀU KHIỂN GIẢI ĐẤU\nChọn các tính năng bên dưới để tương tác với hệ thống:"
                        },
                        {
                            type: 14, // Separator
                            spacing: 1,
                            divider: true
                        }
                    ]
                },
                {
                    type: 1, // Action Row chứa các nút chức năng
                    components: [
                        {
                            type: 2, // Button
                            style: 1, // Primary (Blurple)
                            custom_id: 'btn_open_leaderboard',
                            label: '🏆 Xem Bảng Xếp Hạng',
                            emoji: { name: '📊' }
                        }
                        // Sau này bạn có thể thêm các nút khác vào đây
                    ]
                }
            ]
        };

        await interaction.reply(payload);
    }
};