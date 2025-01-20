# Mini Chat React Node Express

Une application de chat minimaliste utilisant React pour le frontend et Node.js/Express pour le backend, avec un modèle d'IA Llama.

## Fonctionnalités

-   Interface de chat en temps réel
-   Streaming des réponses de l'IA en temps réel
-   Contrôle de la vitesse d'affichage du texte
-   Gestion de multiples conversations
-   Suppression de conversations
-   Historique des messages par conversation
-   Support de la coloration syntaxique pour le code
-   Modification des messages avec streaming de la nouvelle réponse
-   Versionnage des messages
-   Défilement automatique intelligent pendant le streaming

## Architecture

### Frontend (React)

-   **Technologies principales** :

    -   React 19
    -   Tailwind CSS
    -   Lucide React
    -   React Markdown
    -   React Spinners
    -   Styled Components
    -   Rehype Highlight

-   **Structure** :
    ```
    frontend/src/
    ├── components/          # Composants React
    │   ├── ChatBox.jsx     # Affichage des messages avec gestion du défilement
    │   ├── Message.jsx     # Composant de message avec support du streaming
    │   └── MessageInput.jsx # Saisie des messages
    ├── services/           # Services pour les appels API
    │   └── api.js         # Configuration et fonctions d'appel API avec streaming
    ├── hooks/             # Hooks personnalisés
    │   └── useChat.js     # Logique de gestion du chat et du streaming
    ├── styles/            # Styles globaux
    │   └── globals.css
    └── App.js             # Composant principal
    ```

### Backend (Node.js/Express)

-   **Technologies principales** :

    -   Express.js
    -   Node Llama CPP
    -   SQLite (better-sqlite3)
    -   Node NLP
    -   UUID
    -   Tiktoken

-   **Structure** :
    ```
    backend/
    ├── config/            # Configuration
    │   ├── llamaConfig.js # Configuration du modèle Llama et streaming
    │   └── nlpConfig.js   # Configuration NLP
    ├── controllers/       # Contrôleurs
    │   ├── chatController.js      # Logique du chat avec streaming SSE
    │   └── conversationController.js # Gestion des conversations
    ├── db/               # Base de données
    │   └── database.js   # Configuration SQLite et requêtes
    ├── routes/           # Routes Express
    │   ├── chatRoutes.js         # Routes du chat avec support SSE
    │   └── conversationRoutes.js # Routes des conversations
    ├── services/         # Services
    │   └── llamaService.js # Service Llama avec streaming
    └── server.js         # Point d'entrée du serveur
    ```

## Fonctionnement du Streaming

### Backend

-   Utilisation des Server-Sent Events (SSE) pour le streaming
-   Génération progressive des réponses via l'API Llama
-   Envoi des chunks de texte en temps réel au frontend

### Frontend

-   Gestion du streaming via l'API Fetch et ReadableStream
-   Affichage progressif du texte avec délai configurable
-   Défilement automatique intelligent pendant le streaming
-   Support du streaming pour les nouveaux messages et les modifications

### Configuration du Streaming

-   Délai d'affichage configurable (DISPLAY_DELAY dans useChat.js)
-   Défilement automatique intelligent pendant le streaming
-   Gestion des états de streaming dans les composants

## API Backend

### Routes de Chat (`/routes/chatRoutes.js`)

-   **POST /chat**

    -   Traite un nouveau message
    -   Génère une réponse via Llama
    -   Gère les versions des messages

-   **PUT /messages/:messageId**

    -   Modifie un message existant
    -   Régénère la réponse

-   **GET /messages/:messageId/versions**
    -   Récupère les versions d'un message

### Routes de Conversation (`/routes/conversationRoutes.js`)

-   **GET /conversations**

    -   Liste toutes les conversations

-   **POST /conversations**

    -   Crée une nouvelle conversation

-   **GET /conversations/:id/latest-version**

    -   Récupère la dernière version d'une conversation

-   **GET /versions/:id/messages**

    -   Récupère les messages d'une version

-   **DELETE /conversations/:id**

    -   Supprime une conversation

-   **POST /reset/:id**
    -   Réinitialise une conversation

## Configuration du modèle d'IA

Le modèle est configuré dans `config/llamaConfig.js` avec les paramètres suivants :

-   temperature: 0.3 # Contrôle la créativité/randomisation des réponses (plus élevé = plus aléatoire)
-   top_p: 0.92 # Sampling avec noyau dynamique (seuil de probabilité cumulée)
-   min_p: 0.05 # Probabilité minimale pour qu'un token soit considéré
-   top_k: 40 # Nombre maximum de tokens considérés à chaque étape
-   n_predict: 2048 # Nombre maximum de tokens à générer
-   truncation_length: 8192 # Longueur maximale du contexte en tokens
-   repeat_penalty: 1.15 # Pénalité pour la répétition de tokens
-   presence_penalty: 0.35 # Pénalise les tokens déjà présents dans le texte
-   frequency_penalty: 0.35 # Pénalise les tokens fréquemment utilisés

## Installation

### Prérequis

-   Node.js v16+
-   npm ou yarn
-   CUDA Toolkit (pour l'accélération GPU)
-   Le modèle Llama (fichier .gguf)
-   llama.cpp (serveur)

### Configuration

1. **Téléchargement du modèle** :

    - Téléchargez le modèle Llama quantifié (llama-3.2-1b-instruct-q8_0.gguf) depuis Hugging Face
    - Placez-le dans le dossier `models/`

2. **Installation de llama.cpp** :
    - Téléchargez la version pré-compilée pour CUDA depuis les releases GitHub
    - Extrayez llama-server.exe dans le dossier `llama.cpp/`

### Démarrage

1. **Serveur Llama.cpp** :

```bash
cd llama.cpp
.\llama-server.exe --model ../models/llama-3.2-1b-instruct-q8_0.gguf --ctx-size 8076 --n-gpu-layers 35 --port 8080
```

2. **Serveur Backend** :

```bash
cd backend
npm install
node server.js
```

3. **Application Frontend** :

```bash
cd frontend
npm install
npm start
```
