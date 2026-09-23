// File: commands/tournament/vong-tiep-theo.js
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { db } = require('../../utils/database');
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
        const pendingMatches = db.prepare(`SELECT COUNT(*) as count FROM matches WHERE status != 'completed'`).get();
        if (pendingMatches.count > 0) {
            return interaction.editReply({
                content: `⚠️ Vẫn còn **${pendingMatches.count}** trận đấu chưa hoàn thành ở vòng hiện tại!`,
                flags: MessageFlags.Ephemeral
            });
        }

        // 2. Xác định số Round tiếp theo (sử dụng cột round_number theo đúng database.js)
        const currentRoundData = db.prepare(`SELECT MAX(round_number) as maxRound FROM matches`).get();
        const nextRound = (currentRoundData.maxRound || 0) + 1;

        // 3. Thực hiện ghép cặp Swiss
        const newMatches = generateNextRoundPairings(nextRound);

        if (newMatches.length === 0) {
            return interaction.editReply('❌ Không thể khởi tạo vòng mới (không đủ người chơi).');
        }

        // 4. Tạo kênh ẩn cho các cặp trận
        if (typeof createMatchChannels === 'function') {
            await createMatchChannels(interaction.guild, newMatches, nextRound);
        }

        // 5. Cập nhật và tự động xuất các file Excel
        if (typeof exportMatchesByRoundToExcel === 'function') {
            exportMatchesByRoundToExcel();
        }
        
        const allPlayers = db.prepare('SELECT discord_id, in_game_name, wins, losses, draws, (wins * 3 + draws) as points FROM players ORDER BY points DESC, wins DESC').all();
        if (typeof exportStandingsToExcel === 'function') {
            exportStandingsToExcel(allPlayers);
        }

        await interaction.editReply(`✅ **Đã ghép cặp và khởi tạo Round ${nextRound} thành công!** Các kênh thi đấu riêng đã sẵn sàng.`);
    }
};