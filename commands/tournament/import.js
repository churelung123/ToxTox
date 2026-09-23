const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { pool } = require('../../utils/database');
const { readTournamentDataFromExcel } = require('../../utils/excelHelper');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('import_data')
        .setDescription('Import danh sách tuyển thủ & cặp đấu từ file Excel')
        .addAttachmentOption(option =>
            option.setName('file')
                .setDescription('File Excel (.xlsx) chứa dữ liệu giải đấu')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();

        const attachment = interaction.options.getAttachment('file');

        if (!attachment) {
            return interaction.editReply(
                '❌ Không tìm thấy file Excel được tải lên!'
            );
        }

        const attachmentName =
            attachment.name ||
            attachment.filename ||
            '';

        if (!attachmentName.toLowerCase().endsWith('.xlsx')) {
            return interaction.editReply(
                '❌ Vui lòng tải lên file định dạng Excel (.xlsx)!'
            );
        }

        if (!attachment.url) {
            return interaction.editReply(
                '❌ Không tìm thấy URL của file Excel!'
            );
        }

        const client = await pool.connect();

        try {
            // Tải file Excel trực tiếp vào RAM
            // Không ghi file vào /var/task vì Vercel Serverless là read-only
            const response = await fetch(attachment.url);

            if (!response.ok) {
                throw new Error(
                    `Không thể tải file Excel từ Discord: HTTP ${response.status}`
                );
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Đọc trực tiếp từ Buffer
            const { players, pairings } =
                readTournamentDataFromExcel(buffer);

            let insertedPlayers = 0;
            let insertedMatches = 0;

            await client.query('BEGIN');

            // 1. Insert Players
            if (players && players.length > 0) {
                const queryPlayer = `
                    INSERT INTO players (
                        discord_id,
                        in_game_name,
                        team_sheet_url
                    )
                    VALUES ($1, $2, $3)
                    ON CONFLICT(discord_id) DO UPDATE SET
                        in_game_name = EXCLUDED.in_game_name,
                        team_sheet_url = COALESCE(
                            EXCLUDED.team_sheet_url,
                            players.team_sheet_url
                        )
                `;

                for (const row of players) {
                    if (row.discord_id && row.in_game_name) {
                        await client.query(queryPlayer, [
                            String(row.discord_id),
                            String(row.in_game_name),
                            row.team_sheet_url || null
                        ]);

                        insertedPlayers++;
                    }
                }
            }

            // 2. Insert Pairings
            if (pairings && pairings.length > 0) {
                const queryMatch = `
                    INSERT INTO matches (
                        round_number,
                        player1_id,
                        player2_id,
                        status
                    )
                    VALUES ($1, $2, $3, 'pending')
                `;

                for (const row of pairings) {
                    if (
                        row.round_number &&
                        row.player1_id &&
                        row.player2_id
                    ) {
                        await client.query(queryMatch, [
                            Number(row.round_number),
                            String(row.player1_id),
                            String(row.player2_id)
                        ]);

                        insertedMatches++;
                    }
                }
            }

            await client.query('COMMIT');

            await interaction.editReply(
                `✅ **Nạp dữ liệu thành công!**\n` +
                `- Tuyển thủ đã nạp: **${insertedPlayers}**\n` +
                `- Trận đấu đã nạp: **${insertedMatches}**`
            );

        } catch (error) {
            await client.query('ROLLBACK');

            console.error('[IMPORT ERROR]', error);

            await interaction.editReply(
                '❌ Đã xảy ra lỗi trong quá trình xử lý file Excel!'
            );
        } finally {
            client.release();
        }
    }
};