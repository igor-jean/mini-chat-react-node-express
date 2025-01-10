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
      console.error('Erreur lors du chargement des conversations:', error);
    }
  };

  //  Charge les messages d'une conversation spécifique
  const loadConversationMessages = async (conversationId) => {
    try {
      // Récupérer le dernier groupe de versions
      const { data: versionData } = await api.get(`/conversations/${conversationId}/latest-version`);
      if (versionData.versionId) {
        setCurrentVersionId(versionData.versionId);
        const { data: messagesData } = await api.get(`/versions/${versionData.versionId}/messages`);
        if (messagesData.messages) {
          const formattedMessages = await Promise.all(messagesData.messages.map(async msg => {
            let versionGroups = [];
            if (msg.isDivergencePoint) {
              try {
                // Récupérer les versions disponibles pour ce message
                const { data: versionsData } = await api.get(`/messages/${msg.id}/versions`);
                console.log('Version data for message', msg.id, ':', versionsData);
                
                // Vérifier et nettoyer les données des versions
                if (versionsData.versionGroups && Array.isArray(versionsData.versionGroups)) {
                  versionGroups = versionsData.versionGroups.map(group => ({
                    content: group.content || '',
                    versions: Array.isArray(group.versions) ? group.versions.map(v => ({
                      versionId: v.versionId,
                      timestamp: v.timestamp
                    })) : []
                  })).filter(group => group.versions.length > 0);
                }
                
                console.log('Version groups after formatting:', versionGroups);
              } catch (error) {
                console.error('Error fetching versions for message:', msg.id, error);
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
              availableVersions: msg.availableVersions || []
            };
            console.log('Formatted message:', formattedMessage);
            return formattedMessage;
          }));
          console.log('All formatted messages:', formattedMessages);
          setMessages(formattedMessages);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des messages:', error);
    }
  };


  //  Crée une nouvelle conversation sur le serveur
  //  et met à jour l'état avec la nouvelle conversation
  const createNewConversation = async () => {
    try {
      const { data } = await api.post('/conversations');
      if (data.id) {  // Vérification que l'ID est bien retourné
        setCurrentConversationId(data.id);
        setMessages([]);
        await fetchConversations();
      }
    } catch (error) {
      console.error('Erreur lors de la création de la conversation:', error);
    }
  };

//  Gère l'envoi d'un message à l'assistant
  const handleSendMessage = async (message) => {
    setIsLoading(true);
    const startTime = Date.now();
    const timestamp = new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    try {
      const { data } = await api.post('/chat', {
        message,
        conversationId: currentConversationId,
        versionId: currentVersionId
      });

      setCurrentVersionId(data.versionId);
      
      // Charger les messages du nouveau groupe de versions
      const { data: messagesData } = await api.get(`/versions/${data.versionId}/messages`);
      if (messagesData.messages) {
        const formattedMessages = await Promise.all(messagesData.messages.map(async msg => {
          let versionGroups = [];
          if (msg.isDivergencePoint) {
            try {
              // Récupérer les versions disponibles pour ce message
              const { data: versionsData } = await api.get(`/messages/${msg.id}/versions`);
              console.log('Version data for message', msg.id, ':', versionsData);
              
              // Vérifier et nettoyer les données des versions
              if (versionsData.versionGroups && Array.isArray(versionsData.versionGroups)) {
                versionGroups = versionsData.versionGroups.map(group => ({
                  content: group.content || '',
                  versions: Array.isArray(group.versions) ? group.versions.map(v => ({
                    versionId: v.versionId,
                    timestamp: v.timestamp
                  })) : []
                })).filter(group => group.versions.length > 0);
              }
              
              console.log('Version groups after formatting:', versionGroups);
            } catch (error) {
              console.error('Error fetching versions for message:', msg.id, error);
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
            availableVersions: msg.availableVersions || []
          };
          console.log('Formatted message:', formattedMessage);
          return formattedMessage;
        }));
        console.log('All formatted messages:', formattedMessages);
        setMessages(formattedMessages);
      }

      if (!currentConversationId) {
        setCurrentConversationId(data.conversationId);
      }

      await fetchConversations();
    } catch (error) {
      console.error('Erreur:', error);
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
      console.error('Erreur lors de la suppression:', error);
    }
  };

  const handleMessageUpdate = async (messageId, newContent) => {
    try {
      const { data } = await api.put(`/messages/${messageId}`, {
        content: newContent
      });

      setCurrentVersionId(data.versionId);
      
      // Charger les messages du nouveau groupe de versions
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
          availableVersions: msg.availableVersions || []
        }));
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Erreur lors de la modification:', error);
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
              // Récupérer les versions disponibles pour ce message
              const { data: versionsData } = await api.get(`/messages/${msg.id}/versions`);
              console.log('Version data for message', msg.id, ':', versionsData);
              
              // Vérifier et nettoyer les données des versions
              if (versionsData.versionGroups && Array.isArray(versionsData.versionGroups)) {
                versionGroups = versionsData.versionGroups.map(group => ({
                  content: group.content || '',
                  versions: Array.isArray(group.versions) ? group.versions.map(v => ({
                    versionId: v.versionId,
                    timestamp: v.timestamp
                  })) : []
                })).filter(group => group.versions.length > 0);
              }
              
              console.log('Version groups after formatting:', versionGroups);
            } catch (error) {
              console.error('Error fetching versions for message:', msg.id, error);
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
            availableVersions: msg.availableVersions || []
          };
          console.log('Formatted message:', formattedMessage);
          return formattedMessage;
        }));
        console.log('All formatted messages:', formattedMessages);
        setMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Erreur lors du changement de version:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background p-12">
      <div className="min-w-6xl mx-auto p-4 flex gap-4">
        <div className="w-96 border border-border rounded-2xl p-4">
          <button
            onClick={createNewConversation}
            disabled={conversations.length === 0 || (currentConversationId && messages.length === 0)}
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