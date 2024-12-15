import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';
import Message from './Message';


const ChatContainer = styled.div`
  height: 500px;
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 20px;
  overflow-y: auto;
  margin-bottom: 20px;
  background-color: #f5f5f5;
`;

const ChatBox = ({ messages }) => {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <ChatContainer>
      {messages.map((message, index) => (
        <Message 
          key={index}
          type={message.type}
          content={message.content}
          showSpinner={message.type === 'assistant' && message.content === 'En train de réfléchir...'}
        />
      ))}
      <div ref={messagesEndRef} />
    </ChatContainer>
  );
};

export default ChatBox;
