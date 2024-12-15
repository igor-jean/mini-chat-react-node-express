// Import des modules nécessaires
import express from 'express';  // Framework web pour Node.js
import cors from 'cors';        // Permet les requêtes cross-origin
import { LlamaModel, LlamaContext, LlamaChatSession } from 'node-llama-cpp';  // Bibliothèque pour utiliser le modèle Llama
import path from 'path';        // Gestion des chemins de fichiers
import { fileURLToPath } from 'url';  // Conversion des URLs en chemins de fichiers

// Configuration des chemins pour ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Création de l'application Express
const app = express();

// Middleware pour permettre le CORS et parser le JSON
app.use(cors());
app.use(express.json());

// Configuration du modèle d'IA
const model = new LlamaModel({
    modelPath: path.resolve(__dirname, '..', 'models', 'mistral-7b-v0.1.Q4_K_M.gguf'),  // Chemin vers le fichier du modèle
    enableLogging: true,      // Active les logs
    contextSize: 8192,        // Taille du contexte en tokens
    threads: 8,               // Nombre de threads pour le traitement
    batchSize: 512,          // Taille du lot pour le traitement
    mainGpu: 0,              // Utilisation du GPU principal
    embeddingMode: false,    // Mode embedding désactivé
    gpuLayers: 32,           // Nombre de couches sur GPU
    defaultContextFlashAttention: true  // Optimisation de l'attention
});

// Création du contexte pour le modèle
const context = new LlamaContext({ 
    model,
    contextSize: 8192,
    flashAttention: true     // Optimisation de l'attention
});

// Création de la session de chat
let session = new LlamaChatSession({ 
    context,
    temperature: 0.7,        // Contrôle la créativité des réponses
    topK: 50,                // Limite le nombre de tokens considérés
    topP: 0.95,              // Contrôle la diversité des réponses
    maxTokens: 1024,         // Nombre maximum de tokens générés
});

// Route POST pour le chat
app.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;  // Récupération du message de l'utilisateur
        
        // Si c'est le début de la conversation, initialisation avec un prompt système
        if (!session.context) {
            const initialPrompt = `<system>
                Vous êtes un assistant virtuel français expert et compétent dans de nombreux domaines.
                Vous devez TOUJOURS fournir une réponse utile et détaillée.
                Ne dites JAMAIS que vous ne pouvez pas aider ou que vous n'avez pas accès aux informations.
                
                Instructions importantes :
                1. Répondez TOUJOURS en français
                2. Gardez un ton professionnel mais accessible
                3. Si vous n'êtes pas sûr, admettez-le honnêtement
                4. Structurez vos réponses de manière claire et lisible
                5. Utilisez des paragraphes et des listes quand c'est pertinent

                ### Début de la conversation :
            `;

            await session.prompt(initialPrompt);
        }

        // Formatage du message utilisateur
        const userPrompt = `<input>${message}<completion>`;

        // Génération de la réponse avec des paramètres spécifiques
        const response = await session.prompt(userPrompt, {
            temperature: 0.8,
            topK: 50,
            topP: 0.95,
            maxTokens: 2048,
            stop: ["###", "<input>", "<system>"],  // Tokens d'arrêt
            repeatPenalty: 1.3,     // Pénalité pour les répétitions
            presencePenalty: 0.3,   // Pénalité pour la présence de certains tokens
            frequencyPenalty: 0.4   // Pénalité pour la fréquence des tokens
        });

        // Nettoyage de la réponse (suppression des balises et formatage)
        const cleanResponse = response
            .replace(/###.*$/s, '')
            .replace(/^\d+\.?\s*/, '')
            .replace(/<output>|<\/output>|<input>|<completion>|<\/completion>/g, '')
            .trim();
        
        // Vérification de la qualité de la réponse
        if (!cleanResponse || cleanResponse.length < 5 || /^\d+$/.test(cleanResponse)) {
            res.json({ 
                response: "Je m'excuse, je n'ai pas pu générer une réponse cohérente. Pourriez-vous reformuler votre question ?" 
            });
            return;
        }
        
        // Envoi de la réponse au client
        res.json({ response: cleanResponse });
    } catch (error) {
        // Gestion des erreurs
        console.error('Erreur:', error);
        res.status(500).json({ 
            error: 'Erreur lors de l\'exécution',
            details: error.message 
        });
    }
});

// Ajoutez cette route après la route '/chat'
app.post('/reset', async (req, res) => {
    try {
        // Création d'une nouvelle session
        session = new LlamaChatSession({ 
            context,
            temperature: 0.7,
            topK: 50,
            topP: 0.95,
            maxTokens: 1024,
        });
        
        res.json({ message: 'Session réinitialisée avec succès' });
    } catch (error) {
        console.error('Erreur lors de la réinitialisation:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la réinitialisation',
            details: error.message 
        });
    }
});

// Démarrage du serveur sur le port 3001
app.listen(3001, () => {
    console.log('Serveur démarré sur le port 3001');
});