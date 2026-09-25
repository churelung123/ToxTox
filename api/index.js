// File: api/index.js

const { verifyKey } = require('discord-interactions');
const { Client, GatewayIntentBits } = require('discord.js');

const { pool } = require('../utils/database');

// IMPORT MATCH HANDLER
const { handleMatchButton } = require('../events/matchHandler');

// ============================================================
// DISCORD CLIENT CHO SERVERLESS
// ============================================================

const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

let discordLoginPromise = null;

async function getDiscordClient() {
    if (discordClient.isReady()) {
        return discordClient;
    }

    if (!process.env.DISCORD_TOKEN) {
        throw new Error('Thiếu biến môi trường DISCORD_TOKEN');
    }

    if (!discordLoginPromise) {
        discordLoginPromise = discordClient
            .login(process.env.DISCORD_TOKEN)
            .catch(error => {
                discordLoginPromise = null;
                throw error;
            });
    }

    await discordLoginPromise;

    return discordClient;
}

async function getDiscordGuild(guildId) {
    if (!guildId) {
        throw new Error(
            'Không tìm thấy guild_id từ Discord interaction'
        );
    }

    const client = await getDiscordClient();

    const guild = await client.guilds.fetch(guildId);

    if (!guild) {
        throw new Error(
            `Bot không tìm thấy server ${guildId}`
        );
    }

    await guild.channels.fetch();
    await guild.roles.fetch();

    return guild;
}

// ============================================================
// IMPORT COMMANDS
// ============================================================

const commands = new Map();

const commandFiles = [
    require('../commands/tournament/setKetQua'),
    require('../commands/tournament/cleardata'),
    require('../commands/tournament/export'),
    require('../commands/tournament/gui-anh'),
    require('../commands/tournament/import'),
    require('../commands/tournament/override'),
    require('../commands/tournament/startround'),
    require('../commands/tournament/vong-tiep-theo'),
    require('../commands/tournament/xoa-kenh-dau'),
    require('../commands/tournament/sync'),
    require('../commands/tournament/team')
];

for (const cmd of commandFiles) {
    if (cmd && cmd.data && cmd.data.name) {
        commands.set(cmd.data.name, cmd);
    }
}

// ============================================================
// RAW BODY
// ============================================================

function getRawBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];

        req.on('data', chunk => {
            chunks.push(chunk);
        });

        req.on('end', () => {
            resolve(Buffer.concat(chunks));
        });

        req.on('error', err => {
            reject(err);
        });
    });
}

// ============================================================
// DISCORD INTERACTION WEBHOOK
// ============================================================

let vercelWaitUntil = null;

try {
    vercelWaitUntil = require('@vercel/functions').waitUntil;
} catch (error) {
    vercelWaitUntil = null;
}

async function editOriginalInteraction(
    interaction,
    payload
) {
    const applicationId =
        interaction.application_id;

    const interactionToken =
        interaction.token;

    if (!applicationId || !interactionToken) {
        throw new Error(
            'Thiếu application_id hoặc interaction token'
        );
    }

    const url =
        `https://discord.com/api/v10/webhooks/` +
        `${applicationId}/${interactionToken}/messages/@original`;

    if (!payload.files || payload.files.length === 0) {
        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText =
                await response.text();

            throw new Error(
                `Discord edit original response failed ` +
                `(${response.status}): ${errorText}`
            );
        }

        return;
    }

    const formData = new FormData();
    const attachments = [];

    payload.files.forEach((file, index) => {
        const buffer = file.attachment;
        const filename =
            file.name ||
            `file-${index}`;

        if (!buffer || !Buffer.isBuffer(buffer)) {
            throw new Error(
                `Attachment ${index} không hợp lệ`
            );
        }

        attachments.push({
            id: String(index),
            filename
        });

        const blob = new Blob(
            [buffer],
            {
                type:
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
        );

        formData.append(
            `files[${index}]`,
            blob,
            filename
        );
    });

    const payloadJson = {
        ...payload
    };

    delete payloadJson.files;
    payloadJson.attachments = attachments;

    formData.append(
        'payload_json',
        JSON.stringify(payloadJson)
    );

    const response = await fetch(url, {
        method: 'PATCH',
        body: formData
    });

    if (!response.ok) {
        const errorText =
            await response.text();

        throw new Error(
            `Discord edit original response failed ` +
            `(${response.status}): ${errorText}`
        );
    }
}

function normalizeCommandResponse(result) {
    if (typeof result === 'string') {
        return {
            content: result
        };
    }

    if (result && typeof result === 'object') {
        return result;
    }

    return {
        content: '✅ Lệnh đã được xử lý.'
    };
}

async function processSlashCommand(
    interaction,
    command
) {
    try {
        const result =
            command.executeServerless
                ? await command.executeServerless(
                    interaction
                )
                : await executeLegacyCommand(
                    command,
                    interaction
                );

        const payload =
            normalizeCommandResponse(
                result
            );

        await editOriginalInteraction(
            interaction,
            payload
        );
    } catch (error) {
        console.error(
            `[COMMAND ERROR] /${interaction.data?.name}:`,
            error
        );

        try {
            await editOriginalInteraction(
                interaction,
                {
                    content:
                        '❌ Đã xảy ra lỗi khi thực hiện lệnh.\n' +
                        'Vui lòng thử lại sau.'
                }
            );
        } catch (editError) {
            console.error(
                '[COMMAND ERROR] Không thể edit response:',
                editError
            );
        }
    }
}

