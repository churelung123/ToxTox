// File: api/index.js
const { verifyKey } = require('discord-interactions');
const { pool } = require('../utils/database');
const { exportStandingsToExcel, exportMatchesByRoundToExcel } = require('../utils/excelHelper');

// Import tất cả các command
const commands = new Map();
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
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

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

        // 2. Slash Commands (Type 2)
        if (interaction.type === 2) {
            const { name } = interaction.data;
            const command = commands.get(name);

            if (!command) {
                return res.status(200).json({
                    type: 4,
                    data: { content: `⚠️ Lệnh \`/${name}\` chưa được tích hợp.` }
                });
            }

            // Gọi hàm execute tương thích Serverless
            const result = await command.executeServerless ? command.executeServerless(interaction) : await executeLegacyCommand(command, interaction);
            return res.status(200).json({ type: 4, data: typeof result === 'string' ? { content: result } : result });
        }

        // 3. Message Components / Buttons (Type 3)
        if (interaction.type === 3) {
            const customId = interaction.data.custom_id;
            const userId = interaction.member?.user?.id || interaction.user?.id;

            // Xử lý logic nút bấm tương tự như trong interactionCreate.js cũ
            if (customId.startsWith('win_p1_') || customId.startsWith('win_p2_') || customId.startsWith('draw_') || customId.startsWith('call_mod_')) {
                const matchId = customId.split('_').pop();
                const matchRes = await pool.query('SELECT * FROM matches WHERE match_id = $1', [matchId]);
                const match = matchRes.rows[0];

                if (!match) return res.status(200).json({ type: 4, data: { content: '❌ Không tìm thấy thông tin trận đấu!', flags: 64 } });
                if (userId !== match.player1_id && userId !== match.player2_id) {
                    return res.status(200).json({ type: 4, data: { content: '❌ Bạn không phải tuyển thủ trong trận đấu này!', flags: 64 } });
                }
                if (match.is_proof_submitted !== 1) {
                    return res.status(200).json({ type: 4, data: { content: '⚠️ Bạn phải dùng lệnh `/gui-anh` để gửi bằng chứng trước khi chọn kết quả!', flags: 64 } });
                }
                if (match.status === 'completed') {
                    return res.status(200).json({ type: 4, data: { content: '✅ Trận đấu này đã kết thúc!', flags: 64 } });
                }

                if (customId.startsWith('call_mod_')) {
                    return res.status(200).json({
                        type: 4,
                        data: { content: `⚠️ <@${userId}> đã yêu cầu trợ giúp. Ban Tổ Chức / Trọng tài sẽ vào kiểm tra bàn đấu này!` }
                    });
                }

                let reportedWinner = null;
                let scoreP1 = 0;
                let scoreP2 = 0;

                if (customId.startsWith('win_p1_')) {
                    reportedWinner = match.player1_id;
                    scoreP1 = 1;
                    scoreP2 = 0;
                } else if (customId.startsWith('win_p2_')) {
                    reportedWinner = match.player2_id;
                    scoreP1 = 0;
                    scoreP2 = 1;
                } else if (customId.startsWith('draw_')) {
                    reportedWinner = 'DRAW';
                    scoreP1 = 0;
                    scoreP2 = 0;
                }

                await pool.query(`
                    UPDATE matches 
                    SET player1_score = $1, player2_score = $2, reported_by = $3, winner_id = $4, status = 'waiting_confirm' 
                    WHERE match_id = $5
                `, [scoreP1, scoreP2, userId, reportedWinner, matchId]);

                const opponentId = (userId === match.player1_id) ? match.player2_id : match.player1_id;
                const resultText = reportedWinner === 'DRAW' ? 'Hòa' : `<@${reportedWinner}> Thắng`;

                return res.status(200).json({
                    type: 4,
                    data: {
                        embeds: [{
                            title: '⏳ CHỜ XÁC NHẬN KẾT QUẢ',
                            description: `<@${userId}> đã báo kết quả: **${resultText}**\n\n<@${opponentId}> vui lòng bấm **Xác nhận** nếu thông tin chính xác, hoặc **Khiếu nại** nếu có sai sót.`,
                            color: 0xF1C40F
                        }],
                        components: [{
                            type: 1,
                            components: [
                                { type: 2, custom_id: `confirm_match_${matchId}`, label: 'Xác nhận ✅', style: 3 },
                                { type: 2, custom_id: `dispute_match_${matchId}`, label: 'Khiếu nại ❌', style: 4 }
                            ]
                        }]
                    }
                });
            }

            // Nút Xác nhận kết quả
            if (customId.startsWith('confirm_match_')) {
                const matchId = customId.split('_')[2];
                const matchRes = await pool.query('SELECT * FROM matches WHERE match_id = $1', [matchId]);
                const match = matchRes.rows[0];

                if (!match) return res.status(200).json({ type: 4, data: { content: '❌ Trận đấu không tồn tại!', flags: 64 } });
                if (userId === match.reported_by) {
                    return res.status(200).json({ type: 4, data: { content: '❌ Bạn là người báo kết quả, hãy chờ đối thủ bấm xác nhận!', flags: 64 } });
                }

                const winnerId = match.winner_id;
                await pool.query(`UPDATE matches SET status = 'completed' WHERE match_id = $1`, [matchId]);

                if (winnerId === 'DRAW') {
                    await pool.query('UPDATE players SET draws = draws + 1 WHERE discord_id = $1', [match.player1_id]);
                    await pool.query('UPDATE players SET draws = draws + 1 WHERE discord_id = $1', [match.player2_id]);
                } else if (winnerId) {
                    const loserId = (winnerId === match.player1_id) ? match.player2_id : match.player1_id;
                    await pool.query('UPDATE players SET wins = wins + 1 WHERE discord_id = $1', [winnerId]);
                    await pool.query('UPDATE players SET losses = losses + 1 WHERE discord_id = $1', [loserId]);
                }

                const allPlayersRes = await pool.query(
                    'SELECT discord_id, in_game_name, wins, losses, draws, (wins * 3 + draws) as points FROM players ORDER BY points DESC, wins DESC'
                );
                if (typeof exportStandingsToExcel === 'function') await exportStandingsToExcel(allPlayersRes.rows);
                if (typeof exportMatchesByRoundToExcel === 'function') await exportMatchesByRoundToExcel();

                const resultDisplay = winnerId === 'DRAW' ? '🤝 Hòa' : `🏆 Người thắng: <@${winnerId}>`;

                // Cập nhật lại tin nhắn cũ (type 7: UPDATE_MESSAGE)
                return res.status(200).json({
                    type: 7,
                    data: {
                        embeds: [{
                            title: '🎉 TRẬN ĐẤU HOÀN TẤT',
                            description: `Kết quả đã được xác nhận!\n\n**${resultDisplay}**\n\n*Kênh đã hoàn tất.*`,
                            color: 0x2ECC71
                        }],
                        components: []
                    }
                });
            }

            // Nút Khiếu nại
            if (customId.startsWith('dispute_match_')) {
                return res.status(200).json({
                    type: 4,
                    data: { content: `⚠️ **Đã gửi khiếu nại!** Ban Tổ Chức / Trọng tài sẽ vào kiểm tra bàn đấu này.` }
                });
            }
        }

        return res.status(200).json({ type: 4, data: { content: 'Unsupported Interaction' } });

    } catch (err) {
        console.error('[SERVERLESS ERROR]:', err);
        return res.status(500).send('Internal Server Error');
    }
};

