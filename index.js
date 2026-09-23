// File: index.js
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const { initDatabase } = require('./utils/database');

// Khởi tạo Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

client.commands = new Collection();

// Khởi chạy Bot theo thứ tự
(async () => {
    try {
        // 1. Tự động kết nối & khởi tạo bảng PostgreSQL nếu chưa có
        await initDatabase();

        // 2. Nạp lệnh (Command Handler)
        const foldersPath = path.join(__dirname, 'commands');
        if (fs.existsSync(foldersPath)) {
            const commandFolders = fs.readdirSync(foldersPath);
            for (const folder of commandFolders) {
                const commandsPath = path.join(foldersPath, folder);
                const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
                
                for (const file of commandFiles) {
                    const filePath = path.join(commandsPath, file);
                    const command = require(filePath);
                    if ('data' in command && 'execute' in command) {
                        client.commands.set(command.data.name, command);
                        console.log(`[COMMAND] Đã nạp thành công lệnh: /${command.data.name}`);
                    } else {
                        console.warn(`[WARNING] Lệnh tại ${filePath} thiếu "data" hoặc "execute".`);
                    }
                }
            }
        }

        // 3. Nạp sự kiện (Event Handler)
        const eventsPath = path.join(__dirname, 'events');
        if (fs.existsSync(eventsPath)) {
            const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
            for (const file of eventFiles) {
                const filePath = path.join(eventsPath, file);
                const event = require(filePath);
                if (event.once) {
                    client.once(event.name, (...args) => event.execute(...args));
                } else {
                    client.on(event.name, (...args) => event.execute(...args));
                }
                console.log(`[EVENT] Đã lắng nghe sự kiện: ${event.name}`);
            }
        }

        // 4. Đăng nhập Discord Bot
        await client.login(process.env.DISCORD_TOKEN);

    } catch (error) {
        console.error('❌ Lỗi khi khởi động Bot:', error);
    }
})();