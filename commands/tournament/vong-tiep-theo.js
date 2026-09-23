// File: commands/tournament/vong-tiep-theo.js
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { pool } = require('../../utils/database');
const { generateNextRoundPairings } = require('../../utils/swissPairing');
const { createMatchChannels } = require('../../utils/channelManager');
const { exportMatchesByRoundToExcel, exportStandingsToExcel } = require('../../utils/excelHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('vong-tiep-theo')
        .setDescription('Tự động ghép cặp Swiss và tạo kênh đấu cho Vòng tiếp theo')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();

        // 1. Kiểm tra xem các trận ở vòng hiện tại đã xong chưa
        const pendingRes = await pool.query(`SELECT COUNT(*) as count FROM matches WHERE status != 'completed'`);
        const pendingCount = parseInt(pendingRes.rows[0].count, 10);

        if (pendingCount > 0) {
            return interaction.editReply({
                content: `⚠️ Vẫn còn **${pendingCount}** trận đấu chưa hoàn thành ở vòng hiện tại!`,
                flags: MessageFlags.Ephemeral
            });
        }

        // 2. Xác định số Round tiếp theo
        const currentRoundRes = await pool.query(`SELECT MAX(round_number) as "maxRound" FROM matches`);
        const maxRound = currentRoundRes.rows[0].maxRound;
        const nextRound = (maxRound ? parseInt(maxRound, 10) : 0) + 1;

        // 3. Thực hiện ghép cặp Swiss
        const newMatches = await generateNextRoundPairings(nextRound);

        if (!newMatches || newMatches.length === 0) {
            return interaction.editReply('❌ Không thể khởi tạo vòng mới (không đủ người chơi).');
        }

        // 4. Tạo kênh ẩn cho các cặp trận
        if (typeof createMatchChannels === 'function') {
            await createMatchChannels(interaction.guild, newMatches, nextRound);
        }

        // 5. Cập nhật và tự động xuất các file Excel
        if (typeof exportMatchesByRoundToExcel === 'function') {
            await exportMatchesByRoundToExcel();
        }
        
        const allPlayersRes = await pool.query(
            'SELECT discord_id, in_game_name, wins, losses, draws, (wins * 3 + draws) as points FROM players ORDER BY points DESC, wins DESC'
        );
        if (typeof exportStandingsToExcel === 'function') {
            await exportStandingsToExcel(allPlayersRes.rows);
        }

        await interaction.editReply(`✅ **Đã ghép cặp và khởi tạo Round ${nextRound} thành công!** Các kênh thi đấu riêng đã sẵn sàng.`);
    }
};