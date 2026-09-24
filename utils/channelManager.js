// File: utils/channelManager.js

const {
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const { pool, getPlayer } = require('./database');

// ============================================================
// ROLE STAFF / TRỌNG TÀI
// ============================================================

const ALLOWED_ROLE_IDS = [
    '1552017048987631687'
];

// ============================================================
// SLUGIFY
// ============================================================

function slugify(str) {

    if (!str) {
        return 'player';
    }

    return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

// ============================================================
// PERMISSION
// ============================================================

function buildBasePermissions(guild) {

    if (!guild) {
        throw new Error(
            'buildBasePermissions: guild không tồn tại'
        );
    }

    if (!guild.roles?.cache) {
        throw new Error(
            'buildBasePermissions: guild.roles.cache không tồn tại'
        );
    }

    const permissionOverwrites = [

        {
            id: guild.roles.everyone.id,

            deny: [
                PermissionFlagsBits.ViewChannel
            ]
        }

    ];

    // --------------------------------------------------------
    // STAFF / TRỌNG TÀI
    // --------------------------------------------------------

    for (const roleId of ALLOWED_ROLE_IDS) {
        console.log(`[PERM DEBUG] Checking roleId: ${roleId}`);
        console.log(`[PERM DEBUG] cache.has? ${guild.roles.cache.has(roleId)}`);
        console.log(`[PERM DEBUG] role object:`, guild.roles.cache.get(roleId)?.name);

        if (roleId && guild.roles.cache.has(roleId)) {
            permissionOverwrites.push({
                id: roleId,
                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.AttachFiles,
                    PermissionFlagsBits.ManageMessages
                ]
            });
            console.log(`[PERM DEBUG] ✅ Added overwrite for role ${roleId}`);
        } else {
            console.warn(`[PERM DEBUG] ❌ Role ${roleId} NOT found in cache → bỏ qua`);
        }
    }

    // --------------------------------------------------------
    // ADMIN
    // --------------------------------------------------------

    guild.roles.cache.forEach(role => {

        if (
            role.permissions?.has(
                PermissionFlagsBits.Administrator
            )
        ) {

            permissionOverwrites.push({

                id: role.id,

                allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                    PermissionFlagsBits.ManageMessages
                ]
            });
        }
    });

    return permissionOverwrites;
}

// ============================================================
// GET / CREATE ROUND CATEGORY
// ============================================================

async function getOrCreateRoundCategory(
    guild,
    roundNumber
) {

    if (!guild) {
        throw new Error(
            'Không có Discord Guild. Vui lòng kiểm tra DISCORD_TOKEN và guild_id.'
        );
    }

    if (!guild.channels) {
        throw new Error(
            'Discord Guild chưa có ChannelManager.'
        );
    }

    if (!guild.channels.cache) {
        await guild.channels.fetch();
    }

    const categoryName =
        `── ROUND ${roundNumber} ──`;

    let category =
        guild.channels.cache.find(
            c =>
                c.type === ChannelType.GuildCategory &&
                c.name === categoryName
        );

    // --------------------------------------------------------
    // CATEGORY CHƯA TỒN TẠI
    // --------------------------------------------------------

    if (!category) {

        category =
            await guild.channels.create({

                name: categoryName,

                type: ChannelType.GuildCategory,

                permissionOverwrites:
                    buildBasePermissions(guild)
            });
    }

    return category;
}

// ============================================================
// CREATE MATCH CHANNELS
// ============================================================

