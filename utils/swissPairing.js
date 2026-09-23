// File: utils/swissPairing.js
const { pool, createMatch } = require('./database');

/**
 * Thuật toán ghép cặp hệ Thụy Sĩ (Swiss System)
 */
async function generateNextRoundPairings(nextRound) {
    // 1. Lấy danh sách tuyển thủ còn thi đấu (chưa dropped)
    const playersRes = await pool.query(`
        SELECT discord_id, in_game_name, wins, losses, draws, (wins * 3 + draws) as points 
        FROM players 
        WHERE is_dropped = 0 OR is_dropped IS NULL
        ORDER BY points DESC, wins DESC, RANDOM()
    `);
    const players = playersRes.rows;

    // 2. Thu thập lịch sử các cặp trận đã từng gặp nhau
    const pastMatchesRes = await pool.query(`SELECT player1_id, player2_id FROM matches`);
    const playedPairs = new Set();
    
    for (const match of pastMatchesRes.rows) {
        playedPairs.add(`${match.player1_id}_${match.player2_id}`);
        playedPairs.add(`${match.player2_id}_${match.player1_id}`);
    }

    const pairings = [];
    const unassigned = [...players];

    while (unassigned.length > 1) {
        const p1 = unassigned.shift();
        let opponentIndex = -1;

        // Tìm người chơi gần điểm nhất mà p1 CHƯA TỪNG ĐỐI ĐẦU
        for (let i = 0; i < unassigned.length; i++) {
            const candidate = unassigned[i];
            const pairKey = `${p1.discord_id}_${candidate.discord_id}`;

            if (!playedPairs.has(pairKey)) {
                opponentIndex = i;
                break;
            }
        }

        // Nếu tất cả các đối thủ còn lại đều đã gặp, đành chọn đối thủ gần điểm nhất
        if (opponentIndex === -1) {
            opponentIndex = 0;
        }

        const p2 = unassigned.splice(opponentIndex, 1)[0];

        // Tạo trận đấu mới trong DB bằng hàm createMatch bất đồng bộ
        const matchId = await createMatch(nextRound, p1.discord_id, p2.discord_id);

        pairings.push({
            match_id: matchId,
            round: nextRound,
            player1_id: p1.discord_id,
            player2_id: p2.discord_id
        });
    }

    // Nếu tổng số người chơi là số lẻ (Nhận 1 Bye)
    if (unassigned.length === 1) {
        const byePlayer = unassigned[0];
        await pool.query(`UPDATE players SET wins = wins + 1 WHERE discord_id = $1`, [byePlayer.discord_id]);
        console.log(`[SWISS] Player <@${byePlayer.discord_id}> được miễn đấu Round ${nextRound} (+1 Win).`);
    }

    return pairings;
}

module.exports = { generateNextRoundPairings };