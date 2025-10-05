require('dotenv').config();
const { Client, IntentsBitField, EmbedBuilder, User, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const fetch = require('node-fetch');
const { getLinkedAccount, readDB, writeDB, createVerification, checkVerification, clearUsernameCache, getCachedUsers, getLinkedUsers } = require('./db');

const ECSR_BASE_URL = 'https://ecsr.io';
const KORONE_BASE_URL = 'https://www.pekora.zip';
const EMOJIS = {
    banned: '<:banned:1422001984055283902>',
    admin: '<:admin:1422001963893264454>',
    verified: '<:verified:1422001945480134687>',
    obc: '<:OBC_Badge:1422001890878558280>',
    tbc: '<:TBC_Badge:1422001881336516729>',
    premium: '<:premium:1423670642729025547>',
    bc: '<:BC_Badge:1422001868120260718>'
};
// Constants
const USER_AGENT = 'Mozilla/5.0 (compatible; EoogleBot/1.0; contact owner at starlited3vv@gmail.com)';
const fetchOptions = {
    headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
    }
};

async function getFollowCounts(userId, revival = 'ecsr') {
    const BASE_URL = revival === 'korone' ? KORONE_BASE_URL : ECSR_BASE_URL;
    
    try {
        const [followersRes, followingsRes] = await Promise.all([
            fetch(`${BASE_URL}/apisite/friends/v1/users/${userId}/followers/count`, fetchOptions),
            fetch(`${BASE_URL}/apisite/friends/v1/users/${userId}/followings/count`, fetchOptions)
        ]);
        
        const followersData = await followersRes.json();
        const followingsData = await followingsRes.json();
        
        return {
            followers: followersData.count || 0,
            following: followingsData.count || 0
        };
    } catch (error) {
        console.error(`Error fetching ${revival} follow counts:`, error);
        return { followers: 'N/A', following: 'N/A' };
    }
}

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent
    ]
});

// Function to fetch collection data
async function getCollectionItems(userId, revival = 'ecsr') {
    const baseUrl = revival === 'korone' ? KORONE_BASE_URL : ECSR_BASE_URL;
    const url = `${baseUrl}/users/profile/robloxcollections-json?userId=${userId}`;
    
    try {
        const response = await fetch(url, fetchOptions);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return data.CollectionsItems || [];
    } catch (error) {
        console.error(`Error fetching ${revival} collection:`, error);
        return [];
    }
}

// Function to fetch full body thumbnails
async function getFullBodyThumbnails(userId, revival = 'ecsr') {
    const baseUrl = revival === 'korone' ? KORONE_BASE_URL : ECSR_BASE_URL;
    const endpoint = 'avatar'; // Both ECSR and Korone use 'avatar' endpoint
    const url = `${baseUrl}/apisite/thumbnails/v1/users/${endpoint}?userIds=${userId}&size=420x420&format=png`;
    
    try {
        const response = await fetch(url, fetchOptions);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        if (data.data && data.data.length > 0 && data.data[0].imageUrl) {
            const imagePath = data.data[0].imageUrl;
            return imagePath.startsWith('http') ? imagePath : `${baseUrl}${imagePath}`;
        }
        return null;
    } catch (error) {
        console.error(`Error fetching ${revival} full body thumbnail:`, error);
        return null;
    }
}

const { cacheUsername } = require('./db');

async function getUserInfo(userId, revival = 'ecsr') {
    const BASE_URL = revival === 'korone' ? KORONE_BASE_URL : ECSR_BASE_URL;
    
    try {
        const [userRes, membershipRes, headshotRes] = await Promise.all([
            fetch(`${BASE_URL}/apisite/users/v1/users/${userId}`, fetchOptions),
            fetch(`${BASE_URL}/apisite/premiumfeatures/v1/users/${userId}/validate-membership`, fetchOptions),
            fetch(`${BASE_URL}/apisite/thumbnails/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=png`, fetchOptions)
        ]);

        // Check if any response is HTML (CAPTCHA page)
        const userText = await userRes.text();
        if (userText.trim().startsWith('<!DOCTYPE') || userText.trim().startsWith('<html')) {
            throw new Error('CAPTCHA challenge detected. Please try again later.');
        }
        
        const user = JSON.parse(userText);
        const membership = await membershipRes.json();
        const headshotData = await headshotRes.json();
        
        // Find the headshot URL for the requested user
        const headshotEntry = headshotData.data?.find(entry => entry.targetId.toString() === userId.toString());
        const headshotUrl = headshotEntry?.imageUrl ? `${BASE_URL}${headshotEntry.imageUrl}` : null;
        
        // Cache the username if we have a valid user
        if (user && user.id && (user.displayName || user.name)) {
            cacheUsername(user.id.toString(), user.displayName || user.name);
        }
        
        return { 
            user: {
                ...user,
                // Normalize user object between ECSR and Korone
                displayName: user.displayName || user.name,
                isVerified: user.isVerified || user.hasVerifiedBadge || false,
                isBanned: user.isBanned || false,
                isStaff: user.isStaff || false,
                placeVisits: user.placeVisits || 0,
                forumPosts: user.forumPosts || 0
            }, 
            membership, 
            headshotUrl 
        };
    } catch (error) {
        console.error(`Error fetching ${revival} user info:`, error);
        if (error.message.includes('CAPTCHA')) {
            throw error; // Re-throw CAPTCHA error to show a user-friendly message
        }
        return null;
    }
}

