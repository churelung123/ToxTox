require('dotenv').config();
require('./utils/database');
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');

// Khởi tạo Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

// Tạo một Collection lưu trữ toàn bộ Slash Commands
client.commands = new Collection();

// ==========================================
// 1. TỰ ĐỘNG NẠP LỆNH (COMMAND HANDLER)
// ==========================================
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
                console.warn(`[WARNING] Lệnh tại ${filePath} thiếu trường "data" hoặc "execute".`);
            }
        }
    }
}

// ==========================================
// 2. TỰ ĐỘNG NẠP SỰ KIỆN (EVENT HANDLER)
// ==========================================
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

// ==========================================
// 3. ĐĂNG NHẬP BOT
// ==========================================
client.login(process.env.DISCORD_TOKEN);