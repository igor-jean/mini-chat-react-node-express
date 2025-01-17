import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:3001',
    headers: {
        'Content-Type': 'application/json'
    }
});

export const chatService = {
    sendMessage: async (message, conversationId, versionId, onChunk) => {
        const response = await fetch('http://localhost:3001/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message,
                conversationId,
                versionId
            })
        });

        const reader = response.body.getReader();
        let streamingDone = false;
        let messageInfo = null;
        let buffer = '';

        try {
            while (!streamingDone) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                buffer += new TextDecoder().decode(value);
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            if (data.done) {
                                streamingDone = true;
                                messageInfo = {
                                    conversationId: data.conversationId,
                                    userMessageId: data.userMessageId,
                                    assistantMessageId: data.assistantMessageId,
                                    versionId: data.versionId
                                };
                            } else if (data.error) {
                                throw new Error(data.error);
                            } else if (data.content) {
                                await onChunk(data.content);
                            }
                        } catch (e) {
                            console.error('Erreur parsing SSE:', e);
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        return messageInfo;
    },

    updateMessage: async (messageId, content, onChunk) => {
        const response = await fetch(`${API_URL}/messages/${messageId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content })
        });

        if (!response.ok) {
            throw new Error('Erreur lors de la modification du message');
        }

        const reader = response.body.getReader();
        let messageInfo = null;
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                buffer += new TextDecoder().decode(value);
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            if (data.done) {
                                messageInfo = {
                                    messageId: data.messageId,
                                    assistantMessageId: data.assistantMessageId,
                                    versionId: data.versionId,
                                    timestamp: data.timestamp
                                };
                            } else if (data.error) {
                                throw new Error(data.error);
                            } else if (data.content) {
                                await onChunk(data.content);
                            }
                        } catch (e) {
                            console.error('Erreur parsing SSE:', e);
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        return messageInfo;
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