async function getUsernameHistory(userId, revival = 'ecsr') {
    const BASE_URL = revival === 'korone' ? KORONE_BASE_URL : ECSR_BASE_URL;
    
    try {
        const res = await fetch(`${BASE_URL}/apisite/users/v1/users/${userId}/username-history?limit=1000`, fetchOptions);
        const data = await res.json();
        return data.data.map(entry => entry.name);
    } catch (error) {
        console.error(`Error fetching ${revival} username history:`, error);
        return [];
    }
}

function getMembershipBadge(membershipLevel) {
    switch(parseInt(membershipLevel)) {
        case 1: return EMOJIS.bc;
        case 2: return EMOJIS.tbc;
        case 3: return EMOJIS.obc;
         case 4: return EMOJIS.premium;
        default: return '';
    }
}

// Function to update the bot's presence
function updatePresence() {
    const activities = [
        { name: 'e-help | Get help!', type: 'PLAYING' },
        { name: `Holding ${getCachedUsers().length} users in cache!`, type: 'WATCHING' },
        { name: 'Eoogle, Google. No? e-help', type: 'PLAYING' }
    ];
    
    // Set initial activity
    const activity = activities[0];
    client.user.setActivity(activity.name, { type: activity.type });
    
    // Rotate activities every 15 seconds
    let index = 1;
    setInterval(() => {
        const activity = activities[index];
        client.user.setActivity(activity.name, { type: activity.type });
        index = (index + 1) % activities.length;
    }, 15000);
}

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    updatePresence();
});

