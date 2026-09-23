// File: api/index.js
const { verifyKey } = require('discord-interactions');
const { pool } = require('../utils/database');

// Vercel Serverless Function Config
module.exports = async (req, res) => {
    // 1. Chỉ nhận HTTP POST request từ Discord
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    // 2. Xác thực request từ Discord bằng Public Key
    const signature = req.headers['x-signature-ed25519'];
    const timestamp = req.headers['x-signature-timestamp'];
    const clientPublicKey = process.env.DISCORD_PUBLIC_KEY;

    // Đọc raw body để verify signature
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks);

    const isValidRequest = verifyKey(rawBody, signature, timestamp, clientPublicKey);
    if (!isValidRequest) {
        return res.status(401).send('Bad request signature');
    }

    const interaction = JSON.parse(rawBody.toString());

    // 3. Xử lý Ping Check từ Discord (Bắt buộc)
    if (interaction.type === 1) {
        return res.status(200).json({ type: 1 });
    }

    // 4. Xử lý các Slash Commands (Type 2)
    if (interaction.type === 2) {
        const { name } = interaction.data;

        // Ví dụ: Xử lý lệnh /set-ket-qua
        if (name === 'set-ket-qua') {
            const matchId = interaction.data.options.find(opt => opt.name === 'match_id')?.value;
            const ketQua = interaction.data.options.find(opt => opt.name === 'ket_qua')?.value;

            try {
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
                    detailText = `🔄 Đã đưa trận đấu về trạng thái chờ thi đấu`;
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
            } catch (err) {
                console.error(err);
                return res.status(200).json({
                    type: 4,
                    data: { content: '❌ Đã xảy ra lỗi khi cập nhật CSDL PostgreSQL.' }
                });
            }
        }
    }

    return res.status(400).send('Unknown interaction type');
};