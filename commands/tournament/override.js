// File: commands/tournament/override.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { pool } = require('../../utils/database');
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

        const matchRes = await pool.query('SELECT * FROM matches WHERE match_id = $1', [matchId]);
        const match = matchRes.rows[0];

        if (!match) return interaction.reply({ content: '❌ Không tìm thấy Match ID này!', ephemeral: true });

        // Cập nhật CSDL
        await pool.query(`
            UPDATE matches 
            SET winner_id = $1, player1_score = $2, player2_score = $3, status = 'completed' 
            WHERE match_id = $4
        `, [winner.id, scoreP1, scoreP2, matchId]);

        // Xuất lại BXH Excel
        const allPlayersRes = await pool.query(
            'SELECT discord_id, in_game_name, wins, losses, as points FROM players ORDER BY points DESC, wins DESC'
        );
        if (typeof exportStandingsToExcel === 'function') {
            await exportStandingsToExcel(allPlayersRes.rows);
        }

        await interaction.reply(`✅ Trọng tài đã cập nhật kết quả Bàn ${matchId}: <@${winner.id}> thắng với tỷ số ${scoreP1} - ${scoreP2}.`);
    }
};