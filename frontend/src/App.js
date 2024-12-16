import React, { useState } from 'react';
import ChatBox from './components/ChatBox';
import MessageInput from './components/MessageInput';
import './styles/globals.css';
import { RefreshCw, Bot } from 'lucide-react';

function App() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

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
        body: JSON.stringify({ message }),
      });
      
      const data = await response.json();
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

  return (
    <div className="min-h-screen bg-background pt-24">
      <div className="max-w-4xl mx-auto p-4 border border-border rounded-2xl shadow-sm">
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
  );
}

export default App;