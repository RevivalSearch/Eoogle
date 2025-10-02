const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.json');

// Initialize database if it doesn't exist
if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ users: {}, verifications: {} }, null, 2));
}

function readDB() {
    try {
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch (error) {
        console.error('Error reading database:', error);
        return { users: {}, verifications: {} };
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function cacheUsername(userId, username) {
    const db = readDB();
    if (!db.usernameCache) db.usernameCache = {};
    db.usernameCache[userId] = username;
    writeDB(db);
}

function getCachedUsername(userId) {
    const db = readDB();
    return db.usernameCache?.[userId] || null;
}

function generateVerificationCode() {
    const words = [
        'cat', 'dog', 'apple', 'banana', 'ocean', 'mountain', 'computer', 'keyboard',
        'sunshine', 'moonlight', 'coffee', 'pizza', 'guitar', 'piano', 'garden',
        'whisper', 'thunder', 'lightning', 'rainbow', 'butterfly', 'dragon', 'wizard',
        'unicorn', 'castle', 'forest', 'river', 'desert', 'star', 'planet', 'comet',
        'rocket', 'alien', 'robot', 'diamond', 'emerald', 'fire', 'ice', 'storm', 
        'cloud', 'sand', 'leaf', 'flower', 'shadow', 'mirror', 'music', 'dance', 
        'magic', 'adventure', 'treasure', 'island', 'volcano', 'cave', 'night', 'day',
        
        // Nature & Animals
        'elephant', 'penguin', 'dolphin', 'eagle', 'lion', 'tiger', 'bear', 'wolf',
        'fox', 'rabbit', 'squirrel', 'owl', 'peacock', 'flamingo', 'whale', 'shark',
        'turtle', 'frog', 'butterfly', 'bee', 'spider', 'coral', 'seaweed', 'pebble',
        'crystal', 'amber', 'pearl', 'shell', 'feather', 'moss', 'vine', 'bamboo',
        
        // Technology & Objects
        'smartphone', 'tablet', 'headphones', 'camera', 'telescope', 'microscope',
        'calculator', 'compass', 'watch', 'bicycle', 'skateboard', 'helicopter',
        'submarine', 'spaceship', 'telescope', 'antenna', 'satellite', 'engine',
        
        // Food & Drinks
        'chocolate', 'vanilla', 'strawberry', 'mango', 'pineapple', 'coconut',
        'sandwich', 'pasta', 'soup', 'bread', 'cheese', 'honey', 'cinnamon',
        'lemonade', 'smoothie', 'pancake', 'waffle', 'cookie', 'cupcake',
        
        // Colors & Art
        'crimson', 'turquoise', 'lavender', 'golden', 'silver', 'bronze', 'scarlet',
        'violet', 'indigo', 'magenta', 'canvas', 'palette', 'sculpture', 'painting',
        'sketch', 'portrait', 'landscape', 'mosaic', 'origami',
        
        // Weather & Elements
        'breeze', 'blizzard', 'drizzle', 'tornado', 'hurricane', 'mist', 'frost',
        'snowflake', 'icicle', 'hailstone', 'sunrise', 'sunset', 'twilight', 'dawn',
        
        // Fantasy & Mythology
        'phoenix', 'griffin', 'centaur', 'mermaid', 'fairy', 'goblin', 'elf',
        'dwarf', 'knight', 'princess', 'kingdom', 'crown', 'sword', 'shield',
        'potion', 'spell', 'wand', 'crystal', 'portal', 'quest',
        
        // Emotions & Abstract
        'courage', 'wisdom', 'kindness', 'laughter', 'serenity', 'mystery',
        'wonder', 'harmony', 'freedom', 'hope', 'dream', 'memory', 'whisper',
        'echo', 'silence', 'rhythm', 'melody', 'symphony', 'journey'
    ];
    
    const selected = [];
    for (let i = 0; i < 4; i++) {
        selected.push(words[Math.floor(Math.random() * words.length)]);
    }
    
    return `eoogle-${selected.join('-')}`;
}

function createVerification(discordId, accountId, type = 'ecsr') {
    const db = readDB();
    const code = generateVerificationCode();
    
    if (!db.verifications) db.verifications = {};
    
    db.verifications[discordId] = {
        accountId,
        type,
        code,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours from now
    };
    
    // If the account is already linked, update it
    if (!db.users[discordId]) {
        db.users[discordId] = {};
    }
    
    // Store the account ID and type
    db.users[discordId][type] = accountId;
    db.users[discordId].type = type;
    
    writeDB(db);
    return code;
}

function checkVerification(discordId, aboutText) {
    const db = readDB();
    const verification = db.verifications?.[discordId];
    
    if (!verification || !aboutText) return { success: false };
    
    if (aboutText.includes(verification.code) && verification.expiresAt > Date.now()) {
        // Link the account
        if (!db.users) db.users = {};
        if (!db.users[discordId]) db.users[discordId] = {};
        
        // Store the account ID in the appropriate field based on type
        db.users[discordId][verification.type] = verification.accountId;
        db.users[discordId].type = verification.type;
        
        delete db.verifications[discordId];
        writeDB(db);
        return { 
            success: true, 
            accountId: verification.accountId,
            type: verification.type
        };
    }
    
    // If verification is expired, clean it up
    if (verification.expiresAt <= Date.now()) {
        delete db.verifications[discordId];
        writeDB(db);
    }
    
    return { success: false };
}

function getLinkedAccount(discordId, type = 'ecsr') {
    const db = readDB();
    if (!db.users || !db.users[discordId]) return null;
    
    // For backward compatibility with old format where users were stored directly by ID
    if (typeof db.users[discordId] === 'string') {
        // Migrate old format to new format
        const oldId = db.users[discordId];
        db.users[discordId] = {
            ecsr: oldId,
            type: 'ecsr'
        };
        writeDB(db);
    }
    
    const userData = db.users[discordId];
    
    // If no type specified, return based on the user's current type
    if (!type) {
        return userData[userData.type] || null;
    }
    
    // Return the specific type if it exists
    return userData[type] || null;
}

function clearUsernameCache() {
    const db = readDB();
    db.usernameCache = {};
    writeDB(db);
    return true;
}

function getCachedUsers() {
    const db = readDB();
    return db.usernameCache || {};
}

function getLinkedUsers() {
    const db = readDB();
    const linkedUsers = [];
    
    if (db.users) {
        for (const [discordId, accounts] of Object.entries(db.users)) {
            if (accounts.ecsr) {
                linkedUsers.push({
                    discordId,
                    type: 'ecsr',
                    userId: accounts.ecsr
                });
            }
            if (accounts.korone) {
                linkedUsers.push({
                    discordId,
                    type: 'korone',
                    userId: accounts.korone
                });
            }
        }
    }
    
    return linkedUsers;
}

module.exports = {
    createVerification,
    checkVerification,
    getLinkedAccount,
    readDB,
    writeDB,
    cacheUsername,
    getCachedUsername,
    clearUsernameCache,
    getCachedUsers,
    getLinkedUsers
};
