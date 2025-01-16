import { useState, useEffect } from 'react';
import { chatService, conversationService } from '../services/api';

export const useChat = () => {
    const [messages, setMessages] = useState([]);
    const [conversations, setConversations] = useState([]);
    const [currentConversationId, setCurrentConversationId] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [currentVersionId, setCurrentVersionId] = useState(null);

    useEffect(() => {
        fetchConversations();
    }, []);

    useEffect(() => {
        if (currentConversationId) {
            loadConversationMessages(currentConversationId);
        }
    }, [currentConversationId]);

    const fetchConversations = async () => {
        try {
            const data = await conversationService.getAll();
            setConversations(data.map(conv => ({
                ...conv,
                timestamp: new Date(conv.timestamp).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                })
            })));
        } catch (error) {
            // Erreur silencieuse
        }
    };

    const loadConversationMessages = async (conversationId) => {
        try {
            const versionData = await conversationService.getLatestVersion(conversationId);
            if (versionData.versionId) {
                setCurrentVersionId(versionData.versionId);
                const messagesData = await conversationService.getVersionMessages(versionData.versionId);
                if (messagesData.messages) {
                    const formattedMessages = await Promise.all(messagesData.messages.map(async msg => {
                        let versionGroups = [];
                        if (msg.isDivergencePoint) {
                            try {
                                const versionsData = await chatService.getMessageVersions(msg.id);
                                if (versionsData.versionGroups && Array.isArray(versionsData.versionGroups)) {
                                    versionGroups = versionsData.versionGroups.map(group => ({
                                        content: group.content || '',
                                        versions: Array.isArray(group.versions) ? group.versions.map(v => ({
                                            versionId: v.versionId,
                                            timestamp: v.timestamp
                                        })) : []
                                    })).filter(group => group.versions.length > 0);
                                }
                            } catch (error) {
                                versionGroups = [];
                            }
                        }
                        return {
                            type: msg.role,
                            content: msg.content,
                            timestamp: new Date(msg.timestamp).toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit',
                            }),
                            ordre: msg.ordre,
                            messageId: msg.id,
                            isDivergencePoint: msg.isDivergencePoint,
                            availableVersions: msg.availableVersions || [],
                            responseTime: msg.response_time,
                            nbTokens: msg.nb_tokens
                        };
                    }));
                    setMessages(formattedMessages);
                }
            }
        } catch (error) {
            // Erreur silencieuse
        }
    };

    const handleSendMessage = async (message) => {
        setIsLoading(true);
        const timestamp = new Date().toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
        });

        setMessages(prev => [...prev, {
            type: 'user',
            content: message,
            timestamp: timestamp
        }, {
            type: 'assistant',
            content: 'En train de réfléchir...',
            timestamp: timestamp
        }]);

        try {
            let conversationId = currentConversationId;
            
            if (!conversationId) {
                const { id } = await conversationService.create();
                conversationId = id;
                setCurrentConversationId(id);
                setCurrentVersionId(null);
            }

            const data = await chatService.sendMessage(message, conversationId, currentVersionId);
            setCurrentVersionId(data.versionId);
            
            const messagesData = await conversationService.getVersionMessages(data.versionId);
            if (messagesData.messages) {
                const formattedMessages = await Promise.all(messagesData.messages.map(async msg => {
                    let versionGroups = [];
                    if (msg.isDivergencePoint) {
                        try {
                            const versionsData = await chatService.getMessageVersions(msg.id);
                            if (versionsData.versionGroups && Array.isArray(versionsData.versionGroups)) {
                                versionGroups = versionsData.versionGroups.map(group => ({
                                    content: group.content || '',
                                    versions: Array.isArray(group.versions) ? group.versions.map(v => ({
                                        versionId: v.versionId,
                                        timestamp: v.timestamp
                                    })) : []
                                })).filter(group => group.versions.length > 0);
                            }
                        } catch (error) {
                            versionGroups = [];
                        }
                    }
                    return {
                        type: msg.role,
                        content: msg.content,
                        timestamp: new Date(msg.timestamp).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                        }),
                        ordre: msg.ordre,
                        messageId: msg.id,
                        isDivergencePoint: msg.isDivergencePoint,
                        availableVersions: msg.availableVersions || [],
                        responseTime: msg.response_time,
                        nbTokens: msg.nb_tokens
                    };
                }));
                setMessages(formattedMessages);
            }

            await fetchConversations();
        } catch (error) {
            const errorTimestamp = new Date().toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
            });
            
            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = { 
                    type: 'assistant', 
                    content: 'Désolé, une erreur est survenue.',
                    timestamp: errorTimestamp
                };
                return newMessages;
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleMessageUpdate = async (messageId, newContent) => {
        try {
            const data = await chatService.updateMessage(messageId, newContent);
            setCurrentVersionId(data.versionId);
            
            const messagesData = await conversationService.getVersionMessages(data.versionId);
            if (messagesData.messages) {
                const formattedMessages = messagesData.messages.map(msg => ({
                    type: msg.role,
                    content: msg.content,
                    timestamp: new Date(msg.timestamp).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                    }),
                    ordre: msg.ordre,
                    messageId: msg.id,
                    isDivergencePoint: msg.isDivergencePoint,
                    availableVersions: msg.availableVersions || [],
                    responseTime: msg.response_time,
                    nbTokens: msg.nb_tokens
                }));
                setMessages(formattedMessages);
            }
        } catch (error) {
            // Erreur silencieuse
        }
    };

    const handleVersionChange = async (messageId, versionId) => {
        try {
            setCurrentVersionId(versionId);
            const messagesData = await conversationService.getVersionMessages(versionId);
            if (messagesData.messages) {
                const formattedMessages = await Promise.all(messagesData.messages.map(async msg => {
                    let versionGroups = [];
                    if (msg.isDivergencePoint) {
                        try {
                            const versionsData = await chatService.getMessageVersions(msg.id);
                            if (versionsData.versionGroups && Array.isArray(versionsData.versionGroups)) {
                                versionGroups = versionsData.versionGroups.map(group => ({
                                    content: group.content || '',
                                    versions: Array.isArray(group.versions) ? group.versions.map(v => ({
                                        versionId: v.versionId,
                                        timestamp: v.timestamp
                                    })) : []
                                })).filter(group => group.versions.length > 0);
                            }
                        } catch (error) {
                            versionGroups = [];
                        }
                    }
                    return {
                        type: msg.role,
                        content: msg.content,
                        timestamp: new Date(msg.timestamp).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                        }),
                        ordre: msg.ordre,
                        messageId: msg.id,
                        isDivergencePoint: msg.isDivergencePoint,
                        availableVersions: msg.availableVersions || [],
                        responseTime: msg.response_time,
                        nbTokens: msg.nb_tokens
                    };
                }));
                setMessages(formattedMessages);
            }
        } catch (error) {
            // Erreur silencieuse
        }
    };

    const createNewConversation = () => {
        setCurrentConversationId(null);
        setCurrentVersionId(null);
        setMessages([]);
    };

    const deleteConversation = async (conversationId, event) => {
        event.stopPropagation();
        
        try {
            await conversationService.delete(conversationId);
            if (currentConversationId === conversationId) {
                setCurrentConversationId(null);
                setMessages([]);
            }
            await fetchConversations();
        } catch (error) {
            // Erreur silencieuse
        }
    };

    const updateConversationTitle = async (conversationId, newTitle) => {
        try {
            const data = await conversationService.updateTitle(conversationId, newTitle);
            setConversations(conversations.map(conv =>
                conv.id === conversationId ? { ...conv, title: data.title } : conv
            ));
        } catch (error) {
            console.error('Erreur:', error);
            // Vous pouvez ajouter ici une notification d'erreur si vous le souhaitez
        }
    };

    return {
        messages,
        conversations,
        currentConversationId,
        isLoading,
        currentVersionId,
        handleSendMessage,
        handleMessageUpdate,
        handleVersionChange,
        createNewConversation,
        deleteConversation,
        setCurrentConversationId,
        updateConversationTitle
    };
}; 