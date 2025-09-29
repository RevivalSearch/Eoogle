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

function createVerification(discordId, ecsrId) {
    const db = readDB();
    const code = generateVerificationCode();
    
    if (!db.verifications) db.verifications = {};
    
    db.verifications[discordId] = {
        ecsrId,
        code,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours from now
    };
    
    writeDB(db);
    return code;
}

function checkVerification(discordId, aboutText) {
    const db = readDB();
    const verification = db.verifications?.[discordId];
    
    if (!verification || verification.code !== aboutText) {
        return null;
    }
    
    // Verification successful, return the ECSR ID
    const ecsrId = verification.ecsrId;
    
    // Clean up the verification
    delete db.verifications[discordId];
    writeDB(db);
    
    return ecsrId;
}
function getLinkedAccount(discordId) {
    const db = readDB();
    return db.users?.[discordId] || null;
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
    return db.users || {};
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
