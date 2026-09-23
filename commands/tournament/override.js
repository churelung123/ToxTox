const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../utils/database'); // File database.js của bạn
const { exportStandingsToExcel } = require('../../utils/excelHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('override_match')
        .setDescription('[Dành cho Trọng tài] Sửa kết quả trận đấu thủ công')
        .addIntegerOption(opt => opt.setName('match_id').setDescription('ID của trận đấu').setRequired(true))
        .addUserOption(opt => opt.setName('winner').setDescription('Người thắng').setRequired(true))
        .addIntegerOption(opt => opt.setName('score_p1').setDescription('Điểm Player 1').setRequired(true))
        .addIntegerOption(opt => opt.setName('score_p2').setDescription('Điểm Player 2').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const matchId = interaction.options.getInteger('match_id');
        const winner = interaction.options.getUser('winner');
        const scoreP1 = interaction.options.getInteger('score_p1');
        const scoreP2 = interaction.options.getInteger('score_p2');

        const match = db.prepare('SELECT * FROM matches WHERE match_id = ?').get(matchId);
        if (!match) return interaction.reply({ content: '❌ Không tìm thấy Match ID này!', ephemeral: true });

        // Cập nhật CSDL
        db.prepare(`
            UPDATE matches 
            SET winner_id = ?, player1_score = ?, player2_score = ?, status = 'completed' 
            WHERE match_id = ?
        `).run(winner.id, scoreP1, scoreP2, matchId);

        // Xuất lại BXH Excel
        const allPlayers = db.prepare('SELECT discord_id, in_game_name, wins, losses, draws, (wins * 3 + draws) as points FROM players ORDER BY points DESC, wins DESC').all();
        exportStandingsToExcel(allPlayers);

        await interaction.reply(`✅ Trọng tài đã cập nhật kết quả Bàn ${matchId}: <@${winner.id}> thắng với tỷ số ${scoreP1} - ${scoreP2}.`);
    }
};