import Database from 'better-sqlite3';

// Initialisation de la base de données
const db = new Database('chat.db');

// Création des tables avec la structure modifiée
db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        timestamp NUMERIC
    );
    
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER,
        role TEXT,
        content TEXT,
        timestamp NUMERIC,
        ordre INTEGER DEFAULT 1,
        version_number INTEGER DEFAULT 1,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    );
`);

// Modification des requêtes préparées
const queries = {
    insertConversation: db.prepare('INSERT INTO conversations (title, timestamp) VALUES (?, ?)'),
    insertMessage: db.prepare(`
        INSERT INTO messages (conversation_id, role, content, timestamp, ordre, version_number) 
        VALUES (?, ?, ?, ?, ?, ?) 
        RETURNING id
    `),
    getConversation: db.prepare('SELECT * FROM conversations WHERE id = ?'),
    getMessages: db.prepare(`
        SELECT * FROM messages 
        WHERE conversation_id = ?
        ORDER BY ordre ASC
    `),
    updateConversationTimestamp: db.prepare('UPDATE conversations SET timestamp = ? WHERE id = ?'),
    deleteConversation: db.prepare('DELETE FROM conversations WHERE id = ?'),
    deleteMessages: db.prepare('DELETE FROM messages WHERE conversation_id = ?'),
    getConversations: db.prepare(`
        SELECT c.*, m.content as lastMessage 
        FROM conversations c 
        LEFT JOIN messages m ON m.conversation_id = c.id 
        WHERE m.id = (
            SELECT id FROM messages 
            WHERE conversation_id = c.id 
            ORDER BY timestamp DESC 
            LIMIT 1
        )
        ORDER BY c.timestamp DESC
    `),
    updateConversationTitle: db.prepare('UPDATE conversations SET title = ? WHERE id = ?'),
    getLastVersionNumber: db.prepare(`
        SELECT version_number 
        FROM messages 
        WHERE conversation_id = ? AND ordre = ?
        ORDER BY version_number DESC 
        LIMIT 1
    `),
    getMessageVersionsCount: db.prepare(`
        SELECT COUNT(*) as versions_count
        FROM messages 
        WHERE conversation_id = ? 
        AND ordre = ?
    `),
    getAllVersionsForMessage: db.prepare(`
        SELECT version_number, content, timestamp
        FROM messages 
        WHERE conversation_id = ? 
        AND ordre = ?
        ORDER BY version_number ASC
    `)
};

// Modification de la fonction d'insertion
function insertNewMessage(conversationId, role, content, timestamp) {
    const lastOrder = db.prepare(`
        SELECT MAX(ordre) as maxOrdre 
        FROM messages 
        WHERE conversation_id = ?
    `).get(conversationId).maxOrdre || 0;
    
    return queries.insertMessage.run(
        conversationId, 
        role, 
        content, 
        timestamp, 
        lastOrder + 1, // nouvel ordre
        1 // version initiale
    ).lastInsertRowid;
}

// Nouvelle fonction pour vérifier les versions d'un message
function checkMessageVersions(conversationId, ordre) {
    const versionsCount = queries.getMessageVersionsCount.get(conversationId, ordre);
    
    if (versionsCount.versions_count > 1) {
        // Si plusieurs versions existent, récupérer tous les détails
        const versions = queries.getAllVersionsForMessage.all(conversationId, ordre);
        return {
            hasMultipleVersions: true,
            count: versionsCount.versions_count,
            versions: versions
        };
    }
    
    return {
        hasMultipleVersions: false,
        count: versionsCount.versions_count,
        versions: []
    };
}

export { db, queries, insertNewMessage, checkMessageVersions };