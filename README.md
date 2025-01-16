# Mini Chat React Node Express

Une application de chat minimaliste utilisant React pour le frontend et Node.js/Express pour le backend, avec un modèle d'IA Llama.

## Fonctionnalités

-   Interface de chat en temps réel
-   Gestion de multiples conversations
-   Suppression de conversations
-   Historique des messages par conversation
-   Réinitialisation des conversations
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

### Backend (Node.js/Express)

-   **Technologies principales** :
    -   Express.js
    -   Node Llama CPP
    -   SQLite (better-sqlite3)
    -   Node NLP
    -   UUID
    -   Tiktoken

## API Backend

### GET /conversations

-   **Description** : Récupère la liste des conversations avec leurs derniers messages
-   **Implémentation** : Utilise `queries.getConversations.all()` qui joint les tables conversations et messages
-   **Réponse** : Liste des conversations avec leurs IDs, titres, timestamps et derniers messages

### POST /conversations

-   **Description** : Crée une nouvelle conversation
-   **Implémentation** : Utilise `queries.insertConversation.run()` avec un titre vide et le timestamp actuel
-   **Réponse** : `{ id: <id_généré> }`

### GET /conversation/:id/latest-version

-   **Description** : Récupère le dernier groupe de versions d'une conversation
-   **Implémentation** : Utilise `queries.getLatestVersionGroup.get()`
-   **Réponse** : `{ versionId, timestamp }`

### GET /versions/:id/messages

-   **Description** : Récupère les messages d'un groupe de versions avec leurs points de divergence
-   **Implémentation** : Utilise `queries.getMessagesFromVersionGroup.all()` et analyse les divergences
-   **Réponse** : Liste des messages avec leurs versions alternatives

### POST /chat

-   **Description** : Traite un message utilisateur et génère une réponse
-   **Corps** : `{ message, conversationId, versionId }`
-   **Implémentation** :
    -   Analyse NLP avec `extractEntities()`
    -   Met à jour les informations utilisateur avec `updateUserInformation()`
    -   Génère une réponse via le modèle Llama
    -   Crée un nouveau groupe de versions
-   **Réponse** : `{ response, conversationId, userMessageId, assistantMessageId, versionId }`

### PUT /messages/:messageId

-   **Description** : Modifie un message existant
-   **Corps** : `{ content }`
-   **Implémentation** :
    -   Crée un nouveau message avec le contenu modifié
    -   Génère une nouvelle réponse de l'assistant
    -   Crée un nouveau groupe de versions
-   **Réponse** : `{ messageId, assistantMessageId, versionId, timestamp, assistantResponse }`

### GET /messages/:messageId/versions

-   **Description** : Récupère les versions d'un message
-   **Implémentation** : Utilise `getMessageVersionsWithValidation()` pour obtenir les versions valides
-   **Réponse** : `{ messageId, totalGroups, versionGroups }`

### DELETE /conversations/:id

-   **Description** : Supprime une conversation et toutes ses données associées
-   **Implémentation** : Utilise `deleteConversationAndRelated()` qui supprime en transaction :
    -   Les associations message-version
    -   Les versions
    -   Les messages
    -   Les informations utilisateur
    -   La conversation
-   **Réponse** : `{ message: "Conversation supprimée avec succès" }`

### POST /reset/:id

-   **Description** : Réinitialise une conversation en supprimant tous ses messages
-   **Implémentation** : Vérifie l'existence de la conversation puis utilise `queries.deleteMessages.run()`
-   **Réponse** : `{ message: "Session réinitialisée avec succès" }`

## Configuration du modèle d'IA

Le modèle est configuré avec les paramètres suivants :

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

## Structure des dossiers

```
.
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatBox.jsx
│   │   │   ├── Message.jsx
│   │   │   └── MessageInput.jsx
│   │   ├── styles/
│   │   └── App.js
│   └── package.json
├── backend/
│   ├── server.js
│   ├── llamaConfig.js
│   ├── database.js
│   └── package.json
├── models/
│   └── llama-3.2-1b-instruct-q8_0.gguf
└── llama.cpp/
    └── llama-server.exe
```
