import Database from 'better-sqlite3';
import { encoding_for_model } from 'tiktoken';

// Fonction utilitaire pour calculer le nombre de tokens
function calculateTokens(text) {
    try {
        const encoder = encoding_for_model("gpt-3.5-turbo");
        const tokens = encoder.encode(text);
        const tokenCount = tokens.length;
        encoder.free();
        return tokenCount;
    } catch (error) {
        return 0;
    }
}

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
        nb_tokens INTEGER DEFAULT 0,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    );

    CREATE TABLE IF NOT EXISTS versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER,
        version_group TEXT,
        timestamp NUMERIC,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    );

    CREATE TABLE IF NOT EXISTS message_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER,
        version_id INTEGER,
        FOREIGN KEY (message_id) REFERENCES messages(id),
        FOREIGN KEY (version_id) REFERENCES versions(id)
    );

    CREATE TABLE IF NOT EXISTS informations (
        conversation_id INTEGER PRIMARY KEY,
        identite TEXT,
        age TEXT,
        localisation TEXT,
        timestamp NUMERIC,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    );
`);

// Modification des requêtes préparées
const queries = {
    insertConversation: db.prepare('INSERT INTO conversations (title, timestamp) VALUES (?, ?)'),
    insertMessage: db.prepare(`
        INSERT INTO messages (conversation_id, role, content, timestamp, ordre, nb_tokens) 
        VALUES (?, ?, ?, ?, ?, ?) 
        RETURNING id
    `),
    getConversation: db.prepare('SELECT * FROM conversations WHERE id = ?'),
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
    createVersionGroup: db.prepare(`
        INSERT INTO versions (conversation_id, version_group, timestamp)
        VALUES (?, ?, ?)
    `),
    
    addMessageToVersion: db.prepare(`
        INSERT INTO message_versions (message_id, version_id)
        VALUES (?, ?)
    `),
    
    getLatestVersionGroup: db.prepare(`
        SELECT v.* 
        FROM versions v
        WHERE v.conversation_id = ?
        ORDER BY v.timestamp DESC
        LIMIT 1
    `),
    
    getVersionGroup: db.prepare(`
        SELECT v.*, GROUP_CONCAT(m.id) as message_ids
        FROM versions v
        LEFT JOIN message_versions mv ON mv.version_id = v.id
        LEFT JOIN messages m ON m.id = mv.message_id
        WHERE v.id = ?
        GROUP BY v.id
    `),
    
    getMessageVersions: db.prepare(`
        SELECT DISTINCT v.id as version_id, v.timestamp, m.*
        FROM messages m
        JOIN message_versions mv ON mv.message_id = m.id
        JOIN versions v ON v.id = mv.version_id
        WHERE m.ordre = ? AND m.conversation_id = ?
        ORDER BY v.timestamp DESC
    `),
    
    getMessagesFromVersionGroup: db.prepare(`
        SELECT m.*
        FROM messages m
        JOIN message_versions mv ON mv.message_id = m.id
        WHERE mv.version_id = ?
        ORDER BY m.ordre ASC
    `),
    
    deleteMessageVersions: db.prepare(`
        DELETE FROM message_versions 
        WHERE message_id IN (
            SELECT id FROM messages WHERE conversation_id = ?
        )
    `),
    
    deleteVersions: db.prepare('DELETE FROM versions WHERE conversation_id = ?'),
    
    deleteMessages: db.prepare('DELETE FROM messages WHERE conversation_id = ?'),
    
    deleteInformation: db.prepare('DELETE FROM informations WHERE conversation_id = ?'),
    
    deleteConversation: db.prepare('DELETE FROM conversations WHERE id = ?'),
    
    upsertInformation: db.prepare(`
        INSERT INTO informations (conversation_id, identite, age, localisation, timestamp)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(conversation_id) 
        DO UPDATE SET 
            identite = COALESCE(excluded.identite, identite),
            age = COALESCE(excluded.age, age),
            localisation = COALESCE(excluded.localisation, localisation),
            timestamp = excluded.timestamp
    `),
    
    getInformation: db.prepare(`
        SELECT * FROM informations 
        WHERE conversation_id = ?
    `)
};

// Fonction pour mettre à jour un groupe de versions existant
function updateVersionGroup(versionId, messageIds) {
    const timestamp = new Date().toISOString();
    const versionGroup = JSON.stringify(messageIds);
    
    // Mettre à jour le groupe de versions
    db.prepare(`
        UPDATE versions 
        SET version_group = ?, timestamp = ?
        WHERE id = ?
    `).run(versionGroup, timestamp, versionId);
    
    // Supprimer les anciennes associations
    db.prepare(`
        DELETE FROM message_versions
        WHERE version_id = ?
    `).run(versionId);
    
    // Ajouter les nouvelles associations
    messageIds.forEach(messageId => {
        queries.addMessageToVersion.run(messageId, versionId);
    });
    
    return versionId;
}

// Modification de la fonction d'insertion pour gérer les groupes de versions
function insertNewMessage(conversationId, role, content, timestamp) {
    const lastOrder = db.prepare(`
        SELECT MAX(ordre) as maxOrdre 
        FROM messages 
        WHERE conversation_id = ?
    `).get(conversationId).maxOrdre || 0;
    
    const nbTokens = calculateTokens(content);
    
    // Insérer le nouveau message
    const messageId = queries.insertMessage.run(
        conversationId, 
        role, 
        content, 
        timestamp, 
        lastOrder + 1,
        nbTokens
    ).lastInsertRowid;
    
    return messageId;
}

// Fonction pour créer un nouveau groupe de versions
function createNewVersionGroup(conversationId, messageIds) {
    const timestamp = new Date().toISOString();
    const versionGroup = JSON.stringify(messageIds);
    
    const result = queries.createVersionGroup.run(
        conversationId,
        versionGroup,
        timestamp
    );
    
    const versionId = result.lastInsertRowid;
    
    // Ajouter chaque message au groupe de versions
    messageIds.forEach(messageId => {
        queries.addMessageToVersion.run(messageId, versionId);
    });
    
    return versionId;
}

// Fonction pour trouver le point de divergence entre deux séquences de messages
function findDivergencePoint(messages1, messages2) {
    const minLength = Math.min(messages1.length, messages2.length);
    for (let i = 0; i < minLength; i++) {
        if (messages1[i].content !== messages2[i].content) {
            return i;
        }
    }
    return minLength;
}

// Fonction pour obtenir les versions valides pour un message
function getValidVersionsForMessage(ordre, conversationId) {
    try {
        const allVersions = db.prepare(`
            SELECT DISTINCT v.id, v.timestamp
            FROM versions v
            WHERE v.conversation_id = ?
            ORDER BY v.timestamp ASC
        `).all(conversationId);

        const versionsWithMessages = allVersions.map(version => {
            try {
                const messages = db.prepare(`
                    SELECT m.id, m.content, m.ordre
                    FROM messages m
                    JOIN message_versions mv ON mv.message_id = m.id
                    WHERE mv.version_id = ? AND m.ordre <= ?
                    ORDER BY m.ordre ASC
                `).all(version.id, ordre);
                return { ...version, messages };
            } catch (error) {
                return { ...version, messages: [] };
            }
        });

        const versionGroups = new Map();
        const invalidVersions = new Set();

        versionsWithMessages.forEach((version1) => {
            if (invalidVersions.has(version1.id)) return;

            for (const version2 of versionsWithMessages) {
                if (version1.id === version2.id) continue;
                
                const divergencePoint = findDivergencePoint(version1.messages, version2.messages);
                
                if (divergencePoint < ordre - 1) {
                    invalidVersions.add(version1.id);
                    break;
                }
            }

            if (!invalidVersions.has(version1.id)) {
                const content = version1.messages[ordre - 1]?.content;
                if (content) {
                    if (!versionGroups.has(content)) {
                        versionGroups.set(content, []);
                    }
                    versionGroups.get(content).push(version1);
                }
            }
        });

        return Array.from(versionGroups.values()).map(versions => ({
            content: versions[0].messages[ordre - 1].content,
            versions: versions.map(v => ({
                versionId: v.id,
                timestamp: v.timestamp
            }))
        }));
    } catch (error) {
        throw error;
    }
}

// Modification de la requête getMessageVersions
queries.getMessageVersions = db.prepare(`
    SELECT DISTINCT v.id as version_id, v.timestamp, m.*
    FROM messages m
    JOIN message_versions mv ON mv.message_id = m.id
    JOIN versions v ON v.id = mv.version_id
    WHERE m.ordre = ? AND m.conversation_id = ?
    ORDER BY v.timestamp DESC