async function resolveUserId(input, message) {
    // If input is empty, check if the author has a linked account
    if (!input) {
        const linkedAccount = getLinkedAccount(message.author.id);
        return linkedAccount || null;
    }
    
    // Clean the input - remove any surrounding quotes
    const cleanInput = input.replace(/^["']|["']$/g, '');
    
    // If input is a mention
    const mentionMatch = cleanInput.match(/^<@!?(\d+)>$/);
    if (mentionMatch) {
        const mentionedUser = await message.client.users.fetch(mentionMatch[1]);
        if (!mentionedUser) return null;
        
        // Check if mentioned user has a linked account
        const linkedAccount = getLinkedAccount(mentionedUser.id);
        return linkedAccount || null;
    }
    
    // If input is a Discord ID
    if (/^\d+$/.test(cleanInput)) {
        const linkedAccount = getLinkedAccount(cleanInput);
        if (linkedAccount) return linkedAccount;
        return cleanInput; // Return the ID as is if no linked account
    }
    
    // If input is a username (search in cache)
    const db = readDB();
    if (db.usernameCache) {
        // Find user ID by username (case-insensitive)
        const cachedEntry = Object.entries(db.usernameCache).find(
            ([_, username]) => username.toLowerCase() === cleanInput.toLowerCase()
        );
        if (cachedEntry) {
            const [userId] = cachedEntry;
            return userId;
        }
    }
    
    // If not found in cache, return the cleaned input (for API calls)
    return cleanInput;
}

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith('e-')) return;
    
    // Handle quoted usernames with spaces
    const args = message.content.slice(2).trim().match(/\S+|"[^"]+"/g) || [];
    const command = args.shift()?.toLowerCase() || '';
    // Join remaining args with spaces to preserve usernames with spaces
    const input = args.join(' ').replace(/"/g, '').trim();
    
    // Handle ping command
    if (command === 'ping') {
        const sent = await message.reply({ content: 'Pinging...', fetchReply: true });
        const botLatency = sent.createdTimestamp - message.createdTimestamp;
        const apiLatency = Math.round(client.ws.ping);
        const messageLatency = Date.now() - message.createdTimestamp;
        
        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🏓 Pong!')
            .addFields(
                { name: 'Bot Latency', value: `\`${botLatency}ms\``, inline: true },
                { name: 'API Latency', value: `\`${apiLatency}ms\``, inline: true },
                { name: 'Message Latency', value: `\`${messageLatency}ms\``, inline: true }
            )
            .setTimestamp();
            
        return sent.edit({ content: '', embeds: [embed] });
    }
    
    // Handle koronestatus command
    if (command === 'koronestatus') {
        try {
            const response = await fetch(KORONE_BASE_URL, {
                method: 'GET',
                headers: { 'User-Agent': USER_AGENT }
            });
            
            const responseText = await response.text();
            const isDown = responseText.includes('site is currently down');
            
            const embed = new EmbedBuilder()
                .setTitle('🌐 Korone Status')
                .setDescription(isDown ? '❌ Korone website is currently down!' : '✅ Korone website is up and running!')
                .addFields(
                    { name: 'Status Code', value: response.status.toString(), inline: true },
                    { name: 'Status', value: isDown ? 'Down' : 'Online', inline: true }
                )
                .setColor(isDown ? '#FF0000' : '#00FF00')
                .setTimestamp();
                
            return message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error checking Korone status:', error);
            const embed = new EmbedBuilder()
                .setTitle('❌ Error')
                .setDescription('Failed to check Korone status. The website might be down or unreachable.')
                .setColor('#FF0000')
                .addFields(
                    { name: 'Error', value: error.message || 'Unknown error occurred' }
                )
                .setTimestamp();
            return message.reply({ embeds: [embed] });
        }
    }
    
    // Handle full body thumbnail commands
    if (command === 'ecsfullbody' || command === 'koronefullbody') {
        const revival = command === 'koronefullbody' ? 'korone' : 'ecsr';
        const userId = input.trim();
        
        if (!userId) {
            return message.reply(`❌ Please provide a user ID. Example: \`e-${command} 1234\``);
        }
        
        try {
            const [imageUrl, userResponse] = await Promise.all([
                getFullBodyThumbnails(userId, revival),
                fetch(`${revival === 'korone' ? KORONE_BASE_URL : ECSR_BASE_URL}/apisite/users/v1/users/${userId}`, fetchOptions)
            ]);
            
            if (!imageUrl) {
                await message.reply('❌ Could not fetch full body thumbnail. The user may not exist or have an avatar.');
                return;
            }
            
            // Get username from the API response
            let username = userId;
            if (userResponse.ok) {
                const userData = await userResponse.json();
                if (userData?.name) {
                    username = userData.name;
                }
            }
            
            const embed = new EmbedBuilder()
                .setColor(revival === 'korone' ? '#FFA500' : '#FF0000') // Orange for Korone, Red for ECSR
                .setTitle(`🖼️ ${username}'s Full Body`)
                .setImage(imageUrl)
                .setFooter({ text: `User ID: ${userId}` });
                
            await message.channel.send({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error in fullbody command:', error);
            message.reply('❌ An error occurred while fetching the full body thumbnail.');
        }
        return;
    }

    if (command === 'unlink') {
        const db = readDB();
        
        // Check if user has a linked account
        if (!db.users?.[message.author.id]) {
            return message.reply("You don't have any linked ECSR account to unlink.");
        }
        
        // Remove the link
        delete db.users[message.author.id];
        writeDB(db);
        
        return message.reply('✅ Successfully unlinked your Discord account from ECSR.');
    }
    
    if (command === 'link') {
        const ecsrId = args[0];
        
        if (!ecsrId) {
            return message.reply('Please provide an ECSR ID to link. Example: `e-link 1234567`');
        }
        
        // Check if user already has a linked account
        const currentLink = getLinkedAccount(message.author.id);
        if (currentLink) {
            return message.reply(`You already have a linked ECSR account (ID: ${currentLink}). Use \`e-unlink\` first if you want to link a different account.`);
        }
        
        // Check if this ECSR ID is already linked to someone else
        const db = readDB();
        const existingUser = Object.entries(db.users || {}).find(([_, id]) => id === ecsrId);
        if (existingUser) {
            const [discordId] = existingUser;
            return message.reply(`This ECSR ID is already linked to <@${discordId}>`);
        }
        
        // Check if the account is banned
        try {
            const userData = await getUserInfo(ecsrId);
            if (userData?.user?.isBanned) {
                return message.reply('❌ This ECSR account is banned. I am unable to link to banned accounts. ');
            }
        } catch (error) {
            console.error('Error checking account status:', error);
            return message.reply('❌ An error occurred while checking the account status. Please try again later.');
        }

        // Create verification code and store it
        const code = createVerification(message.author.id, ecsrId, 'ecsr');
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_account')
                    .setLabel('Verify Account')
                    .setStyle(ButtonStyle.Primary)
            );
            
        const embed = new EmbedBuilder()
            .setTitle('🔗 Link Your ECSR Account')
            .setDescription(
                `To verify ownership of ECSR ID **${ecsrId}**, please follow these steps:\n\n` +
                `1. Copy this code: \`${code}\`\n` +
                `2. Go to your [ECSR profile](https://ecsr.io/My/Account)\n` +
                `3. Paste the code into your **About** section\n` +
                `4. Click the button below to verify\n\n` +
                `*This code will expire in 24 hours*`
            )
            .setColor('#ff0000');
            
        return message.channel.send({ 
            content: `${message.author}`, 
            embeds: [embed], 
            components: [row] 
        });
    }
    
    if (command === 'koronelink') {
        const koroneId = args[0];
        
        if (!koroneId) {
            return message.reply('Please provide a Korone ID to link. Example: `e-koronelink 1234567`');
        }
        
        // Check if user already has a linked Korone account
        const currentKoroneLink = getLinkedAccount(message.author.id, 'korone');
        if (currentKoroneLink) {
            return message.reply(`You already have a linked Korone account (ID: ${currentKoroneLink}). Use \`e-unlink korone\` first if you want to link a different Korone account.`);
        }
        
        // Check if this Korone ID is already linked to someone else
        const db = readDB();
        const existingUser = Object.entries(db.users || {}).find(([_, accounts]) => {
            return accounts?.korone === koroneId;
        });
        if (existingUser) {
            const [discordId] = existingUser;
            return message.reply(`This Korone ID is already linked to <@${discordId}>`);
        }
        
        // Check if the account is banned
        try {
            const userData = await getUserInfo(koroneId, 'korone');
            if (userData?.user?.isBanned) {
                return message.reply('❌ This Korone account is banned. I am unable to link to banned accounts.');
            }
        } catch (error) {
            console.error('Error checking Korone account status:', error);
            return message.reply('❌ An error occurred while checking the Korone account status. Please try again later.');
        }

        // Create verification code and store it with the raw Korone ID (no k_ prefix)
        const code = createVerification(message.author.id, koroneId, 'korone');
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_korone_account')
                    .setLabel('Verify Korone Account')
                    .setStyle(ButtonStyle.Primary)
            );
            
        const embed = new EmbedBuilder()
            .setTitle('🔗 Link Your Korone Account')
            .setDescription(
                `To verify ownership of Korone ID **${koroneId}**, please follow these steps:\n\n` +
                `1. Copy this code: \`${code}\`\n` +
                `2. Go to your [Korone profile](${KORONE_BASE_URL}/users/${koroneId}/profile)\n` +
                `3. Paste the code into your **About** section\n` +
                `4. Click the button below to verify\n\n` +
                `*This code will expire in 24 hours*`
            )
            .setColor('#9b59b6');
            
        return message.channel.send({ 
            content: `${message.author}`, 
            embeds: [embed], 
            components: [row] 
        });
    }

    // Admin commands (only for Discord ID 1322389041030762538)
    const ADMIN_ID = '1322389041030762538';
    if (message.author.id === ADMIN_ID) {
        // Create a DM channel if it doesn't exist
        const dmChannel = message.author.dmChannel || await message.author.createDM();
        
        if (command === 'deletecache') {
            clearUsernameCache();
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Cache Cleared')
                .setDescription('Username cache has been successfully cleared.')
                .setTimestamp();
            
            try {
                await dmChannel.send({ embeds: [embed] });
            } catch (error) {
                console.error('Failed to send DM:', error);
            }
        }
        
        if (command === 'cachedusers') {
            const cachedUsers = getCachedUsers();
            const totalUsers = Object.entries(cachedUsers);
            const usersPerPage = 50;
            let page = 1;
            const maxPage = Math.max(1, Math.ceil(totalUsers.length / usersPerPage));
            
            // Parse page number from message if provided
            const pageMatch = args[0]?.match(/^p(\d+)$/i);
            if (pageMatch) {
                page = parseInt(pageMatch[1], 10);
                if (page < 1) page = 1;
                if (page > maxPage) page = maxPage;
            }
            
            const startIdx = (page - 1) * usersPerPage;
            const paginatedUsers = totalUsers.slice(startIdx, startIdx + usersPerPage);
            
            const userList = paginatedUsers.length > 0 
                ? paginatedUsers.map(([id, name]) => `\`${id}\`: ${name}`).join('\n')
                : 'No users in cache.';
            
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('📊 Cached Users')
                .setDescription(`**Total Cached:** ${totalUsers.length}\n**Page:** ${page}/${maxPage}`)
                .addFields({
                    name: `Users (${startIdx + 1}-${Math.min(startIdx + usersPerPage, totalUsers.length)})`,
                    value: userList,
                });
            
            const row = new ActionRowBuilder();
            
            // Add navigation buttons
            if (maxPage > 1) {
                if (page > 1) {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId('first')
                            .setLabel('⏮️ First')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('prev')
                            .setLabel('◀️ Previous')
                            .setStyle(ButtonStyle.Primary)
                    );
                }
                
                if (page < maxPage) {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId('next')
                            .setLabel('Next ▶️')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(page >= maxPage),
                        new ButtonBuilder()
                            .setCustomId('last')
                            .setLabel('Last ⏭️')
                            .setStyle(ButtonStyle.Secondary)
                    );
                }
            }
            
            try {
                // Send initial message in DMs
                const dmChannel = await message.author.createDM();
                const reply = await dmChannel.send({ 
                    content: 'Here are the cached users:',
                    embeds: [embed],
                    components: row.components.length > 0 ? [row] : []
                });
                
                // Button collector for pagination
                if (row.components.length > 0) {
                    const filter = i => i.user.id === message.author.id;
                    const collector = reply.createMessageComponentCollector({ filter, time: 300000 }); // 5 minutes
                    
                    collector.on('collect', async i => {
                        if (i.customId === 'first' && page > 1) page = 1;
                        if (i.customId === 'prev' && page > 1) page--;
                        if (i.customId === 'next' && page < maxPage) page++;
                        if (i.customId === 'last' && page < maxPage) page = maxPage;
                        
                        const newStartIdx = (page - 1) * usersPerPage;
                        const newPaginatedUsers = totalUsers.slice(newStartIdx, newStartIdx + usersPerPage);
                        const newUserList = newPaginatedUsers.map(([id, name]) => `\`${id}\`: ${name}`).join('\n');
                        
                        embed.setDescription(`**Total Cached:** ${totalUsers.length}\n**Page:** ${page}/${maxPage}`);
                        embed.spliceFields(0, 1, {
                            name: `Users (${newStartIdx + 1}-${Math.min(newStartIdx + usersPerPage, totalUsers.length)})`,
                            value: newUserList || 'No users in cache.'
                        });
                        
                        // Update button states
                        const newRow = new ActionRowBuilder();
                        if (page > 1) {
                            newRow.addComponents(
                                new ButtonBuilder()
                                    .setCustomId('first')
                                    .setLabel('⏮️ First')
                                    .setStyle(ButtonStyle.Secondary),
                                new ButtonBuilder()
                                    .setCustomId('prev')
                                    .setLabel('◀️ Previous')
                                    .setStyle(ButtonStyle.Primary)
                            );
                        }
                        
                        if (page < maxPage) {
                            newRow.addComponents(
                                new ButtonBuilder()
                                    .setCustomId('next')
                                    .setLabel('Next ▶️')
                                    .setStyle(ButtonStyle.Primary),
                                new ButtonBuilder()
                                    .setCustomId('last')
                                    .setLabel('Last ⏭️')
                                    .setStyle(ButtonStyle.Secondary)
                            );
                        }
                        
                        await i.update({ 
                            embeds: [embed],
                            components: newRow.components.length > 0 ? [newRow] : []
                        });
                    });
                    
                    collector.on('end', () => {
                        if (!reply.editable) return;
                        reply.edit({ components: [] }).catch(console.error);
                    });
                }
            } catch (error) {
                console.error('Failed to send message:', error);
                try {
                    await message.reply('Failed to display cached users. The list might be too large.');
                } catch (e) {
                    console.error('Failed to send error message:', e);
                }
            }
        }
        
        if (command === 'linkedusers') {
            const linkedUsers = getLinkedUsers();
            const userList = Object.entries(linkedUsers)
                .map(([discordId, ecsrId]) => `• <@${discordId}> → \`${ecsrId}\``)
                .join('\n') || 'No linked users.';
                
            const embed = new EmbedBuilder()
                .setColor('#9b59b6')
                .setTitle('🔗 Linked Accounts')
                .setDescription(`**Total Linked:** ${Object.keys(linkedUsers).length}`)
                .addFields({
                    name: 'Linked Users',
                    value: userList.length > 1800 ? 'Too many linked users to display.' : userList,
                    inline: false
                })
                .setTimestamp();
            
            try {
                await dmChannel.send({ embeds: [embed] });
            } catch (error) {
                console.error('Failed to send DM:', error);
            }
        }
        
        if (command === 'cacheusers') {
            const rangeMatch = input.match(/(\d+)\s*-\s*(\d+)/);
            if (!rangeMatch) {
                return message.reply('Please provide a valid range. Example: `e-cacheusers 1-100`');
            }
            
            const start = parseInt(rangeMatch[1]);
            const end = parseInt(rangeMatch[2]);
            
            if (start >= end) {
                return message.reply('End of range must be greater than start.');
            }
            
            if ((end - start) > 10000) {
                return message.reply('Maximum range is 10000 users at a time.');
            }
            
            const loadingMsg = await message.channel.send(`🔄 Caching users from ID ${start} to ${end}...`);
            
            let successCount = 0;
            let failCount = 0;
            const failedIds = [];
            
            // Process users in batches of 100
            const BATCH_SIZE = 100;
            for (let i = start; i <= end; i += BATCH_SIZE) {
                const batchEnd = Math.min(i + BATCH_SIZE - 1, end);
                const batchPromises = [];
                
                // Create batch of up to BATCH_SIZE user IDs
                for (let j = i; j <= batchEnd; j++) {
                    batchPromises.push(j);
                }
                
                // Process batch
                const batchResults = await cacheUsersBatch(batchPromises);
                
                // Process results
                batchResults.forEach((result, index) => {
                    const userId = i + index;
                    if (result && result.success) {
                        successCount++;
                    } else {
                        failCount++;
                        if (failedIds.length < 100) {
                            failedIds.push(userId);
                        }
                    }
                });
                
                // Update status after each batch
                const processed = Math.min(batchEnd, end) - start + 1;
                const total = end - start + 1;
                const percentage = Math.round((processed / total) * 100);
                await loadingMsg.edit(`🔄 Caching users... (${processed}/${total} - ${percentage}%)`);
                
                // Rate limiting: 5 second delay between batches (only if not the last batch)
                if (batchEnd < end) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }
            
            const resultEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('✅ User Caching Complete')
                .addFields(
                    { name: 'Total Processed', value: (end - start + 1).toString(), inline: true },
                    { name: '✅ Success', value: successCount.toString(), inline: true },
                    { name: '❌ Failed', value: failCount.toString(), inline: true }
                )
                .setTimestamp();
                
            if (failedIds.length > 0) {
                resultEmbed.addFields({
                    name: 'Failed IDs (first 10)',
                    value: failedIds.join(', '),
                    inline: false
                });
            }
            
            try {
                await loadingMsg.delete();
                await message.channel.send({ content: 'Caching complete!', embeds: [resultEmbed] });
            } catch (error) {
                console.error('Failed to send result:', error);
            }
        }
    }

    // For ecsr, korone, ecsnames, and koronenames commands, resolve the user ID first
    let resolvedId;
    let revival = command === 'korone' || command === 'koronenames' ? 'korone' : 'ecsr';
    
    try {
        // Check if this is a revival-specific command
        if (['ecsr', 'korone', 'ecsnames', 'koronenames'].includes(command)) {
            // Force korone command to only use korone IDs
            if (command === 'korone' && input) {
                // If it's a mention, get the user's korone ID
                if (message.mentions.users.size > 0) {
                    const mentionedUserId = message.mentions.users.first().id;
                    const koroneId = getLinkedAccount(mentionedUserId, 'korone');
                    if (!koroneId) {
                        return message.reply('This user does not have a linked Korone account.');
                    }
                    resolvedId = koroneId;
                } else {
                    // If it's a direct ID, use it as is
                    resolvedId = input;
                }
            }
            
            if (!input) {
                // If no input, check if the author has a linked account
                const linkedAccount = getLinkedAccount(message.author.id, revival);
                if (!linkedAccount) {
                    return message.reply(`Please provide a user ID, mention, or link your account with \`e-${revival === 'korone' ? 'koronelink' : 'link'} [${revival === 'korone' ? 'korone' : 'ecsr'}id]\``);
                }
                resolvedId = linkedAccount;
            } else if (command !== 'korone') {
                // Only use resolveUserId for non-korone commands
                resolvedId = await resolveUserId(input, message) || input;
            }
        } else if (command !== 'help') {
            return; // Unknown command
        }
    } catch (error) {
        console.error('Error resolving user ID:', error);
        return message.reply('An error occurred while processing your request.');
    }

    if ((['ecsr', 'korone'].includes(command)) && resolvedId) {
        try {
            // First check if the resolvedId is actually a username (not a number)
            if (isNaN(resolvedId)) {
                return message.reply(`User "${resolvedId}" not found in cache. Please use the user ID instead.`);
            }
            
            // Send loading embed with service logo
            const isKorone = command === 'korone';
            const placeholder = 'https://ecsr.io/img/placeholder.png';
            
            // Create a safe URL that won't throw validation errors
            const serviceLogo = (() => {
                try {
                    const url = isKorone 
                        ? 'https://www.pekora.zip/img/korone-icon-square1.png'
                        : 'https://cdn.discordapp.com/icons/1138196552503021668/8cb9707fc19e52388ed31f15dc417a72.png';
                    new URL(url); // This will throw if URL is invalid
                    return url;
                } catch {
                    return placeholder;
                }
            })();
            
            const loadingEmbed = new EmbedBuilder()
                .setColor(isKorone ? '#d97000' : '#ff0000')
                .setAuthor({ 
                    name: `Loading ${isKorone ? 'Korone' : 'ECSR'} Profile`,
                    iconURL: serviceLogo || undefined // Fallback to undefined if empty
                })
                .setDescription(`Fetching data for ID: **${resolvedId}**`);
                
            const loadingMessage = await message.channel.send({ 
                embeds: [loadingEmbed] 
            });

            // Add a 2-second delay to waste time
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Get user data
            const data = await getUserInfo(resolvedId, command === 'korone' ? 'korone' : 'ecsr');
            
            // Delete loading message
            try {
                await loadingMessage.delete();
            } catch (error) {
                console.error('Failed to delete loading message:', error);
            }
            
            if (!data) {
                return message.reply('User not found or an error occurred.');
            }

            const { user, membership, headshotUrl } = data;
            
            // Build badges string
            const badges = [];
            if (user.isBanned) badges.push(EMOJIS.banned);
            if (user.isVerified) badges.push(EMOJIS.verified);
            if (user.isStaff) badges.push(EMOJIS.admin);
            const membershipBadge = getMembershipBadge(membership);
            if (membershipBadge) badges.push(membershipBadge);
            
            // Special users configuration per service
            const specialUsers = {
                'ecsr': [
                    '3967', // ECSR user ID 1
                    // Add more ECSR user IDs as needed
                ],
                'korone': [
                    '5226', // Korone user ID 1
                    // Add more Korone user IDs as needed
                ]
            };
            
            // Check if current user ID is in the special list for the current service
            const currentService = command === 'korone' ? 'korone' : 'ecsr';
            if (specialUsers[currentService]?.includes(user.id.toString())) {
                badges.push('<:special:1423453449839710331>');
            }
            
            // Find if this user ID is linked to any Discord account
            const db = readDB();
            const discordLink = Object.entries(db.users || {}).find(([_, accounts]) => {
                return accounts[revival] === user.id.toString() || accounts[revival] === user.id;
            });
            const linkedDiscord = discordLink ? `<@${discordLink[0]}>` : 'Nobody';

            // Get follow counts
            const { followers, following } = await getFollowCounts(user.id, command === 'korone' ? 'korone' : 'ecsr');
            
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`${user.displayName}${badges.length ? ' ' + badges.join(' ') : ''}`)
                .setDescription(user.description || 'no description')
                .addFields(
                    { name: 'User ID', value: `[${user.id}](${revival === 'korone' ? KORONE_BASE_URL : ECSR_BASE_URL}/users/${user.id}/profile)`, inline: true },
                    { name: 'Created', value: new Date(user.created).toLocaleDateString(), inline: true },
                    { name: 'Followers', value: followers.toString(), inline: true },
                    { name: 'Following', value: following.toString(), inline: true },
                    { name: 'Place Visits', value: user.placeVisits.toString(), inline: true },
                    { name: 'Forum Posts', value: user.forumPosts.toString(), inline: true },
                    { name: 'Linked to', value: linkedDiscord, inline: true }
                )
                .setThumbnail(headshotUrl || 'https://ecsr.io/img/placeholder.png')
                .setFooter({ 
                    text: `Eoogle - ${revival === 'korone' ? 'Korone' : 'ECSR'} User Information`, 
                    iconURL: client.user.displayAvatarURL() 
                })
                .setTimestamp();

            message.channel.send({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            message.reply('an error occurred while fetching user information.');
        }
    } else if ((command === 'ecsnames' || command === 'koronenames') && resolvedId) {
        try {
            const usernames = await getUsernameHistory(resolvedId, command === 'koronenames' ? 'korone' : 'ecsr');
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Username History')
                .addFields({
                    name: 'Previous Usernames',
                    value: usernames.length > 1 
                        ? usernames.slice(1).map(name => `• ${name}`).join('\n')
                        : 'No previous usernames found',
                    inline: false
                })
                .setFooter({ 
                    text: `Eoogle - ${command === 'koronenames' ? 'Korone' : 'ECSR'} Username History`,
                    iconURL: client.user.displayAvatarURL() 
                })
                .setTimestamp();
            
            message.channel.send({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            message.reply('an error occurred while fetching username history.');
        }
    }
    
    // Helper function to fetch a single user with infinite retries
    async function fetchUserWithRetry(userId) {
        let attempt = 1;
        const maxDelay = 60000; // Max 1 minute between retries
        
        while (true) {
            try {
                const response = await fetch(`https://ecsr.io/apisite/users/v1/users/${userId}`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'application/json'
                    },
                    timeout: 30000 // 30 second timeout
                });

                if (response.status === 404 || response.status === 400) {
                    console.log(`Skipping user ${userId} (${response.status} - User doesn't exist)`);
                    return { success: false, id: userId, error: 'User does not exist' };
                }
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const userData = await response.json();
                if (userData && userData.id && userData.displayName) {
                    cacheUsername(userData.id.toString(), userData.displayName);
                    return { 
                        success: true, 
                        id: userData.id.toString(), 
                        username: userData.displayName 
                    };
                }
                throw new Error('Invalid user data format');
            } catch (error) {
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), maxDelay);
                console.error(`Attempt ${attempt} failed for user ${userId}: ${error.message}. Retrying in ${delay/1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                attempt++;
            }
        }
    }

    // Helper function to fetch and cache multiple users from ECSR API
    async function cacheUsersBatch(userIds) {
        const batchPromises = userIds.map(userId => fetchUserWithRetry(userId));
        return await Promise.all(batchPromises);
    }

    
    if (command === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Eoogle Bot Commands')
            .setDescription('prefix: `e-`')
            .addFields(
                { 
                    name: 'Admin Commands',
                    value: '`e-deletecache` - Delete username cache\n' +
                           '`e-cachedusers` - List cached users\n' +
                           '`e-linkedusers` - List linked users',
                    inline: false
                },
                {
                    name: '🔍 ECSR Commands',
                    value: '`e-ecsr <userid|@mention>` - Get ECSR user info\n' +
                           '`e-names <userid|@mention>` - Get ECSR username history\n' +
                           '`e-ecsfullbody <userid>` - Get ECSR full body thumbnail\n',
                    inline: false
                },
                {
                    name: '🔍 Korone Commands',
                    value: `\`e-korone <userid|@mention>\` - Get Korone user info (e.g., [12345](${KORONE_BASE_URL}/users/12345/profile))\n` +
                           '`e-koronenames <userid|@mention>` - Get Korone username history\n' +
                           '`e-koronefullbody <userid>` - Get Korone full body thumbnail\n',
                    inline: false
                },
                {
                    name: '🔗 Account Linking',
                    value: '`e-link <ecsrid>` - Link your Discord account to an ECSR ID\n' +
                           '`e-koronelink <koroneid>` - Link your Discord account to a Korone ID\n' +
                           '`e-unlink` - Unlink your Discord account',
                    inline: false
                },
                { 
                    name: '❓ Help',
                    value: '`e-help` - Show this help message',
                    inline: false
                }
            )
            .setFooter({ text: 'Eoogle Bot - Use @mentions after linking your account!', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        return message.channel.send({ embeds: [helpEmbed] });
    }
});

