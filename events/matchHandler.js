// File: handlers/matchHandler.js
const {
    exportStandingsToExcel,
    exportMatchesByRoundToExcel
} = require('../utils/excelHelper');

async function handleMatchButton(req, res, customId, userId, pool) {
    try {
        // ----------------------------------------------------
        // 1. KHI NGƯỜI CHƠI BẤM CHỌN KẾT QUẢ (win_p1_ / win_p2_)
        // ----------------------------------------------------
        if (customId.startsWith('win_p1_') || customId.startsWith('win_p2_')) {
            const matchId = customId.split('_').pop();

            const matchRes = await pool.query(
                'SELECT * FROM matches WHERE match_id = $1',
                [matchId]
            );
            const match = matchRes.rows[0];

            if (!match) {
                return res.status(200).json({
                    type: 4,
                    data: { content: '❌ Không tìm thấy thông tin trận đấu!', flags: 64 }
                });
            }

            if (userId !== match.player1_id && userId !== match.player2_id) {
                return res.status(200).json({
                    type: 4,
                    data: { content: '❌ Bạn không phải tuyển thủ trong trận đấu này!', flags: 64 }
                });
            }

            if (match.is_proof_submitted !== 1) {
                return res.status(200).json({
                    type: 4,
                    data: { content: '⚠️ Bạn phải dùng lệnh `/gui-anh` để gửi bằng chứng trước khi chọn kết quả!', flags: 64 }
                });
            }

            if (match.status === 'completed') {
                return res.status(200).json({
                    type: 4,
                    data: { content: '✅ Trận đấu này đã kết thúc!', flags: 64 }
                });
            }

            let reportedWinner = customId.startsWith('win_p1_') ? match.player1_id : match.player2_id;
            let scoreP1 = customId.startsWith('win_p1_') ? 1 : 0;
            let scoreP2 = customId.startsWith('win_p1_') ? 0 : 1;

            await pool.query(
                `
                UPDATE matches
                SET player1_score = $1, player2_score = $2, reported_by = $3, winner_id = $4, status = 'waiting_confirm'
                WHERE match_id = $5
                `,
                [scoreP1, scoreP2, userId, reportedWinner, matchId]
            );

            const opponentId = userId === match.player1_id ? match.player2_id : match.player1_id;
            const resultText = `<@${reportedWinner}> Thắng`;

            // Cập nhật tin nhắn (type: 7): Xóa sạch các nút player cũ, chỉ giữ lại Xác nhận và Khiếu nại/Gọi Mod
            return res.status(200).json({
                type: 7,
                data: {
                    embeds: [{
                        title: '⏳ CHỜ XÁC NHẬN KẾT QUẢ',
                        description: `<@${userId}> đã báo kết quả: **${resultText}**\n\n<@${opponentId}> vui lòng bấm **Xác nhận** nếu thông tin chính xác, hoặc bấm **Gọi Mod** nếu có tranh chấp.`,
                        color: 0xF1C40F
                    }],
                    components: [
                        {
                            type: 1,
                            components: [
                                {
                                    type: 2,
                                    custom_id: `confirm_match_${matchId}`,
                                    label: 'Xác nhận ✅',
                                    style: 3 // Xanh lá
                                },
                                {
                                    type: 2,
                                    custom_id: `dispute_match_${matchId}`,
                                    label: 'Gọi Mod ⚠️',
                                    style: 4 // Đỏ
                                }
                            ]
                        }
                    ]
                }
            });
        }

        // ----------------------------------------------------
        // 2. KHI ĐỐI THỦ BẤM XÁC NHẬN (confirm_match_)
        // ----------------------------------------------------
        if (customId.startsWith('confirm_match_')) {
            const matchId = customId.split('_')[2];

            const matchRes = await pool.query(
                'SELECT * FROM matches WHERE match_id = $1',
                [matchId]
            );
            const match = matchRes.rows[0];

            if (!match) {
                return res.status(200).json({
                    type: 4,
                    data: { content: '❌ Trận đấu không tồn tại!', flags: 64 }
                });
            }

            if (userId === match.reported_by) {
                return res.status(200).json({
                    type: 4,
                    data: { content: '❌ Bạn là người báo kết quả, hãy chờ đối thủ bấm xác nhận!', flags: 64 }
                });
            }

            const winnerId = match.winner_id;

            await pool.query(
                `UPDATE matches SET status = 'completed' WHERE match_id = $1`,
                [matchId]
            );

            if (winnerId) {
                const loserId = winnerId === match.player1_id ? match.player2_id : match.player1_id;
                await pool.query(`UPDATE players SET wins = wins + 1 WHERE discord_id = $1`, [winnerId]);
                await pool.query(`UPDATE players SET losses = losses + 1 WHERE discord_id = $1`, [loserId]);
            }

            const allPlayersRes = await pool.query(
                `
                SELECT discord_id, in_game_name, wins, losses AS points
                FROM players
                ORDER BY points DESC, wins DESC
                `
            );

            if (typeof exportStandingsToExcel === 'function') {
                await exportStandingsToExcel(allPlayersRes.rows);
            }

            if (typeof exportMatchesByRoundToExcel === 'function') {
                await exportMatchesByRoundToExcel();
            }

            const resultDisplay = winnerId === `🏆 Người thắng: <@${winnerId}>`;

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

        // ----------------------------------------------------
        // 3. KHI BẤM KHIẾU NẠI / GỌI MOD (dispute_match_)
        // ----------------------------------------------------
        if (customId.startsWith('dispute_match_')) {
            return res.status(200).json({
                type: 4,
                data: {
                    content: `⚠️ <@${userId}> đã yêu cầu trợ giúp / khiếu nại! <@&1534802354480746656> (Ban Tổ Chức / Trọng tài) hãy vào kiểm tra bàn đấu này ngay!`
                }
            });
        }

    } catch (err) {
        console.error('[MATCH HANDLER ERROR]:', err);
        return res.status(200).json({
            type: 4,
            data: { content: '❌ Đã xảy ra lỗi khi xử lý tương tác nút bấm!', flags: 64 }
        });
    }
}

module.exports = { handleMatchButton };