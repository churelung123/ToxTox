const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`-------------------------------------------`);
        console.log(`🤖 Bot VGC [${client.user.tag}] đã sẵn sàng!`);
        console.log(`-------------------------------------------`);
    },
};