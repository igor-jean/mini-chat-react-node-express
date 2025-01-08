import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { db, queries, insertNewMessage, checkMessageVersions } from './database.js';
import { LLAMA_PARAMS, buildPrompt } from './llamaConfig.js';

// Configuration de base du serveur Express
const app = express();
app.use(cors());
app.use(express.json());

// Route POST pour le chat
app.post('/chat', async (req, res) => {
    try {
        let { message, conversationId, versionNumber } = req.body;
        const now = new Date().toISOString();

        // Vérifier si la conversation existe
        let conversation = queries.getConversation.get(conversationId);
        if (!conversation) {
            // Créer nouvelle conversation
            const result = queries.insertConversation.run('', now);
            conversationId = result.lastInsertRowid;
            conversation = { title: '' };
        }

        console.log(versionNumber);

        // Récupérer les messages existants avec version_number = versionNumber
        const messages = queries.getMessages.all(conversationId).filter(msg => msg.version_number === versionNumber);

        // Définir le titre si c'est le premier message
        if (messages.length === 0 && !conversation.title) {
            const title = message.length > 25 ? message.substring(0, 25) + '...' : message;
            queries.updateConversationTitle.run(title, conversationId);
        }

        // Ajouter le message de l'utilisateur
        const userMessageId = insertNewMessage(conversationId, 'user', message, now, versionNumber);

        // Construire le contexte avec uniquement les messages version 1
        const conversationContext = messages
            .map(msg => `<|start_header_id|>${msg.role}<|end_header_id|>${msg.content}<|eot_id|>`)
            .join('\n');
        
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
        const assistantMessageId = insertNewMessage(conversationId, 'assistant', cleanResponse, now, versionNumber);
        
        // Mettre à jour le timestamp de la conversation
        queries.updateConversationTimestamp.run(now, conversationId);

        res.json({ 
            response: cleanResponse,
            conversationId: conversationId
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
        
        // Supprimer les messages d'abord (à cause de la clé étrangère)
        queries.deleteMessages.run(conversationId);
        // Puis supprimer la conversation
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
            SELECT conversation_id, ordre
            FROM messages 
            WHERE id = ?
        `).get(messageId);

        // Récupérer la dernière version
        const lastVersion = queries.getLastVersionNumber.get(
            originalMessage.conversation_id, 
            originalMessage.ordre
        );
        const newVersionNumber = (lastVersion?.version_number || 0) + 1;

        // Insérer la nouvelle version du message utilisateur
        queries.insertMessageVersion.run(
            content,
            newVersionNumber,
            messageId
        );
        
        // Construire le contexte pour l'assistant
        const messages = queries.getMessages.all(originalMessage.conversation_id)
            .filter(msg => msg.version_number === newVersionNumber);

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

        // Insérer la réponse de l'assistant avec la même version
        queries.insertMessage.run(
            originalMessage.conversation_id,
            'assistant',
            cleanResponse,
            now,
            originalMessage.ordre + 1,
            newVersionNumber
        );

        res.json({ 
            messageId, 
            versionNumber: newVersionNumber,
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

        // Utiliser la nouvelle fonction checkMessageVersions
        const versionsInfo = checkMessageVersions(messageInfo.conversation_id, messageInfo.ordre);
        
        res.json({
            messageId,
            hasMultipleVersions: versionsInfo.hasMultipleVersions,
            versionsCount: versionsInfo.count,
            versions: versionsInfo.versions
        });

    } catch (error) {
        console.error('Erreur lors de la récupération des versions:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la récupération des versions',
            details: error.message 
        });
    }
});

// Route pour récupérer une version spécifique
app.get('/messages/:messageId/versions/:versionNumber', (req, res) => {
    try {
        const { messageId, versionNumber } = req.params;
        
        const version = queries.getMessageVersion.get(messageId, versionNumber);

        if (!version) {
            return res.status(404).json({ 
                error: 'Version non trouvée' 
            });
        }

        res.json(version);
    } catch (error) {
        console.error('Erreur lors de la récupération de la version:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la récupération de la version',
            details: error.message 
        });
    }
});

// Route pour créer une nouvelle version d'un message
app.post('/messages/version', async (req, res) => {
    try {
        const { conversation_id, ordre, content } = req.body;

        // Utiliser la requête préparée existante au lieu d'en créer une nouvelle
        const lastVersion = queries.getLastVersionNumber.get(conversation_id, ordre);

        const newVersionNumber = (lastVersion?.version_number || 0) + 1;

        // Insérer la nouvelle version du message
        const result = queries.insertMessage.run(
            conversation_id,
            'user',
            content,
            new Date().toISOString(),
            ordre,
            newVersionNumber
        );

        res.json({ 
            id: result.lastInsertRowid,
            version_number: newVersionNumber,
            ordre: ordre
        });

    } catch (error) {
        console.error('Erreur lors de la création de la nouvelle version:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la création de la nouvelle version',
            details: error.message 
        });
    }
});

// Route pour charger une version spécifique de la conversation
app.get('/conversation/:id/version/:versionNumber', (req, res) => {
    try {
        const { id: conversationId, versionNumber } = req.params;
        const conversation = queries.getConversation.get(conversationId);
        
        if (!conversation) {
            return res.status(404).json({ error: 'Conversation non trouvée' });
        }

        // Récupérer tous les messages de cette version
        const messages = queries.getMessagesForVersion.all(conversationId, versionNumber);

        const messagesWithVersionInfo = messages.map(msg => {
            const versionsInfo = checkMessageVersions(conversationId, msg.ordre);
            return {
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp,
                ordre: msg.ordre,
                id: msg.id,
                totalVersions: versionsInfo.count,
                currentVersion: parseInt(versionNumber)
            };
        });

        res.json({
            id: conversationId,
            title: conversation.title,
            messages: messagesWithVersionInfo,
            currentVersion: parseInt(versionNumber)
        });
    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération' });
    }
});

// Démarrage du serveur sur le port 3001
app.listen(3001, () => {
    console.log('Serveur démarré sur le port 3001');
});