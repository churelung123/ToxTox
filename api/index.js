// File: api/index.js
const { verifyKey } = require('discord-interactions');

// Import tất cả các Handler của lệnh vào một Map
const commands = new Map();

// Đăng ký các command từ thư mục commands
const commandFiles = [
    require('../commands/tournament/setKetQua'),
    require('../commands/tournament/cleardata'),
    require('../commands/tournament/export'),
    require('../commands/tournament/gui-anh'),
    require('../commands/tournament/import'),
    require('../commands/tournament/override'),
    require('../commands/tournament/startround'),
    require('../commands/tournament/vong-tiep-theo'),
    require('../commands/tournament/xoa-kenh-dau'),
];

for (const cmd of commandFiles) {
    if (cmd && cmd.data && cmd.data.name) {
        commands.set(cmd.data.name, cmd);
    }
}

function getRawBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', err => reject(err));
    });
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    const signature = req.headers['x-signature-ed25519'];
    const timestamp = req.headers['x-signature-timestamp'];
    const clientPublicKey = process.env.DISCORD_PUBLIC_KEY;

    if (!signature || !timestamp || !clientPublicKey) {
        return res.status(401).send('Missing signature or public key');
    }

    try {
        const rawBody = await getRawBody(req);
        const isValidRequest = await verifyKey(rawBody, signature, timestamp, clientPublicKey);

        if (!isValidRequest) {
            return res.status(401).send('Bad request signature');
        }

        const interaction = JSON.parse(rawBody.toString('utf-8'));

        // 1. PING Check từ Discord
        if (interaction.type === 1) {
            return res.status(200).json({ type: 1 });
        }

        // 2. Dispatcher cho Slash Commands (Type 2)
        if (interaction.type === 2) {
            const { name } = interaction.data;
            const command = commands.get(name);

            if (!command) {
                return res.status(200).json({
                    type: 4,
                    data: { content: `⚠️ Lệnh \`/${name}\` chưa được tích hợp vào Serverless Function.` }
                });
            }

            // Gọi hàm execute của command file tương ứng
            // Lưu ý: Cần adapter hỗ trợ interaction từ Webhook Serverless
            return await command.execute(interaction, res);
        }

        return res.status(200).json({ type: 4, data: { content: 'Interaction type không hỗ trợ.' } });

    } catch (err) {
        console.error('[SERVERLESS DISCORD ERROR]:', err);
        return res.status(500).send('Internal Server Error');
    }
};

module.exports.config = {
    api: { bodyParser: false }
};