async function createMatchChannels(
    guild,
    matches,
    roundNumber
) {

    if (!guild) {
        throw new Error(
            'createMatchChannels: guild không tồn tại'
        );
    }

    if (
        !Array.isArray(matches) ||
        matches.length === 0
    ) {
        return;
    }

    const category =
        await getOrCreateRoundCategory(
            guild,
            roundNumber
        );

    // --------------------------------------------------------
    // TẠO TỪNG BÀN ĐẤU
    // --------------------------------------------------------

    for (const match of matches) {

        const p1Id =
            match.player1_id
                ? String(match.player1_id).trim()
                : null;

        const p2Id =
            match.player2_id
                ? String(match.player2_id).trim()
                : null;

        const p1 =
            p1Id
                ? await getPlayer(p1Id)
                : null;

        const p2 =
            p2Id
                ? await getPlayer(p2Id)
                : null;

        const nameP1 =
            slugify(
                p1
                    ? p1.in_game_name
                    : 'Player1'
            );

        const nameP2 =
            slugify(
                p2
                    ? p2.in_game_name
                    : 'Player2'
            );

        const channelName =
            `ban-${match.match_id}-${nameP1}-vs-${nameP2}`;

        try {

            // ------------------------------------------------
            // CREATE CHANNEL
            // ------------------------------------------------

            const channel =
                await guild.channels.create({

                    name: channelName,

                    type: ChannelType.GuildText,

                    parent: category.id,

                    permissionOverwrites:
                        buildBasePermissions(guild)
                });

            // ------------------------------------------------
            // FETCH MEMBERS
            // ------------------------------------------------

            let member1 = null;
            let member2 = null;

            if (p1Id) {

                member1 =
                    await guild.members
                        .fetch(p1Id)
                        .catch(() => null);

                if (member1) {

                    await channel
                        .permissionOverwrites
                        .edit(member1.id, {

                            ViewChannel: true,
                            SendMessages: true,
                            AttachFiles: true,
                            ReadMessageHistory: true

                        });
                }
            }

            if (p2Id) {

                member2 =
                    await guild.members
                        .fetch(p2Id)
                        .catch(() => null);

                if (member2) {

                    await channel
                        .permissionOverwrites
                        .edit(member2.id, {

                            ViewChannel: true,
                            SendMessages: true,
                            AttachFiles: true,
                            ReadMessageHistory: true

                        });
                }
            }

            // ------------------------------------------------
            // SAVE CHANNEL ID
            // ------------------------------------------------

            await pool.query(
                `
                UPDATE matches
                SET channel_id = $1
                WHERE match_id = $2
                `,
                [
                    channel.id,
                    match.match_id
                ]
            );

            // ------------------------------------------------
            // MENTIONS
            // ------------------------------------------------

            const p1Mention =
                member1
                    ? `<@${member1.id}>`
                    : (
                        p1Id
                            ? `<@${p1Id}>`
                            : 'Player 1'
                    );

            const p2Mention =
                member2
                    ? `<@${member2.id}>`
                    : (
                        p2Id
                            ? `<@${p2Id}>`
                            : 'Player 2'
                    );

            // ------------------------------------------------
            // MATCH EMBED
            // ------------------------------------------------

            const embedMatch =
                new EmbedBuilder()
                    .setTitle(
                        '⚔️ Trận xếp hạng đã bắt đầu'
                    )
                    .setDescription(

                        `Hai người tự tổ chức trận đấu. ` +
                        `Dùng lệnh \`/gui-anh\` đính kèm ảnh kết quả ` +
                        `để mở khóa các nút báo kết quả bên dưới.\n\n` +

                        `🆔 **Match ID (Ấn giữ / Chạm để copy)**\n` +

                        `\`\`\`\n` +
                        `${match.match_id}` +
                        `\n\`\`\``
                    )
                    .setColor(0xE67E22);

            // ------------------------------------------------
            // BUTTONS
            // ------------------------------------------------

            const row =
                new ActionRowBuilder()
                    .addComponents(

                        new ButtonBuilder()
                            .setCustomId(
                                `win_p1_${match.match_id}`
                            )
                            .setLabel(
                                `🏆 ${p1 ? p1.in_game_name : 'Player 1'} thắng`
                            )
                            .setStyle(
                                ButtonStyle.Primary
                            )
                            .setDisabled(true),

                        new ButtonBuilder()
                            .setCustomId(
                                `win_p2_${match.match_id}`
                            )
                            .setLabel(
                                `🏆 ${p2 ? p2.in_game_name : 'Player 2'} thắng`
                            )
                            .setStyle(
                                ButtonStyle.Primary
                            )
                            .setDisabled(true),

                        new ButtonBuilder()
                            .setCustomId(
                                `draw_${match.match_id}`
                            )
                            .setLabel('🤝 Hòa')
                            .setStyle(
                                ButtonStyle.Secondary
                            )
                            .setDisabled(true),

                        new ButtonBuilder()
                            .setCustomId(
                                `call_mod_${match.match_id}`
                            )
                            .setLabel('⚠️ Gọi Mod')
                            .setStyle(
                                ButtonStyle.Danger
                            )
                            .setDisabled(true)

                    );

            // ------------------------------------------------
            // SEND FIRST MESSAGE
            // ------------------------------------------------

            await channel.send({

                content:
                    `${p1Mention} ${p2Mention} — ` +
                    `private match channel của hai bạn đã sẵn sàng.`,

                embeds: [
                    embedMatch
                ],

                components: [
                    row
                ]
            });

            // ------------------------------------------------
            // TEAM SHEET PLAYER 1
            // ------------------------------------------------

            if (
                p1 &&
                p1.team_sheet_url
            ) {

                const embedSheet1 =
                    new EmbedBuilder()
                        .setTitle(
                            `📋 Team Sheet: ${p1.in_game_name}`
                        )
                        .setImage(
                            p1.team_sheet_url
                        )
                        .setColor(
                            0x3498DB
                        );

                await channel.send({
                    embeds: [
                        embedSheet1
                    ]
                });
            }

            // ------------------------------------------------
            // TEAM SHEET PLAYER 2
            // ------------------------------------------------

            if (
                p2 &&
                p2.team_sheet_url
            ) {

                const embedSheet2 =
                    new EmbedBuilder()
                        .setTitle(
                            `📋 Team Sheet: ${p2.in_game_name}`
                        )
                        .setImage(
                            p2.team_sheet_url
                        )
                        .setColor(
                            0xE74C3C
                        );

                await channel.send({
                    embeds: [
                        embedSheet2
                    ]
                });
            }

            // ------------------------------------------------
            // DELAY NHẸ
            // ------------------------------------------------

            await new Promise(
                resolve =>
                    setTimeout(resolve, 1000)
            );

        } catch (error) {

            console.error(
                `[CHANNEL CREATION ERROR] Match ${match.match_id}:`,
                error
            );
        }
    }
}

