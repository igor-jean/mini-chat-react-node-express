# Mini Chat React Node Express

Une application de chat minimaliste utilisant React pour le frontend et Node.js/Express pour le backend, avec un modèle d'IA Llama.

## Fonctionnalités

-   Interface de chat en temps réel
-   Gestion de multiples conversations
-   Suppression de conversations
-   Historique des messages par conversation
-   Support de la coloration syntaxique pour le code
-   Modification des messages
-   Versionnage des messages

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
    │   ├── ChatBox.jsx     # Affichage des messages
    │   ├── Message.jsx     # Composant de message individuel
    │   └── MessageInput.jsx # Saisie des messages
    ├── services/           # Services pour les appels API
    │   └── api.js         # Configuration et fonctions d'appel API
    ├── hooks/             # Hooks personnalisés
    │   └── useChat.js     # Logique de gestion du chat
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
    │   ├── llamaConfig.js # Configuration du modèle Llama
    │   └── nlpConfig.js   # Configuration NLP
    ├── controllers/       # Contrôleurs
    │   ├── chatController.js      # Logique du chat
    │   └── conversationController.js # Gestion des conversations
    ├── db/               # Base de données
    │   └── database.js   # Configuration SQLite et requêtes
    ├── routes/           # Routes Express
    │   ├── chatRoutes.js         # Routes du chat
    │   └── conversationRoutes.js # Routes des conversations
    ├── services/         # Services
    │   └── llamaService.js # Service Llama
    └── server.js         # Point d'entrée du serveur
    ```

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

-   temperature: 0.55
-   top_p: 0.92
-   min_p: 0.05
-   top_k: 40
-   n_predict: 2048
-   truncation_length: 8192
-   repeat_penalty: 1.15
-   presence_penalty: 0.35
-   frequency_penalty: 0.35

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
