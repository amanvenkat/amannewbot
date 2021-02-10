/** packages */
const fs = require('fs');
const mong = require('mongoose');
/** config n util n models */
//const config = require('./src/data/config.json');
const util = require('./src/data/util.js');
/** database */
mong.connect(`mongodb://${process.env.MONGODB_USER}:${process.env.MONGODB_PWD}@localhost:27017/Admin`, {
    useFindAndModify: false,
    useNewUrlParser: true,
    useUnifiedTopology: true
    .then( (_) => 
        console.log('connected db')),
      })
      .catch( (err) => {
        throw err
      })
/** actual bot login things etc */
const discord = require('discord.js-light');
const memer = new discord.Client({
    cacheGuilds: true,
    cacheChannels: true,
    cacheEmojis: true,
    fetchAllMembers: true,
    messageSweepInterval: 10,
    messageCacheLifetime: 10,
    messageCacheMaxSize: 0,
    disableMentions: 'everyone',
    ws: {
        intents: ['GUILDS', 'GUILD_MESSAGES', 'GUILD_MEMBERS', 'GUILD_EMOJIS']
    },
    presence: {
        activity: {
            name: 'Use "do" | Eating Flaming Hot Cheetos!'
        }
    },
    disabledEvents: [
        'GUILD_INTEGRATIONS_UPDATE',
        'GUILD_ROLE_CREATE',
        'GUILD_ROLE_DELETE',
        'GUILD_ROLE_UPDATE',
        'GUILD_EMOJIS_UPDATE',
        'CHANNEL_DELETE',
        'CHANNEL_PINS_UPDATE',
        'MESSAGE_DELETE',
        'MESSAGE_UPDATE',
        'MESSAGE_DELETE_BULK',
        'MESSAGE_BULK_DELETE',
        'MESSAGE_REACTION_REMOVE_ALL',
        'TYPING_START',
        'TYPING_STOP',
        'VOICE_BROADCAST_SUBSCRIBE',
        'VOICE_BROADCAST_UNSUBSCRIBE',
        'VOICE_SERVER_UPDATE'
    ]
});
memer.login(process.env.TOKEN);
/** commands */
memer.commands = new discord.Collection();
/** load cmds */
const commandsInDir = fs.readdirSync('./src/commands').filter(file => file.endsWith('.js'));
for (const file of commandsInDir) {
    const command = require(`./src/commands/${file}`);
    memer.commands.set(command.name, command);
}
/** bot events */
memer.once('ready', () => {
    console.log('Medu Wada is ready');
    /** clear old command cooldowns */
    setInterval(async () => {
        await util.delCDs();
    }, 1000);
});
memer.on('message', async message => {
    if (message.author.bot || message.channel.type !== 'text') return;

    let prefix;
    for (let p of config.prefixes) {
        if (p.includes('botid')) p = p.replace('botid', memer.user.id);
        if (message.content.toLowerCase().startsWith(p)) {
            prefix = p;
            break;
        }
    }
    if (prefix === undefined) return;

    /** check db */
    await util.getDBUser(message.author.id);
    /** add pls */
    await util.updateDBUser(message.author.id, {
        pls: 1
    });

    const args = message.content.slice(prefix.length).trim().split(/ +/g);
    const cmdName = args.shift().toLowerCase();

    const cmd = memer.commands.get(cmdName) || memer.commands.find(cmd => cmd.aliases && cmd.aliases.includes(cmdName));
    if (!cmd) return;

    const hasCooldown = await util.hasCD(message.author.id, cmd.name);
    if (hasCooldown) {
        const cooldown = await util.getCD(message.author.id, cmd.name);
        let timeLeft = (cooldown.cooldown - Date.now()) / 1000;
        if (timeLeft < 1) timeLeft = 1;
        const e = new discord.MessageEmbed()
            .setTitle('Slow it down, cmon')
            .setDescription(`${(cooldown.message==='')?'Try again in':cooldown.message} ${(timeLeft > 60 ? `**${util.parseTime(timeLeft)}**` : `**${timeLeft.toFixed()} seconds**`)}\n\n` +
                `__Default Cooldown__: ${util.parseTime(cooldown.defaultCD/1000)}\n\n` +
                'While you wait, go check out our [Twitter](https://twitter.com/4manAU), [youtube](https://www.youtube.com/channel/UC5DqQh9__HKLd_HpDAXxsVw), and [Discord Server](https://discord.gg/Ch6WQWHeU6)')
            .setColor('#3f51b5');
        return message.channel.send(e).catch(() => {});
    } else {
        try {
            cmd.execute(memer, message, args);
        } catch (e) {
            console.log(e.stack);
        }
    }

});