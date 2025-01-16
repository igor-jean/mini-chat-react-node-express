import express from 'express';
import cors from 'cors';
import chatRoutes from './routes/chatRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';

// Configuration de base du serveur Express
const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/', chatRoutes);
app.use('/', conversationRoutes);

// Démarrage du serveur sur le port 3001
app.listen(3001, () => {
    console.log('Serveur en cours d\'exécution sur le port 3001');
});