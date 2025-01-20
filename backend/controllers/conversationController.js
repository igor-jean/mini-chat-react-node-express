import { queries, deleteConversationAndRelated, db } from '../db/database.js';

/**
 * Récupère toutes les conversations existantes
 * - Retourne la liste complète des conversations
 * - Gère les erreurs de récupération
 */
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

/**
 * Crée une nouvelle conversation
 * - Initialise une conversation vide avec un horodatage
 * - Retourne l'ID de la nouvelle conversation créée
 */
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

/**
 * Récupère la dernière version d'une conversation
 * - Identifie le groupe de versions le plus récent
 * - Retourne l'ID de version et l'horodatage
 * - Gère le cas où aucune version n'existe
 */
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

/**
 * Récupère les messages d'une version spécifique
 * - Extrait tous les messages associés à une version
 * - Identifie les points de divergence dans l'historique
 * - Fournit les versions alternatives disponibles
 * - Gère la structure complexe des versions et divergences
 */
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

/**
 * Supprime une conversation et ses données associées
 * - Efface la conversation et tous ses messages
 * - Nettoie les versions et relations associées
 * - Assure une suppression complète et cohérente
 */
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

/**
 * Met à jour le titre d'une conversation
 * - Valide que le titre n'est pas vide
 * - Met à jour le titre dans la base de données
 * - Retourne le nouveau titre après mise à jour
 */
export const updateConversationTitle = (req, res) => {
    try {
        const conversationId = req.params.id;
        const { title } = req.body;
        
        if (!title || title.trim() === '') {
            return res.status(400).json({ 
                error: 'Le titre ne peut pas être vide' 
            });
        }

        db.prepare('UPDATE conversations SET title = ? WHERE id = ?')
          .run(title.trim(), conversationId);

        res.json({ 
            message: 'Titre mis à jour avec succès',
            title: title.trim()
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la mise à jour du titre',
            details: error.message 
        });
    }
};