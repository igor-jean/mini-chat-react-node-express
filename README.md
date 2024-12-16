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

### Backend (Node.js/Express + Llama.cpp)

-   **Technologies principales** :

    -   Express.js
    -   llama.cpp
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
-   llama.cpp (serveur)

## Démarrage de l'application

L'application nécessite le démarrage de trois composants dans l'ordre suivant :

1. **Serveur Llama.cpp** (dans le dossier llama.cpp) :

```bash
.\llama-server.exe --model ../models/mistral-7b-v0.1.Q4_K_M.gguf --ctx-size 2048 --n-gpu-layers 35 --port 8080
```

2. **Serveur Backend** (dans le dossier backend) :

```bash
node ./server.js
```

3. **Application Frontend** (dans le dossier frontend) :

```bash
npm start
```

## Structure des dossiers

```
.
├── frontend/
│   ├── src/
│   │   ├── components/
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

## API Backend

### POST /chat

-   **Description** : Envoie un message au chatbot
-   **Corps de la requête** : `{ "message": "votre message" }`
-   **Réponse** : `{ "response": "réponse du bot" }`

### POST /reset

-   **Description** : Réinitialise la session de chat
-   **Réponse** : `{ "message": "Session réinitialisée avec succès" }`

## Configuration du modèle d'IA

Le modèle Mistral 7B est configuré avec les paramètres suivants :

-   Taille du contexte : 2048 tokens
-   Température : 0.3
-   Top-K : 40
-   Top-P : 0.90
-   Utilisation GPU : 35 couches
