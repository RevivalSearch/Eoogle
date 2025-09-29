require('dotenv').config();
const { Client, IntentsBitField, EmbedBuilder, User, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fetch = require('node-fetch');
const { getLinkedAccount, readDB, writeDB, createVerification, checkVerification, clearUsernameCache, getCachedUsers, getLinkedUsers } = require('./db');

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent
    ]
});

const BASE_URL = 'https://ecsr.io';
const EMOJIS = {
    banned: '<:banned:1422001984055283902>',
    admin: '<:admin:1422001963893264454>',
    verified: '<:verified:1422001945480134687>',
    obc: '<:OBC_Badge:1422001890878558280>',
    tbc: '<:TBC_Badge:1422001881336516729>',
    bc: '<:BC_Badge:1422001868120260718>'
};

const { cacheUsername } = require('./db');

async function getUserInfo(userId) {
    try {
        const [userRes, membershipRes, headshotRes] = await Promise.all([
            fetch(`${BASE_URL}/apisite/users/v1/users/${userId}`),
            fetch(`${BASE_URL}/apisite/premiumfeatures/v1/users/${userId}/validate-membership`),
            fetch(`${BASE_URL}/apisite/thumbnails/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=png`)
        ]);
        
        const user = await userRes.json();
        const membership = await membershipRes.json();
        const headshotData = await headshotRes.json();
        
        // Find the headshot URL for the requested user
        const headshotEntry = headshotData.data?.find(entry => entry.targetId.toString() === userId.toString());
        const headshotUrl = headshotEntry?.imageUrl ? `${BASE_URL}${headshotEntry.imageUrl}` : null;
        
        // Cache the username if we have a valid user
        if (user && user.id && user.displayName) {
            cacheUsername(user.id.toString(), user.displayName);
        }
        
        return { user, membership, headshotUrl };
    } catch (error) {
        console.error('Error fetching user info:', error);
        return null;
    }
}

async function getUsernameHistory(userId) {
    try {
        const res = await fetch(`${BASE_URL}/apisite/users/v1/users/${userId}/username-history?limit=1000`);
        const data = await res.json();
        return data.data.map(entry => entry.name);
    } catch (error) {
        console.error('Error fetching username history:', error);
        return [];
    }
}

