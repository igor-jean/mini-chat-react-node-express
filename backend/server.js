import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';

// Initialisation de la base de données
const db = new Database('chat.db');

// Création des tables
db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT,
        role TEXT,
        content TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    );
`);

// Préparation des requêtes
const insertConversation = db.prepare('INSERT INTO conversations (id, title, timestamp) VALUES (?, ?, ?)');
const insertMessage = db.prepare('INSERT INTO messages (conversation_id, role, content, timestamp) VALUES (?, ?, ?, ?)');
const getConversation = db.prepare('SELECT * FROM conversations WHERE id = ?');
const getMessages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp');
const updateConversationTimestamp = db.prepare('UPDATE conversations SET timestamp = ? WHERE id = ?');
const deleteConversation = db.prepare('DELETE FROM conversations WHERE id = ?');
const deleteMessages = db.prepare('DELETE FROM messages WHERE conversation_id = ?');
const getConversations = db.prepare(`
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
`);

// Configuration de base du serveur Express
// --------------------------------------
// Initialisation d'Express et des middlewares
const app = express();
app.use(cors());
app.use(express.json());

// Gestion des données
// -----------------
// Stockage en mémoire des conversations avec Map()

// Route POST pour le chat
app.post('/chat', async (req, res) => {
    try {
        const { message, sessionId } = req.body;
        const currentSessionId = sessionId || uuidv4();
        const now = new Date().toISOString();

        // Vérifier si la conversation existe
        let conversation = getConversation.get(currentSessionId);
        if (!conversation) {
            // Créer nouvelle conversation
            insertConversation.run(currentSessionId, '', now);
            conversation = { id: currentSessionId, title: '' };
        }

        // Récupérer les messages existants
        const messages = getMessages.all(currentSessionId);

        // Définir le titre si c'est le premier message
        if (messages.length === 0 && !conversation.title) {
            const title = message.length > 25 ? message.substring(0, 25) + '...' : message;
            db.prepare('UPDATE conversations SET title = ? WHERE id = ?').run(title, currentSessionId);
        }

        // Ajouter le message de l'utilisateur
        insertMessage.run(currentSessionId, 'user', message, now);

        // Construire le contexte complet avec l'historique
        const conversationContext = messages
            .map(msg => `<|start_header_id|>${msg.role}<|end_header_id|>${msg.content}<|eot_id|>`)
            .join('\n');
        
        // Modification du format du prompt pour suivre la documentation Llama
        const fullPrompt = `<|start_header_id|>system<|end_header_id|>
                Je suis MiniChat, une intelligence artificielle créée par Igor.  
                Je suis un expert généraliste, compétent dans une large variété de domaines.

                **Directives pour mes réponses** :  
                - **Langue et clarté** :  
                - Je réponds TOUJOURS en français, de manière claire et précise.  
                - J'utilise un ton courtois, professionnel et adapté à chaque contexte.  

                - **Structure et style** :  
                - Je structure mes réponses en utilisant des titres, paragraphes, et listes formatées en **Markdown**.
                - **Important** : J'utilise les balises de code (\`\`\` ou \`<code>\`) UNIQUEMENT lorsque je fournis un extrait de code ou un exemple technique.
                - J'insère des retours à la ligne entre les étapes ou idées importantes.  

                - **Véracité des informations** :  
                - Je m'assure que mes réponses sont exactes et bien documentées.  
                - Si je ne suis pas certain d'une information, je l'admets et propose des pistes de recherche.

                - **Contexte utilisateur** :  
                - Je mémorise les informations clés partagées par l'utilisateur (nom, centres d'intérêt, etc.) pour adapter mes réponses.  
                - Si l'utilisateur me demande son nom ou d'autres données qu'il m'a fournies, je les restitue avec précision.  

                - **Limites** :  
                - Je ne prétends JAMAIS être humain. Je suis une IA honnête et transparente.  
                - En cas de malentendu ou d'erreur, je corrige ma réponse immédiatement.  

                <|eot_id|>

                ${conversationContext}

                <|start_header_id|>user<|end_header_id|>${message}<|eot_id|>
                <|start_header_id|>assistant<|end_header_id|>
                `;

        // Appel au serveur llama
        const llamaResponse = await fetch('http://localhost:8080/completion', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: fullPrompt,
                temperature: 0.7,
                cpu_threads: 4,
                top_p: 0.95,
                min_p: 0.05,
                top_k: 30,
                n_predict: 2048,
                truncation_length: 8076, 
                truncation_strategy: 1,
                repeat_penalty: 1.2,
                presence_penalty: 0.3,
                frequency_penalty: 0.3,
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
        insertMessage.run(currentSessionId, 'assistant', cleanResponse, now);
        
        // Mettre à jour le timestamp de la conversation
        updateConversationTimestamp.run(now, currentSessionId);

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
app.post('/reset/:id', async (req, res) => {
    try {
        const conversationId = req.params.id;
        
        if (!conversationId) {
            return res.status(400).json({ 
                error: 'ID de conversation requis' 
            });
        }

        // Vérifier si la conversation existe
        const conversation = getConversation.get(conversationId);
        if (!conversation) {
            return res.status(404).json({ 
                error: 'Conversation non trouvée' 
            });
        }

        // Supprimer les messages d'abord (à cause de la clé étrangère)
        deleteMessages.run(conversationId);

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
        const id = uuidv4();
        const now = new Date().toISOString();
        insertConversation.run(id, '', now);
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
        const conversations = getConversations.all();
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
        
        // Récupérer la conversation depuis la base de données
        const conversation = getConversation.get(conversationId);
        
        if (!conversation) {
            return res.status(404).json({ 
                error: 'Conversation non trouvée' 
            });
        }

        // Récupérer les messages de la conversation
        const messages = getMessages.all(conversationId);

        res.json({
            id: conversationId,
            title: conversation.title,
            messages: messages.map(msg => ({
                role: msg.role,
                content: msg.content,
                timestamp: msg.timestamp
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
app.delete('/conversations/:id', (req, res) => {
    try {
        const conversationId = req.params.id;
        
        // Supprimer les messages d'abord (à cause de la clé étrangère)
        deleteMessages.run(conversationId);
        // Puis supprimer la conversation
        deleteConversation.run(conversationId);
        
        res.json({ message: 'Conversation supprimée avec succès' });
    } catch (error) {
        console.error('Erreur:', error);
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