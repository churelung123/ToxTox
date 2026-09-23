// File: commands/tournament/import.js
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { db } = require('../../utils/database'); // File database.js của bạn
const { readTournamentDataFromExcel } = require('../../utils/excelHelper');
const fs = require('node:fs');
const path = require('node:path');

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

        if (!attachment.name.endsWith('.xlsx')) {
            return interaction.editReply('❌ Vui lòng tải lên file định dạng Excel (.xlsx)!');
        }

        try {
            // Tải file tạm về máy
            const response = await fetch(attachment.url);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            
            const tempPath = path.join(__dirname, '../../temp_import.xlsx');
            fs.writeFileSync(tempPath, buffer);

            // Đọc dữ liệu từ file Excel
            const { players, pairings } = readTournamentDataFromExcel(tempPath);

            // Xóa file tạm
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

            let insertedPlayers = 0;
            let insertedMatches = 0;

            // 1. Insert Players vào DB
            if (players.length > 0) {
                const insertPlayerStmt = db.prepare(`
                    INSERT INTO players (discord_id, in_game_name, team_sheet_url)
                    VALUES (?, ?, ?)
                    ON CONFLICT(discord_id) DO UPDATE SET
                        in_game_name = excluded.in_game_name,
                        team_sheet_url = COALESCE(excluded.team_sheet_url, players.team_sheet_url)
                `);

                const playerTx = db.transaction((rows) => {
                    for (const row of rows) {
                        if (row.discord_id && row.in_game_name) {
                            insertPlayerStmt.run(String(row.discord_id), String(row.in_game_name), row.team_sheet_url || null);
                            insertedPlayers++;
                        }
                    }
                });
                playerTx(players);
            }

            // 2. Insert Pairings (Matches) vào DB (nếu có)
            if (pairings.length > 0) {
                const insertMatchStmt = db.prepare(`
                    INSERT INTO matches (round_number, player1_id, player2_id, status)
                    VALUES (?, ?, ?, 'pending')
                `);

                const matchTx = db.transaction((rows) => {
                    for (const row of rows) {
                        if (row.round_number && row.player1_id && row.player2_id) {
                            insertMatchStmt.run(Number(row.round_number), String(row.player1_id), String(row.player2_id));
                            insertedMatches++;
                        }
                    }
                });
                matchTx(pairings);
            }

            await interaction.editReply(
                `✅ **Nạp dữ liệu thành công!**\n` +
                `- Tuyển thủ đã nạp: **${insertedPlayers}**\n` +
                `- Trận đấu đã nạp: **${insertedMatches}**`
            );

        } catch (error) {
            console.error('[IMPORT ERROR]', error);
            await interaction.editReply('❌ Đã xảy ra lỗi trong quá trình xử lý file Excel!');
        }
    }
};