// ============================================================
// MAIN SERVERLESS HANDLER
// ============================================================

module.exports = async (req, res) => {

    if (req.method !== 'POST') {
        return res
            .status(405)
            .send('Method Not Allowed');
    }

    const signature =
        req.headers['x-signature-ed25519'];

    const timestamp =
        req.headers['x-signature-timestamp'];

    const clientPublicKey =
        process.env.DISCORD_PUBLIC_KEY;

    if (
        !signature ||
        !timestamp ||
        !clientPublicKey
    ) {
        return res
            .status(401)
            .send(
                'Missing signature or public key'
            );
    }

    try {

        const rawBody =
            await getRawBody(req);

        const isValidRequest =
            await verifyKey(
                rawBody,
                signature,
                timestamp,
                clientPublicKey
            );

        if (!isValidRequest) {
            return res
                .status(401)
                .send(
                    'Bad request signature'
                );
        }

        const interaction =
            JSON.parse(
                rawBody.toString('utf-8')
            );

        // Discord PING
        if (interaction.type === 1) {
            return res
                .status(200)
                .json({
                    type: 1
                });
        }

        // SLASH COMMAND
        if (interaction.type === 2) {

            const { name } =
                interaction.data;

            const command =
                commands.get(name);

            if (!command) {
                return res
                    .status(200)
                    .json({
                        type: 4,
                        data: {
                            content:
                                `⚠️ Lệnh \`/${name}\` chưa được tích hợp.`
                        }
                    });
            }

            res.status(200).json({
                type: 5
            });

            const commandPromise =
                processSlashCommand(
                    interaction,
                    command
                );

            if (
                typeof vercelWaitUntil ===
                'function'
            ) {
                vercelWaitUntil(
                    commandPromise
                );
                return;
            }

            await commandPromise;
            return;
        }

        // BUTTON / MESSAGE COMPONENT (GỌI QUA MATCH HANDLER)
        if (interaction.type === 3) {
            const customId = interaction.data.custom_id;
            const userId =
                interaction.member?.user?.id ||
                interaction.user?.id;

            // Ủy quyền toàn bộ xử lý nút bấm sang matchHandler
            return await handleMatchButton(req, res, customId, userId, pool);
        }

        return res
            .status(200)
            .json({
                type: 4,
                data: {
                    content:
                        'Unsupported Interaction'
                }
            });

    } catch (err) {
        console.error(
            '[SERVERLESS ERROR]:',
            err
        );

        return res
            .status(500)
            .send(
                'Internal Server Error'
            );
    }
};

// ============================================================
// LEGACY COMMAND ADAPTER
// ============================================================

async function executeLegacyCommand(
    command,
    interaction
) {
    let guild = null;

    if (interaction.guild_id) {
        guild =
            await getDiscordGuild(
                interaction.guild_id
            );
    }

    const mockInteraction = {
        ...interaction,
        client: await getDiscordClient(),
        guild,
        guildId: interaction.guild_id,
        channel:
            guild
                ? guild.channels.cache.get(
                    interaction.channel_id
                ) || {
                    id: interaction.channel_id
                }
                : {
                    id: interaction.channel_id
                },
        user:
            interaction.member?.user ||
            interaction.user,
        member: interaction.member,
        deferred: false,
        replied: false,
        options: {
            getInteger: (name) => {
                const opt =
                    interaction
                        .data
                        .options
                        ?.find(
                            o => o.name === name
                        );
                return opt?.value;
            },
            getString: (name) => {
                const opt =
                    interaction
                        .data
                        .options
                        ?.find(
                            o => o.name === name
                        );
                return opt?.value;
            },
            getUser: (name) => {
                const opt =
                    interaction
                        .data
                        .options
                        ?.find(
                            o => o.name === name
                        );
                if (!opt) return null;
                return interaction
                    .data
                    .resolved
                    ?.users?.[opt.value] ||
                    null;
            },
            getAttachment: (name) => {
                const opt =
                    interaction
                        .data
                        .options
                        ?.find(
                            o => o.name === name
                        );
                if (!opt) return null;

                const attachmentsObj =
                    interaction
                        .data
                        .resolved
                        ?.attachments ||
                    {};

                const attachment =
                    attachmentsObj[opt.value] ||
                    Object.values(
                        attachmentsObj
                    )[0];

                if (!attachment) return null;

                return {
                    ...attachment,
                    name:
                        attachment.name ||
                        attachment.filename ||
                        '',
                    filename:
                        attachment.filename ||
                        attachment.name ||
                        ''
                };
            }
        },
        async deferReply() {
            this.deferred = true;
        },
        async reply(options) {
            responsePayload = options;
            this.replied = true;
        },
        async editReply(options) {
            responsePayload = options;
            this.replied = true;
        },
        async followUp(options) {
            responsePayload = options;
            this.replied = true;
        }
    };

    let responsePayload = null;
    await command.execute(
        mockInteraction
    );

    return responsePayload;
}

// ============================================================
// VERCEL CONFIG
// ============================================================

module.exports.config = {
    api: {
        bodyParser: false
    }
};