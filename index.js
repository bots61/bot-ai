const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    PermissionFlagsBits 
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message, Partials.GuildMember]
});

// الأيدي والآداب المطلوبة
const CONFIG = {
    verificationRoom: "1545846837192429578",
    verifiedRole: "1545848708921425920", // الرول الذي يوضع بعد التفعيل
    unverifiedRole: "1545848907156820100", // الرول التلقائي عند دخول السيرفر
    
    ticketSetupRoom: "1545847197768360000",
    ticketCategory1: "1545852986188628108", // الكاتيغوري الأول (أقصى حد 50 روم)
    ticketCategory2: "1545853004673196172", // الكاتيغوري الثاني لو امتلى الأول
    archiveCategory: "1545854950456696923", // كاتيغوري الأرشفة/الإغلاق المؤقت
    deleteCategory: "1545855025082011760", // كاتيغوري الحذف النهائي
    
    supportRole: "1545853407825231962", // رول السبورت (يشاهد التكتات ويتحدث)
    adminControlRole: "1545853891101466746" // رول التحكم الكامل وحذف التكتات النهائية
};

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// 1. منح الرول التلقائي عند دخول السيرفر
client.on('guildMemberAdd', async (member) => {
    try {
        if (CONFIG.unverifiedRole) {
            await member.roles.add(CONFIG.unverifiedRole);
        }
    } catch (err) {
        console.error("Error adding join role:", err);
    }
});

