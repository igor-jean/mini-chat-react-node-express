import React, { useState } from 'react';
import styled from 'styled-components';
import ChatBox from './components/ChatBox';
import MessageInput from './components/MessageInput';
import GlobalStyles from './styles/GlobalStyles';

const AppContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
`;

const Title = styled.h1`
  text-align: center;
  color: #333;
`;

const ResetButton = styled.button`
  position: absolute;
  top: 20px;
  right: 20px;
  padding: 8px 16px;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    background-color: #c82333;
  }
`;

function App() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async (message) => {
    setIsLoading(true);
    const startTime = Date.now();
    
    setMessages(prev => [...prev, 
      { type: 'user', content: message },
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
      
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = { 
          type: 'assistant', 
          content: data.response,
          responseTime: responseTime 
        };
        return newMessages;
      });
    } catch (error) {
      console.error('Erreur:', error);
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = { type: 'assistant', content: 'Désolé, une erreur est survenue.' };
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    try {
      await fetch('http://localhost:3001/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      setMessages([]);
      
    } catch (error) {
      console.error('Erreur lors de la réinitialisation:', error);
    }
  };

  return (
    <>
      <GlobalStyles />
      <AppContainer>
        <Title>Mini Chat</Title>
        <ResetButton onClick={handleReset}>
          Réinitialiser la conversation
        </ResetButton>
        <ChatBox messages={messages} isLoading={isLoading} />
        <MessageInput onSend={handleSendMessage} disabled={isLoading} />
      </AppContainer>
    </>
  );
}

export default App;