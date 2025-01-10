import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { db, queries, insertNewMessage, calculateTokens, createNewVersionGroup } from './database.js';
import { LLAMA_PARAMS, buildPrompt } from './llamaConfig.js';

// Configuration de base du serveur Express
const app = express();
app.use(cors());
app.use(express.json());

// Route POST pour le chat
app.post('/chat', async (req, res) => {
    try {
        let { message, conversationId, versionId } = req.body;
        const now = new Date().toISOString();

        // Vérifier si la conversation existe
        let conversation = queries.getConversation.get(conversationId);
        if (!conversation) {
            // Créer nouvelle conversation
            const result = queries.insertConversation.run('', now);
            conversationId = result.lastInsertRowid;
            conversation = { title: '' };
        }

        // Définir le titre si c'est le premier message
        if (!conversation.title) {
            const title = message.length > 25 ? message.substring(0, 25) + '...' : message;
            queries.updateConversationTitle.run(title, conversationId);
        }

        // Ajouter le message de l'utilisateur
        const userMessageId = insertNewMessage(conversationId, 'user', message, now);

        // Construire le contexte pour l'assistant
        let conversationContext = '';
        if (versionId) {
            // Si un groupe de versions est spécifié, utiliser ses messages
            const messages = queries.getMessagesFromVersionGroup.all(versionId);
            conversationContext = messages
                .map(msg => `<|start_header_id|>${msg.role}<|end_header_id|>${msg.content}<|eot_id|>`)
                .join('\n');
        }
        
        // Modification du format du prompt pour suivre la documentation Llama
        const fullPrompt = buildPrompt(conversationContext, message);

        // Appel au serveur llama
        const llamaResponse = await fetch('http://localhost:8080/completion', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: fullPrompt,
                ...LLAMA_PARAMS
            })
        });

        const data = await llamaResponse.json();
        
        // Modification du nettoyage de la réponse
        const cleanResponse = data.content
            .replace(/<\|eot_id\|>.*$/s, '')
            .replace(/<\|start_header_id\|>.*?<\|end_header_id\|>/g, '')
            .trim();
        
        // Ajouter la réponse à l'historique
        const assistantMessageId = insertNewMessage(conversationId, 'assistant', cleanResponse, now);
        
        // Mettre à jour le timestamp de la conversation
        queries.updateConversationTimestamp.run(now, conversationId);

        // Récupérer le dernier groupe de versions (qui inclut la réponse)
        const finalVersion = queries.getLatestVersionGroup.get(conversationId);

        res.json({ 
            response: cleanResponse,
            conversationId: conversationId,
            userMessageId: userMessageId,
            assistantMessageId: assistantMessageId,
            versionId: finalVersion.id
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ 
            error: 'Erreur lors de l\'exécution',
            details: error.message 
        });
    }
});

// Route pour réinitialiser une conversation
app.post('/reset/:id', async (req, res) => {
    try {
        const conversationId = req.params.id;
        
        if (!conversationId) {
            return res.status(400).json({ 
                error: 'ID de conversation requis' 
            });
        }

        // Vérifier si la conversation existe
        const conversation = queries.getConversation.get(conversationId);
        if (!conversation) {
            return res.status(404).json({ 
                error: 'Conversation non trouvée' 
            });
        }

        // Supprimer les messages d'abord (à cause de la clé étrangère)
        queries.deleteMessages.run(conversationId);

        res.json({ message: 'Session réinitialisée avec succès' });
    } catch (error) {
        console.error('Erreur lors de la réinitialisation:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la réinitialisation',
            details: error.message 
        });
    }
});

// Modifier la route pour créer une nouvelle conversation
app.post('/conversations', (req, res) => {
    try {
        const now = new Date().toISOString();
        // On insère une nouvelle conversation avec un titre vide
        const result = queries.insertConversation.run('', now);
        // On récupère l'ID généré automatiquement
        const id = result.lastInsertRowid;
        res.json({ id });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la création de la conversation',
            details: error.message 
        });
    }
});