`);

// Fonction pour obtenir les versions d'un message avec la nouvelle logique
function getMessageVersionsWithValidation(ordre, conversationId) {
    const validVersionGroups = getValidVersionsForMessage(ordre, conversationId);
    return {
        totalGroups: validVersionGroups.length,
        versionGroups: validVersionGroups
    };
}

// Fonction pour mettre à jour les informations utilisateur
function updateUserInformation(conversationId, entities) {
    const now = new Date().toISOString();
    const currentInfo = queries.getInformation.get(conversationId);
    
    // Préparer les nouvelles informations en conservant les anciennes si non remplacées
    const newInfo = {
        identite: entities.nom || currentInfo?.identite || null,
        age: entities.age || currentInfo?.age || null,
        localisation: entities.ville || currentInfo?.localisation || null
    };

    // Mettre à jour ou insérer les informations
    queries.upsertInformation.run(
        conversationId,
        newInfo.identite,
        newInfo.age,
        newInfo.localisation,
        now
    );
    
    return newInfo;
}

// Fonction pour construire le contexte utilisateur
function buildUserContext(conversationId) {
    const info = queries.getInformation.get(conversationId);
    if (!info) return '';
    
    const parts = [];
    if (info.identite) parts.push(`vous parlez à ${info.identite}`);
    if (info.age) parts.push(`qui a ${info.age} ans`);
    if (info.localisation) parts.push(`et qui habite à ${info.localisation}`);
    
    return parts.length > 0 ? `[Context: ${parts.join(', ')}]\n` : '';
}

// Fonction pour supprimer une conversation et toutes ses données associées
function deleteConversationAndRelated(conversationId) {
    // Commencer une transaction
    const transaction = db.transaction((id) => {
        // 1. Supprimer les associations message-version
        queries.deleteMessageVersions.run(id);
        
        // 2. Supprimer les versions
        queries.deleteVersions.run(id);
        
        // 3. Supprimer les messages
        queries.deleteMessages.run(id);
        
        // 4. Supprimer les informations
        queries.deleteInformation.run(id);
        
        // 5. Enfin, supprimer la conversation
        queries.deleteConversation.run(id);
    });

    // Exécuter la transaction
    transaction(conversationId);
}

// Fonction pour récupérer les messages pertinents de l'historique
function getRelevantMessages(versionId, maxTokens) {
    const messages = queries.getMessagesFromVersionGroup.all(versionId);
    if (!messages.length) return [];

    // Garder toujours le premier message
    const firstMessage = messages[0];
    const remainingMessages = messages.slice(1);
    
    // Initialiser avec le premier message
    const selectedMessages = [firstMessage];
    let currentTokens = calculateTokens(
        `<|start_header_id|>${firstMessage.role}<|end_header_id|>${firstMessage.content}<|eot_id|>`
    );

    // Parcourir les messages du plus récent au plus ancien
    for (const msg of remainingMessages.reverse()) {
        const msgContext = `<|start_header_id|>${msg.role}<|end_header_id|>${msg.content}<|eot_id|>`;
        const msgTokens = calculateTokens(msgContext);

        // Vérifier si l'ajout de ce message dépasserait la limite
        if (currentTokens + msgTokens > maxTokens) {
            break;
        }

        // Ajouter le message au début (après le premier message)
        selectedMessages.splice(1, 0, msg);
        currentTokens += msgTokens;
    }

    return selectedMessages;
}

export { db, queries, insertNewMessage, createNewVersionGroup, updateVersionGroup, calculateTokens, getMessageVersionsWithValidation, updateUserInformation, buildUserContext, deleteConversationAndRelated, getRelevantMessages };