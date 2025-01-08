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
  const [currentVersion, setCurrentVersion] = useState(1);
  const [versionNumber, setVersionNumber] = useState(1);

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
      // On récupère la version 1 pour obtenir totalVersions
      const { data } = await api.get(`/conversation/${conversationId}/version/1`);
      if (data.messages && data.messages.length > 0) {
        const latestVersion = data.messages[0].totalVersions;
        
        // On charge directement la dernière version
        const { data: latestData } = await api.get(`/conversation/${conversationId}/version/${latestVersion}`);
        if (latestData.messages) {
          const formattedMessages = latestData.messages.map(msg => ({
            type: msg.role,
            content: msg.content,
            timestamp: new Date(msg.timestamp).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            ordre: msg.ordre,
            messageId: msg.id,
            totalVersions: msg.totalVersions,
            currentVersion: latestVersion
          }));
          setMessages(formattedMessages);
          setCurrentVersion(latestVersion);
          setVersionNumber(latestVersion);
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
        setVersionNumber(1);
        await fetchConversations();
      }
    } catch (error) {
      console.error('Erreur lors de la création de la conversation:', error);
    }
  };

//  Gère l'envoi d'un message à l'assistant
  const handleSendMessage = async (message, versionNumber) => {
    setIsLoading(true);
    const startTime = Date.now();
    const timestamp = new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    
    setMessages(prev => [...prev, 
      { 
        type: 'user', 
        content: message, 
        timestamp,
        totalVersions: 1,
        currentVersion: 1
      },
      { 
        type: 'assistant', 
        content: 'En train de réfléchir...',
        totalVersions: 1,
        currentVersion: 1
      }
    ]);

    try {
      let responseData;
      
      if (!currentConversationId) {
        const { data } = await api.post('/chat', {
          message,
          conversationId: null,
          versionNumber: 1
        });
        setCurrentConversationId(data.conversationId);
        responseData = data;
      } else {
        const { data } = await api.post('/chat', {
          message,
          conversationId: currentConversationId,
          versionNumber: versionNumber
        });
        responseData = data;
      }
      
      const responseTime = ((Date.now() - startTime) / 1000).toFixed(2);
      const responseTimestamp = new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      
      setMessages(prev => {
        const newMessages = [...prev];
        // Mettre à jour le message utilisateur avec son ID
        newMessages[newMessages.length - 2] = {
          ...newMessages[newMessages.length - 2],
          messageId: responseData.userMessageId // Ajout de l'ID du message utilisateur
        };
        // Mettre à jour le message assistant avec son ID
        newMessages[newMessages.length - 1] = { 
          type: 'assistant', 
          content: responseData.response,
          responseTime: responseTime,
          timestamp: responseTimestamp,
          messageId: responseData.assistantMessageId // Ajout de l'ID du message assistant
        };
        return newMessages;
      });

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

  const handleMessageUpdate = async (messageId, newContent, assistantResponse, newVersionNumber) => {
    setMessages(prevMessages => {
      const newMessages = [...prevMessages];
      // Trouve et met à jour le message utilisateur
      const userMessageIndex = newMessages.findIndex(msg => msg.messageId === messageId);
      if (userMessageIndex !== -1) {
        // Mise à jour du message utilisateur
        newMessages[userMessageIndex] = {
          ...newMessages[userMessageIndex],
          content: newContent,
          totalVersions: newVersionNumber, // Utiliser le nouveau numéro de version
          currentVersion: newVersionNumber // Mettre à jour la version courante
        };
        
        // Met à jour la réponse de l'assistant qui suit
        if (userMessageIndex + 1 < newMessages.length) {
          newMessages[userMessageIndex + 1] = {
            ...newMessages[userMessageIndex + 1],
            content: assistantResponse,
            totalVersions: newVersionNumber,
            currentVersion: newVersionNumber
          };
        }
      }
      // Mettre à jour les états globaux
      setCurrentVersion(newVersionNumber);
      setVersionNumber(newVersionNumber);
      return newMessages;
    });
  };

  const handleVersionChange = async (conversationId, newVersion) => {
    try {
      const response = await api.get(`/conversation/${conversationId}/version/${newVersion}`);
      const formattedMessages = response.data.messages.map(msg => ({
        type: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp).toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        ordre: msg.ordre,
        messageId: msg.id,
        totalVersions: msg.totalVersions,
        currentVersion: newVersion
      }));
      setMessages(formattedMessages);
      setCurrentVersion(newVersion);
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
            currentVersion={currentVersion}
            onVersionChange={handleVersionChange}
            setVersionNumber={setVersionNumber}
            versionNumber={versionNumber}
          />
          <MessageInput 
            onSend={handleSendMessage} 
            disabled={isLoading} 
            versionNumber={versionNumber}
          />
        </div>
      </div>
    </div>
  );
}

export default App;