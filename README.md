# Mini Chat React Node Express

Une application de chat minimaliste utilisant React pour le frontend et Node.js/Express pour le backend, avec un modèle d'IA Mistral.

## Architecture

### Frontend (React)

-   **Technologies principales** :

    -   React
    -   styled-components (sera remplacé par shadcn/ui)
    -   react-spinners

-   **Structure des composants** :
    -   `ChatBox` : Affiche la conversation
    -   `Message` : Gère l'affichage des messages
    -   `MessageInput` : Gère la saisie des messages

### Backend (Node.js/Express)

-   **Technologies principales** :

    -   Express.js
    -   node-llama-cpp
    -   CORS

-   **Fonctionnalités** :
    -   API REST pour le chat
    -   Intégration avec le modèle Mistral 7B
    -   Gestion des sessions de chat
    -   Optimisation GPU

## Installation

### Prérequis

-   Node.js v16+
-   npm ou yarn
-   Le modèle Mistral 7B (fichier .gguf)

### Configuration du Frontend

```bash
cd frontend
npm install
npm start
```

### Configuration du Backend

```bash
cd backend
npm install
# Placez le modèle Mistral dans le dossier /models
npm start
```

## Structure des dossiers

```
.
├── frontend/
│   ├─��� src/
│   │   ├── components/
│   │   ├── styles/
│   │   └── App.js
│   └── package.json
├── backend/
│   ├── server.js
│   └── package.json
└── models/
    └── mistral-7b-v0.1.Q4_K_M.gguf
```

## API Backend

### POST /chat

-   **Description** : Envoie un message au chatbot
-   **Corps de la requête** : `{ "message": "votre message" }`
-   **Réponse** : `{ "response": "réponse du bot" }`

### POST /reset

-   **Description** : Réinitialise la session de chat
-   **Réponse** : `{ "message": "Session réinitialisée avec succès" }`

## Configuration du modèle d'IA

Le backend utilise le modèle Mistral 7B avec les paramètres suivants :

-   Taille du contexte : 32768 tokens
-   Température : 0.7
-   Top-K : 50
-   Top-P : 0.95
-   Optimisation GPU activée
