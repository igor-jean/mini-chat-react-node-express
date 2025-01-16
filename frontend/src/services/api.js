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

export const conversationService = {
    getAll: async () => {
        const { data } = await api.get('/conversations');
        return data;
    },

    create: async () => {
        const { data } = await api.post('/conversations');
        return data;
    },

    delete: async (id) => {
        const { data } = await api.delete(`/conversations/${id}`);
        return data;
    },

    getLatestVersion: async (id) => {
        const { data } = await api.get(`/conversations/${id}/latest-version`);
        return data;
    },

    getVersionMessages: async (versionId) => {
        const { data } = await api.get(`/versions/${versionId}/messages`);
        return data;
    },
}; 