// ============================================================
// DELETE ALL MATCH CHANNELS
// ============================================================

async function deleteAllMatchChannels(guild) {

    try {

        if (!guild) {
            throw new Error(
                'deleteAllMatchChannels: guild không tồn tại'
            );
        }

        const channels =
            await guild.channels.fetch();

        let deletedCount = 0;

        // ----------------------------------------------------
        // DELETE CHANNEL
        // ----------------------------------------------------

        for (
            const [id, channel]
            of channels
        ) {

            if (!channel) {
                continue;
            }

            const isMatchChannel =
                channel.name.startsWith('ban-') ||
                channel.name.startsWith('match-') ||
                channel.name.startsWith('table-');

            const parentName =
                channel.parent
                    ? channel.parent.name.toUpperCase()
                    : '';

            const isInRoundCategory =
                parentName.includes('ROUND') ||
                parentName.includes('VÒNG');

            if (
                (
                    isMatchChannel ||
                    isInRoundCategory
                ) &&
                channel.type !==
                    ChannelType.GuildCategory
            ) {

                await channel
                    .delete()
                    .catch(err =>
                        console.error(
                            `[DELETE ERROR] ${channel.name}:`,
                            err.message
                        )
                    );

                deletedCount++;
            }
        }

        // ----------------------------------------------------
        // DELETE CATEGORY
        // ----------------------------------------------------

        for (
            const [id, channel]
            of channels
        ) {

            if (!channel) {
                continue;
            }

            if (
                channel.type ===
                ChannelType.GuildCategory
            ) {

                const categoryName =
                    channel.name.toUpperCase();

                if (
                    categoryName.includes('ROUND') ||
                    categoryName.includes('VÒNG')
                ) {

                    await channel
                        .delete()
                        .catch(err =>
                            console.error(
                                `[DELETE CATEGORY ERROR] ${channel.name}:`,
                                err.message
                            )
                        );
                }
            }
        }

        return deletedCount;

    } catch (error) {

        console.error(
            '[CHANNEL MANAGER ERROR] Lỗi xóa hàng loạt kênh:',
            error
        );

        throw error;
    }
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {
    createMatchChannels,
    deleteAllMatchChannels
};