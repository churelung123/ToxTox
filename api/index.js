// File: api/index.js
const { verifyKey } = require('discord-interactions');

// Hàm đọc raw buffer từ request
function getRawBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', err => reject(err));
    });
}

module.exports = async (req, res) => {
    console.log('🔥 DISCORD REQUEST RECEIVED');
    console.log('Method:', req.method);
    console.log('Path:', req.url);
    console.log('Signature:', !!req.headers['x-signature-ed25519']);
    console.log('Timestamp:', !!req.headers['x-signature-timestamp']);
    console.log('Public key:', !!process.env.DISCORD_PUBLIC_KEY);

    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    const signature = req.headers['x-signature-ed25519'];
    const timestamp = req.headers['x-signature-timestamp'];
    const clientPublicKey = process.env.DISCORD_PUBLIC_KEY;

    if (!signature || !timestamp || !clientPublicKey) {
        console.log({
            hasSignature: !!signature,
            hasTimestamp: !!timestamp,
            hasPublicKey: !!clientPublicKey,
        });

        return res.status(401).send('Missing signature or public key');
    }

    try {
        const rawBody = await getRawBody(req);

        console.log('RAW BODY LENGTH:', rawBody.length);
        console.log('SIGNATURE LENGTH:', signature?.length);
        console.log('TIMESTAMP:', timestamp);
        console.log('PUBLIC KEY LENGTH:', clientPublicKey?.length);

        const isValidRequest = await verifyKey(
            rawBody,
            signature,
            timestamp,
            clientPublicKey
        );

        console.log('VERIFY RESULT:', isValidRequest);

        if (!isValidRequest) {
            return res.status(401).send('Bad request signature');
        }

        const interaction = JSON.parse(rawBody.toString('utf-8'));

        // 1. PING CHECK từ Discord Developer Portal (Trả về ngay 200, không đụng đến DB)
        if (interaction.type === 1) {
            return res.status(200).json({ type: 1 });
        }

        // 2. Xử lý Slash Commands (Type 2) -> Lúc này mới load DB
        if (interaction.type === 2) {
            const { pool } = require('../utils/database');
            const { name } = interaction.data;

            if (name === 'set-ket-qua') {
                const options = interaction.data.options || [];
                const matchId = options.find(opt => opt.name === 'match_id')?.value;
                const ketQua = options.find(opt => opt.name === 'ket_qua')?.value;

                const matchRes = await pool.query('SELECT * FROM matches WHERE match_id = $1', [matchId]);
                if (matchRes.rows.length === 0) {
                    return res.status(200).json({
                        type: 4,
                        data: { content: `❌ Không tìm thấy trận đấu có Match ID: \`${matchId}\`.` }
                    });
                }

                const match = matchRes.rows[0];
                let winnerId = null;
                let status = 'completed';
                let detailText = '';

                if (ketQua === 'p1_win') {
                    winnerId = match.player1_id;
                    detailText = `🏆 Xử thắng cho <@${match.player1_id}>`;
                } else if (ketQua === 'p2_win') {
                    winnerId = match.player2_id;
                    detailText = `🏆 Xử thắng cho <@${match.player2_id}>`;
                } else if (ketQua === 'draw') {
                    detailText = `🤝 Xử HÒA`;
                } else if (ketQua === 'reset') {
                    status = 'pending';
                    detailText = `🔄 Đã đưa trận đấu về trạng thái chờ thi đấu (Pending)`;
                }

                await pool.query(
                    'UPDATE matches SET status = $1, winner_id = $2 WHERE match_id = $3',
                    [status, winnerId, matchId]
                );

                return res.status(200).json({
                    type: 4,
                    data: {
                        content: `⚖️ **Trọng Tài Can Thiệp Trận Đấu #${matchId}**\n**Kết quả:** ${detailText}`
                    }
                });
            }
        }

        return res.status(400).send('Unknown interaction type');

    } catch (err) {
        console.error('[DISCORD INTERACTION ERROR]:', err);
        return res.status(500).send('Internal Server Error');
    }
};

module.exports.config = {
    api: {
        bodyParser: false,
    },
};