// Après les routes existantes, ajoutez la route GET pour les conversations
app.get('/conversations', (req, res) => {
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
});

// Ajouter une route pour récupérer les messages d'une conversation spécifique
app.get('/conversation/:id', (req, res) => {
    try {
        const conversationId = req.params.id;
        const conversation = queries.getConversation.get(conversationId);
        
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation non trouvée' });
        }

        // Récupérer les messages sans filtrer
        const messages = queries.getMessages.all(conversationId);

        // Pour chaque message, récupérer le nombre total de versions
        const messagesWithVersionInfo = messages.map(msg => {
            const versionsInfo = checkMessageVersions(conversationId, msg.ordre);
            return {
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp,
                ordre: msg.ordre,
                id: msg.id,
                totalVersions: versionsInfo.count,
                currentVersion: msg.version_number
            };
        });

        res.json({
            id: conversationId,
            title: conversation.title,
            messages: messagesWithVersionInfo
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération' });
    }
});

// Modifier la route de suppression
app.delete('/conversations/:id', (req, res) => {
    try {
        const conversationId = req.params.id;
        
        // Supprimer d'abord les associations message-version
        queries.deleteMessageVersions.run(conversationId);
        
        // Puis supprimer les versions
        queries.deleteVersions.run(conversationId);
        
        // Ensuite supprimer les messages
        queries.deleteMessages.run(conversationId);
        
        // Enfin supprimer la conversation
        queries.deleteConversation.run(conversationId);
        
        res.json({ message: 'Conversation supprimée avec succès' });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la suppression',
            details: error.message 
        });
    }
});

// route pour modifier un message
app.put('/messages/:messageId', async (req, res) => {
    try {
        const { messageId } = req.params;
        const { content } = req.body;
        const now = new Date().toISOString();

        // Récupérer les informations du message original
        const originalMessage = db.prepare(`
            SELECT conversation_id, ordre, role
            FROM messages 
            WHERE id = ?
        `).get(messageId);

        if (!originalMessage) {
            return res.status(404).json({ error: 'Message non trouvé' });
        }

        // Récupérer le groupe de versions actuel
        const currentVersion = queries.getLatestVersionGroup.get(originalMessage.conversation_id);
        if (!currentVersion) {
            return res.status(404).json({ error: 'Groupe de versions non trouvé' });
        }

        const currentGroup = JSON.parse(currentVersion.version_group);
        const messageIndex = currentGroup.indexOf(parseInt(messageId));

        if (messageIndex === -1) {
            return res.status(404).json({ error: 'Message non trouvé dans le groupe de versions' });
        }

        // Créer le nouveau message modifié
        const nbTokens = calculateTokens(content);
        const newMessageId = queries.insertMessage.run(
            originalMessage.conversation_id,
            originalMessage.role,
            content,
            now,
            originalMessage.ordre,
            nbTokens
        ).lastInsertRowid;

        // Préparer le nouveau groupe de versions
        let newGroup;
        if (messageIndex === 0) {
            // Si c'est le premier message, on crée une version avec juste ce message et sa réponse
            newGroup = [newMessageId];
        } else {
            // Sinon, on garde tous les messages précédents et on ajoute le message modifié
            newGroup = [...currentGroup.slice(0, messageIndex), newMessageId];
        }

        // Construire le contexte pour l'assistant
        const messages = newGroup.map(id => {
            return db.prepare('SELECT role, content FROM messages WHERE id = ?').get(id);
        });

        const conversationContext = messages
            .map(msg => `<|start_header_id|>${msg.role}<|end_header_id|>${msg.content}<|eot_id|>`)
            .join('\n');

        const fullPrompt = buildPrompt(conversationContext, content);

        // Appel au serveur llama
        const llamaResponse = await fetch('http://localhost:8080/completion', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: fullPrompt,
                ...LLAMA_PARAMS
            })
        });

        const data = await llamaResponse.json();
        const cleanResponse = data.content
            .replace(/<\|eot_id\|>.*$/s, '')
            .replace(/<\|start_header_id\|>.*?<\|end_header_id\|>/g, '')
            .trim();

        // Créer la nouvelle réponse de l'assistant
        const assistantNbTokens = calculateTokens(cleanResponse);
        const assistantMessageId = queries.insertMessage.run(
            originalMessage.conversation_id,
            'assistant',
            cleanResponse,
            now,
            originalMessage.ordre + 1,
            assistantNbTokens
        ).lastInsertRowid;

        // Ajouter la réponse au groupe
        newGroup.push(assistantMessageId);

        // Si le message modifié n'était pas le dernier, ajouter les messages suivants
        if (messageIndex + 2 < currentGroup.length) {
            newGroup.push(...currentGroup.slice(messageIndex + 2));
        }

        // Créer la version finale avec tous les messages
        const finalVersionId = createNewVersionGroup(originalMessage.conversation_id, newGroup);

        res.json({ 
            messageId: newMessageId,
            assistantMessageId,
            versionId: finalVersionId,
            timestamp: now,
            assistantResponse: cleanResponse
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la modification',
            details: error.message 
        });
    }
});

