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
  const [isResetting, setIsResetting] = useState(false);

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
      setConversations(data);
    } catch (error) {
      console.error('Erreur lors du chargement des conversations:', error);
    }
  };

  //  Charge les messages d'une conversation spécifique
  const loadConversationMessages = async (conversationId) => {
    try {
      const { data } = await api.get(`/conversation/${conversationId}`);
      if (data.messages) {
        setMessages(data.messages.map(msg => ({
          type: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })
        })));
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
      setCurrentConversationId(data.id);
      setMessages([]);
      await fetchConversations();
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
    
    setMessages(prev => [...prev, 
      { type: 'user', content: message, timestamp },
      { type: 'assistant', content: 'En train de réfléchir...' }
    ]);

    try {
      const { data } = await api.post('/chat', {
        message,
        sessionId: currentConversationId
      });
      
      if (!currentConversationId) {
        setCurrentConversationId(data.conversationId);
      }
      
      const responseTime = ((Date.now() - startTime) / 1000).toFixed(2);
      const responseTimestamp = new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = { 
          type: 'assistant', 
          content: data.response,
          responseTime: responseTime,
          timestamp: responseTimestamp
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

  //  Réinitialise la conversation en cours en effaçant tous les messages
  const handleReset = async () => {
    setIsResetting(true);
    try {
      await api.post(`/reset/${currentConversationId}`);
      setMessages([]);
    } catch (error) {
      console.error('Erreur lors de la réinitialisation:', error);
    } finally {
      setTimeout(() => {
        setIsResetting(false);
      }, 1000);
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

  return (
    <div className="min-h-screen bg-background pt-24">
      <div className="max-w-6xl mx-auto p-4 flex gap-4">
        <div className="w-64 border border-border rounded-2xl p-4">
          <button
            onClick={createNewConversation}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 mb-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
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
                  <X className="w-4 h-4" />
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
              onClick={handleReset}
              disabled={isResetting}
              className="absolute right-4 top-1/2 -translate-y-1/2 px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${isResetting ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <ChatBox 
            messages={messages} 
            isLoading={isLoading} 
            isResetting={isResetting} 
          />
          <MessageInput 
            onSend={handleSendMessage} 
            disabled={isLoading || isResetting} 
          />
        </div>
      </div>
    </div>
  );
}

export default App;