function getMembershipBadge(membershipLevel) {
    switch(parseInt(membershipLevel)) {
        case 1: return EMOJIS.bc;
        case 2: return EMOJIS.tbc;
        case 3: return EMOJIS.obc;
        default: return '';
    }
}

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    client.user.setActivity('!help | Eoogle', { type: 'PLAYING' });
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
    if (!message.content.startsWith('!')) return;

    // Handle quoted usernames with spaces
    const args = message.content.slice(1).trim().match(/\S+|\"[^\"]+\"/g) || [];
    const command = args.shift()?.toLowerCase() || '';
    // Join remaining args with spaces to preserve usernames with spaces
    const input = args.join(' ').replace(/"/g, '').trim();

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
            return message.reply('Please provide an ECSR ID to link. Example: `!link 1234567`');
        }
        
        // Check if user already has a linked account
        const currentLink = getLinkedAccount(message.author.id);
        if (currentLink) {
            return message.reply(`You already have a linked ECSR account (ID: ${currentLink}). Use \`!unlink\` first if you want to link a different account.`);
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
        const code = createVerification(message.author.id, ecsrId);
        
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
            .setColor('#3498db');
            
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
                return message.reply('Please provide a valid range. Example: `!cacheusers 1-100`');
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

    // For user and names commands, resolve the user ID first
    let resolvedId;
    try {
        if (command === 'user' || command === 'names') {
            if (!input) {
                // If no input, check if the author has a linked account
                const linkedAccount = getLinkedAccount(message.author.id);
                if (!linkedAccount) {
                    return message.reply('Please provide a user ID, mention, or link your account with `!link [ecsrid]`');
                }
                resolvedId = linkedAccount;
            } else {
                resolvedId = await resolveUserId(input, message) || input;
            }
        } else if (command !== 'help') {
            return; // Unknown command
        }
    } catch (error) {
        console.error('Error resolving user ID:', error);
        return message.reply('An error occurred while processing your request.');
    }

    if (command === 'user' && resolvedId) {
        try {
            // First check if the resolvedId is actually a username (not a number)
            if (isNaN(resolvedId)) {
                // If it's not a number, it's a username that wasn't found in cache
                return message.reply(`User "${resolvedId}" not found in cache. Please use the user ID instead.`);
            }
            
            const data = await getUserInfo(resolvedId);
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
            
            // Find if this ECSR ID is linked to any Discord account
            const db = readDB();
            const discordLink = Object.entries(db.users || {}).find(([_, id]) => id === user.id.toString());
            const linkedDiscord = discordLink ? `<@${discordLink[0]}>` : 'Nobody';

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`${user.displayName}${badges.length ? ' ' + badges.join(' ') : ''}`)
                .setDescription(user.description || 'no description')
                .addFields(
                    { name: 'User ID', value: `[${user.id}](https://ecsr.io/users/${user.id}/profile)`, inline: true },
                    { name: 'Created', value: new Date(user.created).toLocaleDateString(), inline: true },
                    { name: 'Linked to', value: linkedDiscord, inline: true },
                    { name: 'Place Visits', value: user.placeVisits.toString(), inline: true },
                    { name: 'Forum Posts', value: user.forumPosts.toString(), inline: true }
                )
                .setThumbnail(headshotUrl || '')
                .setFooter({ text: 'Eoogle - User Information', iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            message.channel.send({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            message.reply('an error occurred while fetching user information.');
        }
    } else if (command === 'names' && resolvedId) {
        try {
            const usernameHistory = await getUsernameHistory(resolvedId);
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Username History')
                .setDescription(`Username history for user ID: ${resolvedId}`)
                .addFields({
                    name: 'Previous Usernames',
                    value: usernameHistory.length > 1 
                        ? usernameHistory.slice(1).map(name => `• ${name}`).join('\n')
                        : 'No previous usernames found',
                    inline: false
                })
                .setFooter({ text: 'Eoogle - Username History', iconURL: client.user.displayAvatarURL() })
                .setTimestamp();
            
            message.channel.send({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            return message.reply('an error occurred while fetching username history.');
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
            .setDescription('prefix: `!`')
            .addFields(
                { 
                    name: 'Admin Commands',
                    value: '`!deletecache` - Delete username cache\n' +
                           '`!cachedusers` - List cached users\n' +
                           '`!linkedusers` - List linked users',
                    inline: false
                },
                {
                    name: '🔍 User Commands',
                    value: '`!user <userid|@mention>` - Get user info\n' +
                           '`!names <userid|@mention>` - Get username history',
                    inline: false
                },
                {
                    name: '🔗 Account Linking',
                    value: '`!link <ecsrid>` - Link your Discord account to an ECSR ID\n' +
                           '`!unlink` - Unlink your Discord account from an ECSR ID',
                    inline: false
                },
                { 
                    name: '❓ Help',
                    value: '`!help` - Show this help message',
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
    if (!interaction.isButton() || interaction.customId !== 'verify_account') return;
    
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const discordId = interaction.user.id;
        
        // Get the user's ECSR ID from verifications
        const db = readDB();
        const verification = db.verifications?.[discordId];
        
        if (!verification) {
            return interaction.followUp({ 
                content: 'No active verification found. Please start the linking process again with `!link`.',
                ephemeral: true 
            });
        }
        
        // Get the user's ECSR profile to check the about section
        const userData = await getUserInfo(verification.ecsrId);
        
        if (!userData || !userData.user) {
            return interaction.followUp({
                content: '❌ Could not verify your ECSR account. Please try again later.',
                ephemeral: true
            });
        }
        
        // Check if the code is in the about section
        if (!userData.user.description || !userData.user.description.includes(verification.code)) {
            return interaction.followUp({
                content: '❌ Could not find the verification code in your ECSR profile\'s About section. Please make sure you\'ve added it exactly as shown.',
                ephemeral: true
            });
        }
        
        // Verification successful, link the account
        if (!db.users) db.users = {};
        db.users[discordId] = verification.ecsrId;
        delete db.verifications[discordId];
        writeDB(db);
        
        await interaction.followUp({
            content: `✅ Successfully verified and linked your account to ECSR ID: ${verification.ecsrId} (${userData.user.displayName})`,
            ephemeral: true
        });
        
        // Update the original message to remove the button
        const originalMessage = await interaction.channel.messages.fetch(interaction.message.id);
        if (originalMessage) {
            const embed = new EmbedBuilder()
                .setTitle('✅ Account Linked Successfully')
                .setDescription(`Your Discord account has been linked to ECSR ID: **${verification.ecsrId}** (${userData.user.displayName})`)
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
