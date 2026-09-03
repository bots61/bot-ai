const { Client, GatewayIntentBits, ChannelType, PermissionsBitField, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// الأيدياس المطلوبة
const TARGET_CHANNEL_ID = '1544964340916949052'; // الروم المستهدف للكتابة
const CATEGORIES = [
    '1544964105742585866',
    '1544964067876278272',
    '1544964686653431878',
    '1544964713803153418'
];

// تخزين الرومات النشطة للمستخدمين (للتأكد أن المستخدم ليس لديه روم مسبقاً)
// مفتاح: userId، قيمة: channelId
const activeRooms = new Map();

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // 1. أمر الحذف: delete room
    if (message.content.toLowerCase() === 'delete room') {
        // التحقق إذا كان الروم الحالي هو روم AI خاص بالمستخدم
        const isAiRoom = Array.from(activeRooms.values()).includes(message.channel.id);
        if (isAiRoom) {
            try {
                await message.channel.delete();
                // إزالة المستخدم من الخريطة
                for (let [userId, chId] of activeRooms.entries()) {
                    if (chId === message.channel.id) {
                        activeRooms.delete(userId);
                        break;
                    }
                }
            } catch (err) {
                console.error('Error deleting room:', err);
            }
        }
        return;
    }

    // 2. التحقق من الروم المستهدف
    if (message.channel.id === TARGET_CHANNEL_ID) {
        // حذف رسالة العضو فوراً (بأقل من ثانية)
        try {
            await message.delete();
        } catch (err) {
            console.error('Failed to delete message:', err);
        }

        const userId = message.author.id;

        // التحقق إذا كان لدى المستخدم روم مسبقاً
        if (activeRooms.has(userId)) {
            const existingRoomId = activeRooms.get(userId);
            const existingRoom = message.guild.channels.cache.get(existingRoomId);

            if (existingRoom) {
                // إرسال رسالةEphemeral وهمية أو رسالة خاصة/مؤقتة لا يشاهدها إلا هو في نفس الروم (عبر رسالة مؤقتة يتم حذفها أو تنبيه)
                // نظراً لأن رسائل الـ Ephemeral الحقيقية تحتاج Interaction، سنرسل رسالة تحذيرية ونحذفها سريعاً أو نكتفي بالتنبيه المناسب
                const warningMsg = await message.channel.send({
                    content: `<@${userId}> أنت عندك روم من قبل!`
                });
                setTimeout(() => warningMsg.delete().catch(() => {}), 4000);
                return;
            } else {
                activeRooms.delete(userId);
            }
        }

        // اختيار الكاتيجوري المناسب بناءً على الامتلاء (حد أقصى 50 روم في الكاتيجوري الواحد)
        let selectedCategory = null;
        for (const catId of CATEGORIES) {
            const category = message.guild.channels.cache.get(catId);
            if (category && category.type === ChannelType.GuildCategory) {
                // عد الرومات الموجودة في الكاتيجوري
                const roomsCount = category.children.cache.size;
                if (roomsCount < 50) {
                    selectedCategory = catId;
                    break;
                }
            }
        }

        // إذا امتلت كل الكاتيجوريات (احتياطياً نختار الأخيرة أو الأولى)
        if (!selectedCategory) {
            selectedCategory = CATEGORIES[CATEGORIES.length - 1];
        }

        try {
            // إنشاء الروم بالاسم المطلوب: ai-Username
            const channelName = `ai-${message.author.username}`;
            const newChannel = await message.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: selectedCategory,
                permissionOverwrites: [
                    {
                        id: message.guild.id, // منع الجميع (@everyone) من الرؤية
                        deny: [PermissionsBitField.Flags.ViewChannel]
                    },
                    {
                        id: userId, // السماح لصاحب الروم فقط
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory
                        ]
                    },
                    {
                        id: client.user.id, // السماح للبوت
                        allow: [
                            PermissionsBitField.Flags.ViewChannel,
                            PermissionsBitField.Flags.SendMessages,
                            PermissionsBitField.Flags.ReadMessageHistory
                        ]
                    }
                ]
            });

            // تسجيل الروم في الذاكرة
            activeRooms.set(userId, newChannel.id);

            // إرسال رسالة الترحيب والطلب من الـ AI
            await newChannel.send({
                content: `<@${userId}> اسأل أي سؤال وأنا بخدمتك.`
            });

        } catch (err) {
            console.error('Error creating AI room:', err);
        }
        return;
    }

    // 3. التفاعل داخل رومات الـ AI الخاصة بالمستخدمين
    const isAiRoom = Array.from(activeRooms.values()).includes(message.channel.id);
    if (isAiRoom) {
        // تجاهل رسائل السب أو الكلمات المسيئة (يمكنك تخصيص فلتر كلمات هنا إذا رغبت)
        const content = message.content.trim();
        
        // محاكاة رد الذكاء الاصطناعي (يمكنك ربطه بـ OpenAI API أو ترك الرد الافتراضي النموذجي)
        // كمثال للرد السريع:
        try {
            // هنا يتم استدعاء نموذج الذكاء الاصطناعي الخاص بك والرد على السؤال
            // مثال توضيحي للرد:
            if (content.includes('السلام عليكم')) {
                await message.reply('وعليكم السلام ورحمة الله وبركاته، أهلاً بك! كيف يمكنني مساعدتك اليوم؟');
            } else if (content.toLowerCase().includes('استشارة')) {
                await message.reply('يلا عطني تفاصيل الاستشارة، أنا أسمعك وجاهز للمساعدة.');
            } else {
                // رد عام لأي سؤال بالحياة
                await message.reply(`أهلاً بك، لقد تلقيت سؤالك وجاهز للإجابة عليه بدقة واحترافية.`);
            }
        } catch (err) {
            console.error('Error replying in AI room:', err);
        }
    }
});

client.login('YOUR_BOT_TOKEN');
