import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:3001',
    headers: {
        'Content-Type': 'application/json'
    }
});

export const chatService = {
    sendMessage: async (message, conversationId, versionId) => {
        const { data } = await api.post('/chat', {
            message,
            conversationId,
            versionId
        });
        return data;
    },

    updateMessage: async (messageId, content) => {
        const { data } = await api.put(`/messages/${messageId}`, { content });
        return data;
    },

    getMessageVersions: async (messageId) => {
        const { data } = await api.get(`/messages/${messageId}/versions`);
        return data;
    }
};

const API_URL = 'http://localhost:3001';

export const conversationService = {
    getAll: async () => {
        const response = await fetch(`${API_URL}/conversations`);
        if (!response.ok) throw new Error('Erreur lors de la récupération des conversations');
        return response.json();
    },

    create: async () => {
        const response = await fetch(`${API_URL}/conversations`, {
            method: 'POST'
        });
        if (!response.ok) throw new Error('Erreur lors de la création de la conversation');
        return response.json();
    },

    delete: async (id) => {
        const response = await fetch(`${API_URL}/conversations/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Erreur lors de la suppression de la conversation');
        return response.json();
    },

    updateTitle: async (id, title) => {
        const response = await fetch(`${API_URL}/conversations/${id}/title`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title }),
        });
        if (!response.ok) throw new Error('Erreur lors de la mise à jour du titre');
        return response.json();
    },

    getLatestVersion: async (id) => {
        const response = await fetch(`${API_URL}/conversations/${id}/latest-version`);
        if (!response.ok) throw new Error('Erreur lors de la récupération de la dernière version');
        return response.json();
    },

    getVersionMessages: async (versionId) => {
        const response = await fetch(`${API_URL}/versions/${versionId}/messages`);
        if (!response.ok) throw new Error('Erreur lors de la récupération des messages');
        return response.json();
    }
}; 