// Route pour récupérer les versions d'un message
app.get('/messages/:messageId/versions', (req, res) => {
    try {
        const { messageId } = req.params;
        
        // D'abord, récupérer les informations du message
        const messageInfo = db.prepare(`
            SELECT conversation_id, ordre 
            FROM messages 
            WHERE id = ?
        `).get(messageId);

        if (!messageInfo) {
            return res.status(404).json({ 
                error: 'Message non trouvé' 
            });
        }

        // Récupérer les versions disponibles
        const versions = queries.getMessageVersions.all(messageInfo.ordre, messageInfo.conversation_id);
        
        res.json({
            messageId,
            versions: versions.map(v => ({
                versionId: v.version_id,
                timestamp: v.timestamp,
                content: v.content
            }))
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la récupération des versions',
            details: error.message 
        });
    }
});

// Route pour récupérer le dernier groupe de versions d'une conversation
app.get('/conversations/:id/latest-version', (req, res) => {
    try {
        const conversationId = req.params.id;
        const latestVersion = queries.getLatestVersionGroup.get(conversationId);
        
        if (!latestVersion) {
            return res.status(404).json({ error: 'Aucun groupe de versions trouvé' });
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
});

// Route pour récupérer les messages d'un groupe de versions
app.get('/versions/:id/messages', (req, res) => {
    try {
        const versionId = req.params.id;
        const messages = queries.getMessagesFromVersionGroup.all(versionId);
        
        // Pour chaque message, récupérer les versions disponibles et identifier les points de divergence
        const messagesWithVersions = messages.map(msg => {
            const versions = queries.getMessageVersions.all(msg.ordre, msg.conversation_id);
            
            // Un message est un point de divergence seulement s'il a été modifié
            // et que ses versions ont des contenus différents
            const isDivergencePoint = versions.length > 1 && versions.some(v => v.content !== msg.content);
            
            // Pour chaque version, récupérer les messages qui suivent
            const versionsWithContext = versions.map(v => {
                const versionMessages = queries.getMessagesFromVersionGroup.all(v.version_id);
                const startIndex = versionMessages.findIndex(m => m.ordre === msg.ordre);
                return {
                    versionId: v.version_id,
                    timestamp: v.timestamp,
                    // Inclure les messages qui suivent dans cette version
                    subsequentMessages: versionMessages.slice(startIndex)
                };
            });

            return {
                ...msg,
                isDivergencePoint,
                availableVersions: isDivergencePoint ? versionsWithContext : []
            };
        });

        res.json({ messages: messagesWithVersions });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la récupération des messages',
            details: error.message 
        });
    }
});

// Démarrage du serveur sur le port 3001
app.listen(3001, () => {
    console.log('Serveur démarré sur le port 3001');
});