// إرسال رسالة التفعيل والتكتات عند بدء التشغيل أو تجهيز الأزرار
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // أمر إرسال رسالة التحقق والتفعيل (يمكن إرساله يدوياً أو برمجياً)
    if (message.content === "!setup_verify" && message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        const channel = message.guild.channels.cache.get(CONFIG.verificationRoom);
        if (channel) {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_btn')
                    .setLabel('تفعيل')
                    .setStyle(ButtonStyle.Secondary)
            );
            await channel.send({
                content: "تنويه حنا مجرد سيرفر للفضايح ولا نمس للابتزاز بآي صلة",
                components: [row]
            });
            await message.reply("تم إرسال رسالة التفعيل بنجاح!");
        }
    }

    // أمر إرسال زر فتح التكت
    if (message.content === "!setup_ticket" && message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        const channel = message.guild.channels.cache.get(CONFIG.ticketSetupRoom);
        if (channel) {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket_btn')
                    .setLabel('فك تكت')
                    .setStyle(ButtonStyle.Primary)
            );
            await channel.send({
                content: "اذا خاطرك بالمخفي بس ما معك بوست او عندك اي مشكله اضغط تحت",
                components: [row]
            });
            await message.reply("تم إرسال زر التكت بنجاح!");
        }
    }

    // 2. أوامر الإدارة (قفل، فتح، مسح، send، bc)
    if (message.content.startsWith("قفل")) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return;
        await message.channel.messages.fetch({ limit: 100 }).then(msgs => message.channel.bulkDelete(msgs, true));
        await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: false, AddReactions: false });
        return;
    }

    if (message.content.startsWith("فتح")) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return;
        try { await message.delete(); } catch(e) {}
        await message.channel.permissionOverwrites.edit(message.guild.id, { SendMessages: null, AddReactions: null });
        return;
    }

    if (message.content.startsWith("مسح")) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;
        const args = message.content.split(" ");
        const count = parseInt(args[1]);
        try { await message.delete(); } catch(e) {}
        if (!isNaN(count)) {
            let fetched = await message.channel.messages.fetch({ limit: Math.min(count, 100) });
            await message.channel.bulkDelete(fetched, true);
        } else {
            let fetched = await message.channel.messages.fetch({ limit: 100 });
            await message.channel.bulkDelete(fetched, true);
        }
        return;
    }

    // أمر /send (يكتب البوت الكلام أو يرسل الصور/الفيديوهات بدلاً عنك ويحذف رسالتك)
    if (message.content.startsWith("/send")) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;
        const textToSend = message.content.slice(5).trim();
        const attachments = Array.from(message.attachments.values());
        
        try { await message.delete(); } catch(e) {}

        if (textToSend || attachments.length > 0) {
            await message.channel.send({
                content: textToSend || undefined,
                files: attachments.map(att => att.url)
            });
        }
        return;
    }

    // أمر البث العام (bc)
    if (message.content.startsWith("bc")) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const broadcastContent = message.content.slice(2).trim();
        const attachments = Array.from(message.attachments.values());
        
        const members = await message.guild.members.fetch();
        let successCount = 0;

        for (const [id, member] of members) {
            if (member.user.bot) continue;
            try {
                await member.send({
                    content: broadcastContent || undefined,
                    files: attachments.map(att => att.url)
                });
                successCount++;
            } catch (err) {
                // قد تكون رسائل الخاص مغلقة لدى العضو
            }
        }

        await message.reply(`تم الإرسال إلى جميع الناس الذي بالسيرفر (${successCount})`);
        return;
    }

    // نظام إدارة التكتات الداخلية (إغلاق، فتح، delete)
    if (message.channel.parentId === CONFIG.archiveCategory || message.channel.name.startsWith("ticket-") || message.channel.name.startsWith("delete-")) {
        const channelName = message.channel.name;

        if (message.content === "إغلاق") {
            // إذا كان في روم تكت عادي وانكتب إغلاق ينقل للأرشيف المؤقت
            if (message.channel.parentId === CONFIG.ticketCategory1 || message.channel.parentId === CONFIG.ticketCategory2) {
                const originalUserTag = channelName.replace("ticket-", "");
                await message.channel.setParent(CONFIG.archiveCategory);
                await message.channel.setName(`delete-${originalUserTag}`);
                // إخفاء عن العضو العادي وبقاء السبورت
                await message.channel.permissionOverwrites.set([
                    { id: message.guild.id, Deny: [PermissionFlagsBits.ViewChannel] },
                    { id: CONFIG.supportRole, Allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                ]);
                await message.reply("تم إغلاق التكت مؤقتاً ونقله للأرشيف.");
            }
        }

        if (message.content === "فتح") {
            // إذا كان في قسم الأرشيف (delete-) وانكتب فتح، يرجع تكت جديد طبيعي
            if (message.channel.parentId === CONFIG.archiveCategory) {
                const originalUserTag = channelName.replace("delete-", "");
                // البحث عن العضو الأصلي
                const member = message.guild.members.cache.find(m => m.user.username.toLowerCase() === originalUserTag.toLowerCase() || m.id === originalUserTag);
                
                const cat1 = message.guild.channels.cache.get(CONFIG.ticketCategory1);
                const targetCat = (cat1 && cat1.children.cache.size < 50) ? CONFIG.ticketCategory1 : CONFIG.ticketCategory2;

                await message.channel.setParent(targetCat);
                await message.channel.setName(`ticket-${originalUserTag}`);
                
                if (member) {
                    await message.channel.permissionOverwrites.set([
                        { id: message.guild.id, Deny: [PermissionFlagsBits.ViewChannel] },
                        { id: member.id, Allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                        { id: CONFIG.supportRole, Allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                    ]);
                }
                await message.channel.send("كأن التكت جديد، تم إعادة فتحه وتفعيل الصلاحيات.");
            }
        }

        if (message.content === "delete") {
            // إذا كتبه صاحب رول التحكم الكامل
            if (message.member.roles.cache.has(CONFIG.adminControlRole)) {
                await message.channel.send("جاري حذف الروم نهائياً...");
                setTimeout(() => message.channel.delete(), 3000);
            }
        }
    }
});

// التفاعل مع الأزرار
const activeTickets = new Map();

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    // زر التفعيل
    if (interaction.customId === 'verify_btn') {
        const member = interaction.member;
        try {
            if (CONFIG.verifiedRole) await member.roles.add(CONFIG.verifiedRole);
            if (CONFIG.unverifiedRole) await member.roles.remove(CONFIG.unverifiedRole);
            await interaction.reply({ content: "تم تفعيلك بنجاح وإزالة رول الانتظار!", ephemeral: true });
        } catch (err) {
            await interaction.reply({ content: "حدث خطأ أثناء منح الرول.", ephemeral: true });
        }
    }

    // زر فتح التكت
    if (interaction.customId === 'create_ticket_btn') {
        const guild = interaction.guild;
        const user = interaction.user;

        // التحقق من نظام الكاتيغوري (الامتلاء لـ 50 روم)
        const cat1 = guild.channels.cache.get(CONFIG.ticketCategory1);
        let chosenCategory = CONFIG.ticketCategory1;

        if (cat1 && cat1.children.cache.size >= 50) {
            chosenCategory = CONFIG.ticketCategory2;
        }

        try {
            const ticketChannel = await guild.channels.create({
                name: `ticket-${user.username}`,
                type: 0, // Guild Text
                parent: chosenCategory,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        Deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: user.id,
                        Allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                    },
                    {
                        id: CONFIG.supportRole,
                        Allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                    }
                ]
            });

            await ticketChannel.send({
                content: `<@&${CONFIG.supportRole}> <@&${CONFIG.adminControlRole}>\n\n**اكتب مشكلتك قبل نجي**`
            });

            await interaction.reply({ content: `تم إنشاء التكت بنجاح: ${ticketChannel}`, ephemeral: true });
        } catch (err) {
            console.error(err);
            await interaction.reply({ content: "حدث خطأ أثناء إنشاء التكت.", ephemeral: true });
        }
    }
});
client.login(process.env.DISCORD_TOKEN);

