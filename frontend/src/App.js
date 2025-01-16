import React, { useState, useEffect } from 'react';
import ChatBox from './components/ChatBox';
import MessageInput from './components/MessageInput';
import './styles/globals.css';
import { RefreshCw, Bot, PlusCircle, X } from 'lucide-react';
import axios from 'axios';

// Configuration de base d'axios
const api = axios.create({
  baseURL: 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json'
  }
});

function App() {
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

  
  //  Récupère la liste des conversations depuis le serveur
  //  et met à jour l'état 'conversations'
   
  const fetchConversations = async () => {
    try {
      const { data } = await api.get('/conversations');
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

  //  Charge les messages d'une conversation spécifique
  const loadConversationMessages = async (conversationId) => {
    try {
      const { data: versionData } = await api.get(`/conversations/${conversationId}/latest-version`);
      if (versionData.versionId) {
        setCurrentVersionId(versionData.versionId);
        const { data: messagesData } = await api.get(`/versions/${versionData.versionId}/messages`);
        if (messagesData.messages) {
          const formattedMessages = await Promise.all(messagesData.messages.map(async msg => {
            let versionGroups = [];
            if (msg.isDivergencePoint) {
              try {
                const { data: versionsData } = await api.get(`/messages/${msg.id}/versions`);
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
            const formattedMessage = {
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
            return formattedMessage;
          }));
          setMessages(formattedMessages);
        }
      }
    } catch (error) {
      // Erreur silencieuse
    }
  };


  //  Crée une nouvelle conversation sur le serveur
  //  et met à jour l'état avec la nouvelle conversation
  const createNewConversation = () => {
    setCurrentConversationId(null);
    setCurrentVersionId(null);
    setMessages([]);
  };

//  Gère l'envoi d'un message à l'assistant
  const handleSendMessage = async (message) => {
    setIsLoading(true);
    const startTime = Date.now();
    const timestamp = new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Ajouter immédiatement le message de l'utilisateur
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
      
      // Si pas de conversation active, en créer une nouvelle
      if (!conversationId) {
        const { data } = await api.post('/conversations');
        conversationId = data.id;
        setCurrentConversationId(conversationId);
        setCurrentVersionId(null);
      }

      const { data } = await api.post('/chat', {
        message,
        conversationId: conversationId,
        versionId: currentVersionId
      });

      setCurrentVersionId(data.versionId);
      
      const { data: messagesData } = await api.get(`/versions/${data.versionId}/messages`);
      if (messagesData.messages) {
        const formattedMessages = await Promise.all(messagesData.messages.map(async msg => {
          let versionGroups = [];
          if (msg.isDivergencePoint) {
            try {
              const { data: versionsData } = await api.get(`/messages/${msg.id}/versions`);
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
          const formattedMessage = {
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
          return formattedMessage;
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

  //  Supprime une conversation spécifique
  const deleteConversation = async (conversationId, event) => {
    event.stopPropagation();
    
    try {
      await api.delete(`/conversations/${conversationId}`);
      if (currentConversationId === conversationId) {
        setCurrentConversationId(null);
        setMessages([]);
      }
      await fetchConversations();
    } catch (error) {
      // Erreur silencieuse
    }
  };

  const handleMessageUpdate = async (messageId, newContent) => {
    try {
      const { data } = await api.put(`/messages/${messageId}`, {
        content: newContent
      });

      setCurrentVersionId(data.versionId);
      
      const { data: messagesData } = await api.get(`/versions/${data.versionId}/messages`);
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
      const { data: messagesData } = await api.get(`/versions/${versionId}/messages`);
      if (messagesData.messages) {
        const formattedMessages = await Promise.all(messagesData.messages.map(async msg => {
          let versionGroups = [];
          if (msg.isDivergencePoint) {
            try {
              const { data: versionsData } = await api.get(`/messages/${msg.id}/versions`);
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
          const formattedMessage = {
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
          return formattedMessage;
        }));
        setMessages(formattedMessages);
      }
    } catch (error) {
      // Erreur silencieuse
    }
  };

  return (
    <div className="min-h-screen bg-background p-12">
      <div className="min-w-6xl mx-auto p-4 flex gap-4">
        <div className="w-96 border border-border rounded-2xl p-4">
          <button
            onClick={createNewConversation}
            disabled={conversations.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 mb-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlusCircle className="w-4 h-4" />
            Nouvelle conversation
          </button>
          
          <div className="space-y-2">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className="flex items-center group"
              >
                <button
                  onClick={() => setCurrentConversationId(conv.id)}
                  className={`flex-1 text-left p-2 rounded-l-md hover:bg-accent truncate ${
                    currentConversationId === conv.id ? 'bg-accent' : ''
                  }`}
                >
                  {conv.title}
                </button>
                <button
                  onClick={(e) => deleteConversation(conv.id, e)}
                  className={`p-2 rounded-r-md hover:bg-destructive hover:text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity ${
                    currentConversationId === conv.id ? 'bg-accent' : ''
                  }`}
                >
                  <X/>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 border border-border rounded-2xl shadow-sm">
          <div className="relative flex justify-center items-center h-14 mb-2">
            <div className="flex items-center gap-2">
              <Bot className="w-8 h-8 text-black" />
              <h1 className="text-3xl font-bold text-foreground">Mini Chat</h1>
              <Bot className="w-8 h-8 text-black" />
            </div>
            <button
              onClick={() => currentConversationId && deleteConversation(currentConversationId, new Event('click'))}
              disabled={!currentConversationId}
              className="absolute right-4 top-1/2 -translate-y-1/2 px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <ChatBox 
            messages={messages} 
            isLoading={isLoading} 
            currentConversationId={currentConversationId}
            onMessageUpdate={handleMessageUpdate}
            currentVersionId={currentVersionId}
            onVersionChange={handleVersionChange}
          />
          <MessageInput 
            onSend={handleSendMessage} 
            disabled={isLoading} 
          />
        </div>
      </div>
    </div>
  );
}

export default App;