// Handle verification button clicks
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    
    // Handle both ECSR and Korone verification buttons
    if (interaction.customId !== 'verify_account' && interaction.customId !== 'verify_korone_account') return;
    
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const discordId = interaction.user.id;
        const isKorone = interaction.customId === 'verify_korone_account';
        
        // Get the user's verification data
        const db = readDB();
        const verification = db.verifications?.[discordId];
        
        if (!verification) {
            const command = isKorone ? 'e-koronelink' : 'e-link';
            return interaction.followUp({ 
                content: `No active verification found. Please start the linking process again with \`${command}\`.`,
                ephemeral: true 
            });
        }
        
        // Get the user's profile to check the about section
        const userData = await getUserInfo(
            verification.accountId.replace(/^k_/, ''), // Remove 'k_' prefix if present
            verification.type === 'korone' ? 'korone' : 'ecsr'
        );
        
        if (!userData || !userData.user) {
            return interaction.followUp({
                content: '❌ Could not verify your ECSR account. Please try again later.',
                ephemeral: true
            });
        }
        
        // Check if the code is in the about section
        const serviceName = verification.type === 'korone' ? 'Korone' : 'ECSR';
        if (!userData.user.description || !userData.user.description.includes(verification.code)) {
            return interaction.followUp({
                content: `❌ Could not find the verification code in your ${serviceName} profile's About section. Please make sure you've added it exactly as shown.`,
                ephemeral: true
            });
        }
        
        // Verification successful, link the account
        if (!db.users) db.users = {};
        if (!db.users[discordId]) db.users[discordId] = {};
        
        // Store the account ID in the appropriate field based on type
        db.users[discordId][verification.type] = verification.accountId;
        delete db.verifications[discordId];
        writeDB(db);
        
        const displayId = verification.accountId.replace(/^k_/, '');
        
        await interaction.followUp({
            content: `✅ Successfully verified and linked your account to ${serviceName} ID: ${displayId} (${userData.user.displayName})`,
            ephemeral: true
        });
        
        // Update the original message to remove the button
        const originalMessage = await interaction.channel.messages.fetch(interaction.message.id);
        if (originalMessage) {
            const embed = new EmbedBuilder()
                .setTitle(`✅ ${serviceName} Account Linked Successfully`)
                .setDescription(`Your Discord account has been linked to ${serviceName} ID: **${displayId}** (${userData.user.displayName})`)
                .setColor('#2ecc71');
                
            await originalMessage.edit({ 
                content: `${interaction.user}`,
                embeds: [embed],
                components: []
            });
        }
        
    } catch (error) {
        console.error('Verification error:', error);
        interaction.followUp({
            content: '❌ An error occurred while verifying your account. Please try again later.',
            ephemeral: true
        });
    }
});

client.login(process.env.DISCORD_TOKEN);
