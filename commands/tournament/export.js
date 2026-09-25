// File: commands/tournament/export.js
const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { pool } = require('../../utils/database');
const { exportStandingsToExcel } = require('../../utils/excelHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('export_standings')
        .setDescription('Xuất bảng xếp hạng vòng Thụy Sĩ ra file Excel'),

    async execute(interaction) {
        console.log('[EXPORT] START');

        await interaction.deferReply();

        try {
            console.log('[EXPORT] Query database...');

            const res = await pool.query(`
            SELECT 
                in_game_name AS "Người chơi",
                discord_id AS "Discord ID",
                wins AS "Thắng",
                losses AS "Thua"
            FROM players 
            ORDER BY wins DESC, losses ASC
        `);

            console.log('[EXPORT] DB rows:', res.rows.length);

            const players = res.rows;

            if (players.length === 0) {
                console.log('[EXPORT] No players');

                return interaction.editReply(
                    '❌ Hiện chưa có dữ liệu tuyển thủ trong hệ thống!'
                );
            }

            console.log('[EXPORT] Creating Excel...');

            const buffer = await exportStandingsToExcel(players);

            console.log('[EXPORT] Buffer:', {
                exists: !!buffer,
                isBuffer: Buffer.isBuffer(buffer),
                size: buffer?.length
            });

            if (!buffer || !Buffer.isBuffer(buffer)) {
                throw new Error('Excel export không trả về Buffer');
            }

            const file = new AttachmentBuilder(buffer, {
                name: 'standings.xlsx'
            });

            console.log('[EXPORT] Sending Discord attachment...');

            await interaction.editReply({
                content: '📊 Bảng xếp hạng mới nhất của giải đấu:',
                files: [file]
            });

            console.log('[EXPORT] SUCCESS');

        } catch (error) {
            console.error('[EXPORT ERROR]', error);

            await interaction.editReply(
                '❌ Có lỗi xảy ra khi xuất file Excel Bảng xếp hạng!'
            );
        }
    },
};