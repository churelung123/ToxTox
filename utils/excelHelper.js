// File: commands/tournament/startround.js

const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require('discord.js');

const {
    pool
} = require('../../utils/database');

const {
    createMatchChannels
} = require('../../utils/channelManager');

module.exports = {

    data: new SlashCommandBuilder()

        .setName('startround')

        .setDescription(
            'Bắt đầu Round đấu: Tự động tạo kênh chat ẩn hàng loạt'
        )

        .addIntegerOption(opt =>
            opt
                .setName('round')
                .setDescription(
                    'Số Round đấu (VD: 1, 2, 3)'
                )
                .setRequired(true)
        )

        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(interaction) {

        await interaction.deferReply();

        try {

            const roundNumber =
                interaction.options.getInteger(
                    'round'
                );

            // ------------------------------------------------
            // LẤY CÁC TRẬN PENDING
            // ------------------------------------------------

            const result =
                await pool.query(
                    `
                    SELECT *
                    FROM matches
                    WHERE round_number = $1
                    AND status = $2
                    `,
                    [
                        roundNumber,
                        'pending'
                    ]
                );

            const matches =
                result.rows;

            // ------------------------------------------------
            // KHÔNG CÓ TRẬN
            // ------------------------------------------------

            if (
                !matches ||
                matches.length === 0
            ) {

                return await interaction.editReply(
                    `❌ Không tìm thấy trận đấu nào đang chờ (pending) ở Round ${roundNumber}!`
                );
            }

            // ------------------------------------------------
            // THÔNG BÁO
            // ------------------------------------------------

            await interaction.editReply(
                `🚀 Đang khởi tạo ${matches.length} kênh chat ẩn cho Round ${roundNumber}...`
            );

            // ------------------------------------------------
            // TẠO CHANNEL
            //
            // Trên Vercel, api/index.js sẽ cung cấp
            // interaction.guild là Guild Discord.js thật.
            // ------------------------------------------------

            await createMatchChannels(
                interaction.guild,
                matches,
                roundNumber
            );

            // ------------------------------------------------
            // HOÀN TẤT
            // ------------------------------------------------

            await interaction.editReply(
                `✅ **Hoàn tất!** Đã tạo xong tất cả các bàn thi đấu cho Round ${roundNumber}.`
            );

        } catch (error) {

            console.error(
                '[STARTROUND ERROR]:',
                error
            );

            await interaction.editReply(
                `❌ Lỗi khi thực thi lệnh: \`${error.message}\``
            );
        }
    }
};