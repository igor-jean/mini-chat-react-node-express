import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

// Configuration de base du serveur Express
// --------------------------------------
// Initialisation d'Express et des middlewares
const app = express();
app.use(cors());
app.use(express.json());

// Gestion des données
// -----------------
// Stockage en mémoire des conversations avec Map()
const conversations = new Map();

// Route POST pour le chat
app.post('/chat', async (req, res) => {
    try {
        const { message, sessionId } = req.body;
        
        // Générer un nouveau sessionId si aucun n'est fourni
        const currentSessionId = sessionId || uuidv4();
        
        // Récupérer ou créer l'historique de la conversation
        if (!conversations.has(currentSessionId)) {
            conversations.set(currentSessionId, {
                title: '', // Laisser le titre vide initialement
                messages: [],
                timestamp: new Date()
            });
        }
        const conversation = conversations.get(currentSessionId);
        
        // Si c'est le premier message et que le titre est vide, définir le titre
        if (conversation.messages.length === 0 && !conversation.title) {
            conversation.title = message.length > 25 
                ? message.substring(0, 25) + '...'
                : message;
        }
        
        // Ajouter le nouveau message à l'historique
        conversation.messages.push({ role: 'user', content: message });
        conversation.timestamp = new Date();
        
        // Construire le contexte complet avec l'historique
        const conversationContext = conversation.messages
            .map(msg => `<${msg.role}>${msg.content}</${msg.role}>`)
            .join('\n');
        
        // Modification du format du prompt pour suivre la documentation Llama
        const fullPrompt = `<|start_header_id|>system<|end_header_id|>
            Vous êtes MiniChat, une intelligence artificielle créée par Igor.  
            Vous êtes un expert généraliste, compétent dans une large variété de domaines.
            Vos réponses doivent TOUJOURS être en français, claires et précises.

            **Règles de réponse** :  
            - Répondez toujours de manière concise mais complète.  
            - Utilisez des listes et des paragraphes pour organiser l'information.  
            - Formatez vos réponses en **Markdown** (titres, listes à puces, gras, italique, etc.).  
            - Ajoutez un retour à la ligne entre chaque étape dans des explications ou recettes.  
            - Soyez courtois et professionnel.  
            - En cas d'incertitude, admettez-le honnêtement.  

            Ne prétendez jamais être humain. Vous êtes une IA honnête et fiable.
        <|eot_id|>

        ${conversation.messages.map(msg => 
            `<|start_header_id|>${msg.role}<|end_header_id|>${msg.content}<|eot_id|>`
        ).join('\n')}

        <|start_header_id|>user<|end_header_id|>${message}<|eot_id|>
        <|start_header_id|>assistant<|end_header_id|>`;

        // Appel au serveur llama
        const llamaResponse = await fetch('http://localhost:8080/completion', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: fullPrompt,
                temperature: 0.3,
                top_p: 0.90,
                top_k: 40,
                n_predict: 2048,
                repeat_penalty: 1.15,
                presence_penalty: 0.2,
                frequency_penalty: 0.2,
                stop: ["<|eot_id|>", "<|start_header_id|>"] // Nouveaux stop tokens
            })
        });

        const data = await llamaResponse.json();
        
        // Modification du nettoyage de la réponse
        const cleanResponse = data.content
            .replace(/<\|eot_id\|>.*$/s, '')
            .replace(/<\|start_header_id\|>.*?<\|end_header_id\|>/g, '')
            .trim();
        
        // Ajouter la réponse à l'historique
        conversation.messages.push({ role: 'assistant', content: cleanResponse });
        
        // Limiter la taille de l'historique
        if (conversation.messages.length > 10) {
            conversation.messages.splice(0, conversation.messages.length - 10);
        }
        
        res.json({ 
            response: cleanResponse,
            conversationId: currentSessionId
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
app.post('/reset', async (req, res) => {
    try {
        const { sessionId = 'default' } = req.body;
        conversations.delete(sessionId);
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
    const id = uuidv4();
    conversations.set(id, {
        title: '', // Laisser le titre vide initialement
        messages: [],
        timestamp: new Date()
    });
    res.json({ id });
});

// Après les routes existantes, ajoutez la route GET pour les conversations
app.get('/conversations', (req, res) => {
    try {
        const conversationsList = Array.from(conversations.entries()).map(([id, data]) => ({
            id,
            title: data.title,
            lastMessage: data.messages[data.messages.length - 1]?.content || '',
            timestamp: data.timestamp
        }));
        res.json(conversationsList);
    } catch (error) {
        console.error('Erreur lors de la récupération des conversations:', error);
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
        const conversation = conversations.get(conversationId);
        
        if (!conversation) {
            return res.status(404).json({ 
                error: 'Conversation non trouvée' 
            });
        }

        res.json({
            id: conversationId,
            title: conversation.title,
            messages: conversation.messages.map(msg => ({
                ...msg,
                timestamp: conversation.timestamp
            }))
        });
    } catch (error) {
        console.error('Erreur lors de la récupération de la conversation:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la récupération de la conversation',
            details: error.message 
        });
    }
});

// Modifier la route de suppression
app.delete('/conversations/:id', (req, res) => {  // Changement de 'conversation' à 'conversations'
    try {
        const conversationId = req.params.id;
        if (conversations.has(conversationId)) {
            conversations.delete(conversationId);
            res.json({ message: 'Conversation supprimée avec succès' });
        } else {
            res.status(404).json({ error: 'Conversation non trouvée' });
        }
    } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la suppression',
            details: error.message 
        });
    }
});

// Démarrage du serveur sur le port 3001
app.listen(3001, () => {
    console.log('Serveur démarré sur le port 3001');
});