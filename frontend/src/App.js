import React, { useState, useEffect } from 'react';
import ChatBox from './components/ChatBox';
import MessageInput from './components/MessageInput';
import './styles/globals.css';
import { RefreshCw, Bot, PlusCircle, X } from 'lucide-react';

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

  const fetchConversations = async () => {
    try {
      const response = await fetch('http://localhost:3001/conversations');
      const data = await response.json();
      setConversations(data);
    } catch (error) {
      console.error('Erreur lors du chargement des conversations:', error);
    }
  };

  const loadConversationMessages = async (conversationId) => {
    try {
      const response = await fetch(`http://localhost:3001/conversation/${conversationId}`);
      const data = await response.json();
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

  const createNewConversation = async () => {
    try {
      const response = await fetch('http://localhost:3001/conversations', {
        method: 'POST'
      });
      const data = await response.json();
      setCurrentConversationId(data.id);
      setMessages([]);
      await fetchConversations();
    } catch (error) {
      console.error('Erreur lors de la création de la conversation:', error);
    }
  };

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
      const response = await fetch('http://localhost:3001/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message,
          sessionId: currentConversationId 
        }),
      });
      
      const data = await response.json();
      
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

  const handleReset = async () => {
    setIsResetting(true);
    try {
      const response = await fetch('http://localhost:3001/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        setMessages([]);
      } else {
        console.error('Erreur lors de la réinitialisation');
      }
      
    } catch (error) {
      console.error('Erreur lors de la réinitialisation:', error);
    } finally {
      // Petit délai pour une meilleure expérience utilisateur
      setTimeout(() => {
        setIsResetting(false);
      }, 1000);
    }
  };

  const deleteConversation = async (conversationId, event) => {
    event.stopPropagation();
    
    try {
        const response = await fetch(`http://localhost:3001/conversations/${conversationId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            if (currentConversationId === conversationId) {
                setCurrentConversationId(null);
                setMessages([]);
            }
            await fetchConversations();
        } else {
            console.error('Erreur lors de la suppression:', await response.json());
        }
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
          <div className="relative flex justify-center items-center mb-6">
            <div className="flex items-center gap-2">
              <Bot className="w-8 h-8 text-black" />
              <h1 className="text-3xl font-bold text-foreground">Mini Chat</h1>
              <Bot className="w-8 h-8 text-black" />
            </div>
            <button
              onClick={handleReset}
              disabled={isResetting}
              className="absolute right-0 px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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