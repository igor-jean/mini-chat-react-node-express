# Mini Chat React Node Express

Une application de chat minimaliste utilisant React pour le frontend et Node.js/Express pour le backend, avec un modèle d'IA Llama 3.2 1B.

## Fonctionnalités

-   Interface de chat en temps réel
-   Gestion de multiples conversations
-   Titres automatiques basés sur la première question
-   Suppression de conversations
-   Historique des messages par conversation
-   Temps de réponse affiché
-   Réinitialisation des conversations

## Architecture

### Frontend (React)

-   **Technologies principales** :

    -   React
    -   Tailwind CSS
    -   Lucide Icons
    -   react-spinners

-   **Composants principaux** :
    -   `App.js` : Composant principal et gestion des conversations
    -   `ChatBox` : Affichage des messages
    -   `Message` : Rendu des messages individuels
    -   `MessageInput` : Saisie des messages

### Backend (Node.js/Express + Llama.cpp)

-   **Technologies principales** :

    -   Express.js
    -   llama.cpp

-   **Fonctionnalités API** :
    -   Gestion des conversations
    -   Intégration avec le modèle Mistral 7B
    -   Stockage en mémoire des conversations
    -   Optimisation GPU

## API Backend

### GET /conversations

-   **Description** : Récupère la liste des conversations
-   **Réponse** : Liste des conversations avec leurs IDs, titres et derniers messages

### POST /conversations

-   **Description** : Crée une nouvelle conversation
-   **Réponse** : `{ id: "uuid" }`

### GET /conversation/:id

-   **Description** : Récupère les messages d'une conversation spécifique
-   **Réponse** : Détails de la conversation et ses messages

### POST /chat

-   **Description** : Envoie un message au chatbot
-   **Corps** : `{ "message": "votre message", "sessionId": "uuid" }`
-   **Réponse** : `{ "response": "réponse du bot", "conversationId": "uuid" }`

### DELETE /conversations/:id

-   **Description** : Supprime une conversation
-   **Réponse** : `{ "message": "Conversation supprimée avec succès" }`

### POST /reset

-   **Description** : Réinitialise la session de chat
-   **Réponse** : `{ "message": "Session réinitialisée avec succès" }`

## Installation

### Prérequis

-   Node.js v16+
-   npm ou yarn
-   CUDA Toolkit (pour l'accélération GPU)
-   Le modèle Llama 3.2 1B (fichier .gguf)
-   llama.cpp (serveur)

### Configuration

1. **Téléchargement du modèle** :

    - Téléchargez le modèle Llama 3.2 1B quantifié (llama-3.2-1b-instruct-q8_0.gguf) depuis Hugging Face
    - Placez-le dans le dossier `models/`

2. **Installation de llama.cpp** :
    - Téléchargez la version pré-compilée pour CUDA depuis les releases GitHub
    - Extrayez llama-server.exe dans le dossier `llama.cpp/`

### Démarrage

1. **Serveur Llama.cpp** :

```bash
cd llama.cpp
.\llama-server.exe --model ../models/llama-3.2-1b-instruct-q8_0.gguf --ctx-size 2048 --n-gpu-layers 35 --port 8080
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

## Configuration du modèle d'IA

Le modèle Mistral 7B est configuré avec les paramètres suivants :

-   temperature: 0.3,
-   top_p: 0.90,
-   top_k: 40,
-   n_predict: 2048,
-   repeat_penalty: 1.15,
-   presence_penalty: 0.2,
-   frequency_penalty: 0.2,

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
│   └── package.json
├── models/
│   └── mistral-7b-v0.1.Q4_K_M.gguf
└── llama.cpp/
    └── llama-server.exe
```
