import { useState, useEffect } from 'react';
import { chatService, conversationService } from '../services/api';

// Délai en millisecondes entre chaque chunk de texte pour contrôler la vitesse d'affichage du streaming
const DISPLAY_DELAY = 50;

// Fonction utilitaire pour créer un délai artificiel entre les chunks de texte
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export const useChat = () => {
    const [messages, setMessages] = useState([]);
    const [conversations, setConversations] = useState([]);
    const [currentConversationId, setCurrentConversationId] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [currentVersionId, setCurrentVersionId] = useState(null);
    const [displaySpeed, setDisplaySpeed] = useState(DISPLAY_DELAY);

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

    // Fonction qui applique un délai avant d'afficher chaque chunk de texte
    const handleChunkWithDelay = async (chunk, updateFn) => {
        await delay(displaySpeed);
        await updateFn(chunk);
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
            content: '',
            timestamp: timestamp,
            isStreaming: true  // Indique que ce message est en cours de streaming
        }]);

        try {
            let conversationId = currentConversationId;
            
            if (!conversationId) {
                const { id } = await conversationService.create();
                conversationId = id;
                setCurrentConversationId(id);
                setCurrentVersionId(null);
            }

            // Gestionnaire de chunks pour le streaming
            const handleChunk = async (chunk) => {
                const updateMessage = async (text) => {
                    return new Promise(resolve => {
                        setMessages(prev => {
                            const newMessages = [...prev];
                            const lastMessage = newMessages[newMessages.length - 1];
                            if (lastMessage && lastMessage.type === 'assistant') {
                                return [...prev.slice(0, -1), {
                                    ...lastMessage,
                                    content: lastMessage.content + text  // Ajouter progressivement le texte
                                }];
                            }
                            return prev;
                        });
                        resolve();
                    });
                };

                await handleChunkWithDelay(chunk, updateMessage);
            };

            const messageInfo = await chatService.sendMessage(
                message, 
                conversationId, 
                currentVersionId,
                handleChunk
            );

            if (messageInfo) {
                setCurrentVersionId(messageInfo.versionId);
                
                const messagesData = await conversationService.getVersionMessages(messageInfo.versionId);
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
                            nbTokens: msg.nb_tokens,
                            isStreaming: false
                        };
                    }));
                    setMessages(formattedMessages);
                }

                await fetchConversations();
            }
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
                    timestamp: errorTimestamp,
                    isStreaming: false
                };
                return newMessages;
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleMessageUpdate = async (messageId, newContent) => {
        try {
            setMessages(prev => {
                const newMessages = [...prev];
                const messageIndex = newMessages.findIndex(msg => msg.messageId === messageId);
                if (messageIndex !== -1) {
                    // Garder seulement les messages jusqu'au message modifié et préparer pour le streaming
                    const truncatedMessages = newMessages.slice(0, messageIndex + 1);
                    truncatedMessages[messageIndex] = {
                        ...truncatedMessages[messageIndex],
                        content: newContent
                    };
                    // Ajouter un nouveau message assistant vide pour le streaming
                    return [...truncatedMessages, {
                        type: 'assistant',
                        content: '',
                        timestamp: new Date().toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                        }),
                        isStreaming: true  // Indique que ce message est en cours de streaming
                    }];
                }
                return newMessages;
            });

            const handleChunk = async (chunk) => {
                const updateMessage = (text) => {
                    setMessages(prev => {
                        const newMessages = [...prev];
                        const lastMessage = newMessages[newMessages.length - 1];
                        if (lastMessage && lastMessage.type === 'assistant') {
                            return [...prev.slice(0, -1), {
                                ...lastMessage,
                                content: lastMessage.content + text
                            }];
                        }
                        return newMessages;
                    });
                };

                await handleChunkWithDelay(chunk, updateMessage);
            };

            const data = await chatService.updateMessage(messageId, newContent, handleChunk);
            if (data) {
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
                        nbTokens: msg.nb_tokens,
                        isStreaming: false
                    }));
                    setMessages(formattedMessages);
                }
            }
        } catch (error) {
            console.error('Erreur lors de la modification du message:', error);
            setMessages(prev => {
                const newMessages = [...prev];
                const messageIndex = newMessages.findIndex(msg => msg.messageId === messageId);
                if (messageIndex !== -1) {
                    // En cas d'erreur, garder seulement jusqu'au message d'erreur
                    const truncatedMessages = newMessages.slice(0, messageIndex + 2);
                    truncatedMessages[messageIndex + 1] = {
                        type: 'assistant',
                        content: 'Désolé, une erreur est survenue.',
                        timestamp: new Date().toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                        }),
                        isStreaming: false
                    };
                    return truncatedMessages;
                }
                return newMessages;
            });
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
        updateConversationTitle,
        displaySpeed,
        setDisplaySpeed
    };
}; 