// Hàm hỗ trợ tương thích ngược cho các file lệnh chưa đổi sang executeServerless
async function executeLegacyCommand(command, interaction) {
    let responsePayload = null;
    let deferred = false;

    const mockInteraction = {
        ...interaction,
        client: { commands },
        options: {
            getInteger: (name) => interaction.data.options?.find(o => o.name === name)?.value,
            getString: (name) => interaction.data.options?.find(o => o.name === name)?.value,
            getUser: (name) => {
                const opt = interaction.data.options?.find(o => o.name === name);
                return interaction.data.resolved?.users?.[opt?.value];
            },
            getAttachment: (name) => {
                const opt = interaction.data.options?.find(o => o.name === name);
                if (!opt) return null;

                const attachmentsObj = interaction.data.resolved?.attachments || {};
                const attachment = attachmentsObj[opt.value] || Object.values(attachmentsObj)[0];

                if (!attachment) return null;

                return {
                    ...attachment,
                    name: attachment.name || attachment.filename || '',
                    filename: attachment.filename || attachment.name || '',
                };
            },
        },
        channel: { id: interaction.channel_id },
        user: interaction.member?.user || interaction.user,
        member: interaction.member,
        guildId: interaction.guild_id,
        deferred: false,
        replied: false,
        async deferReply() { deferred = true; },
        async reply(options) { responsePayload = options; },
        async editReply(options) { responsePayload = options; }
    };

    await command.execute(mockInteraction);
    return responsePayload;
}

module.exports.config = {
    api: { bodyParser: false }
};