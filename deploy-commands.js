require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const commands = [];
const foldersPath = path.join(__dirname, 'commands');

// Quét toàn bộ thư mục commands để lấy dữ liệu lệnh
if (fs.existsSync(foldersPath)) {
    const commandFolders = fs.readdirSync(foldersPath);
    for (const folder of commandFolders) {
        const commandsPath = path.join(foldersPath, folder);
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
            }
        }
    }
}

// Khởi tạo REST API để giao tiếp với Discord
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// Thực thi việc đẩy dữ liệu lên Discord
(async () => {
    try {
        console.log(`Đang bắt đầu làm mới ${commands.length} lệnh ứng dụng (/) ...`);

        // Đăng ký lệnh cho toàn bộ các server mà bot tham gia (Global Commands)
        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log(`✅ Đã tải lên thành công ${data.length} lệnh ứng dụng (/).`);
    } catch (error) {
        console.error('❌ Có lỗi xảy ra khi đăng ký lệnh:', error);
    }
})();