import { queries, deleteConversationAndRelated, db } from '../db/database.js';

export const getConversations = (req, res) => {
    try {
        const conversations = queries.getConversations.all();
        res.json(conversations);
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la récupération des conversations',
            details: error.message 
        });
    }
};

export const createConversation = (req, res) => {
    try {
        const now = new Date().toISOString();
        const result = queries.insertConversation.run('', now);
        const id = result.lastInsertRowid;
        res.json({ id });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la création de la conversation',
            details: error.message 
        });
    }
};

export const getLatestVersion = (req, res) => {
    try {
        const conversationId = req.params.id;
        const latestVersion = queries.getLatestVersionGroup.get(conversationId);
        
        if (!latestVersion) {
            return res.json({ message: 'Aucun groupe de versions disponible' });
        }

        res.json({ 
            versionId: latestVersion.id,
            timestamp: latestVersion.timestamp
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la récupération du groupe de versions',
            details: error.message 
        });
    }
};

export const getVersionMessages = (req, res) => {
    try {
        const versionId = req.params.id;
        const messages = queries.getMessagesFromVersionGroup.all(versionId);
        
        const conversationId = db.prepare(`
            SELECT conversation_id FROM versions WHERE id = ?
        `).get(versionId).conversation_id;
        
        const messagesWithDivergence = messages.map(msg => {
            const allVersionsAtThisPoint = db.prepare(`
                WITH current_version_messages AS (
                    SELECT m.ordre, m.content, m.id as message_id
                    FROM messages m
                    JOIN message_versions mv ON mv.message_id = m.id
                    WHERE mv.version_id = ?
                    AND m.ordre <= ?
                    ORDER BY m.ordre ASC
                ),
                matching_versions AS (
                    SELECT DISTINCT v.id, v.timestamp
                    FROM versions v
                    WHERE v.conversation_id = ?
                    AND EXISTS (
                        SELECT 1
                        FROM json_each(v.version_group) je
                        JOIN messages m ON m.id = je.value
                        WHERE m.ordre = ?
                    )
                    AND NOT EXISTS (
                        SELECT 1
                        FROM current_version_messages cvm
                        WHERE cvm.ordre < ?
                        AND EXISTS (
                            SELECT 1
                            FROM json_each(v.version_group) je
                            JOIN messages m ON m.id = je.value
                            WHERE m.ordre = cvm.ordre
                            AND m.content != cvm.content
                        )
                    )
                )
                SELECT DISTINCT 
                    mv.version_id,
                    m.content,
                    v.timestamp
                FROM matching_versions v
                JOIN message_versions mv ON mv.version_id = v.id
                JOIN messages m ON m.id = mv.message_id
                WHERE m.ordre = ?
                ORDER BY v.timestamp ASC
            `).all(versionId, msg.ordre, conversationId, msg.ordre, msg.ordre, msg.ordre);

            const versionGroups = new Map();
            allVersionsAtThisPoint.forEach(version => {
                if (!versionGroups.has(version.content)) {
                    versionGroups.set(version.content, []);
                }
                versionGroups.get(version.content).push({
                    versionId: version.version_id,
                    timestamp: version.timestamp
                });
            });

            const availableVersions = Array.from(versionGroups.entries()).map(([content, versions]) => ({
                content,
                versions
            }));

            const isDivergencePoint = availableVersions.length > 1;
            
            return {
                ...msg,
                isDivergencePoint,
                availableVersions: isDivergencePoint ? availableVersions : []
            };
        });
        
        res.json({ messages: messagesWithDivergence });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la récupération des messages',
            details: error.message 
        });
    }
};

export const deleteConversation = (req, res) => {
    try {
        const conversationId = req.params.id;
        deleteConversationAndRelated(conversationId);
        res.json({ message: 'Conversation supprimée avec succès' });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la suppression',
            details: error.message 
        });
    }
};