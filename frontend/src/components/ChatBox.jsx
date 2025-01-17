import React, { useEffect, useRef } from 'react';
import Message from './Message';

// Composant ChatBox qui affiche la liste des messages et gère le défilement automatique
// props:
//   - messages: tableau des messages à afficher
//   - currentConversationId: ID de la conversation actuelle
//   - onMessageUpdate: fonction pour mettre à jour un message
//   - currentVersionId: ID de la version actuellement affichée
//   - onVersionChange: fonction pour changer de version

const ChatBox = ({ 
  messages, 
  currentConversationId, 
  onMessageUpdate, 
  currentVersionId,
  onVersionChange 
}) => {
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);

  const scrollToBottom = () => {
    if (containerRef.current) {
      const { scrollHeight, clientHeight } = containerRef.current;
      containerRef.current.scrollTop = scrollHeight - clientHeight;
    }
  };

  // Défilement lors d'un nouveau message ou pendant le streaming
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && (lastMessage.isStreaming || lastMessage.type === 'user')) {
      scrollToBottom();
    }
  }, [messages]);

  return (
    <div 
      ref={containerRef}
      className="relative h-[700px] border border-border p-6 overflow-y-auto mb-5 bg-background shadow-sm"
    >
      {messages.map((message, index) => (
        <Message 
          key={index}
          type={message.type}
          content={message.content}
          responseTime={message.responseTime}
          nbTokens={message.nbTokens}
          timestamp={message.timestamp}
          showSpinner={message.type === 'assistant' && !message.content && !message.isStreaming}
          conversationId={currentConversationId}
          ordre={message.ordre}
          messageId={message.messageId}
          onMessageUpdate={onMessageUpdate}
          isDivergencePoint={message.isDivergencePoint}
          availableVersions={message.availableVersions || []}
          currentVersionId={currentVersionId}
          onVersionChange={onVersionChange}
          isStreaming={message.isStreaming}
        />
      ))}
    </div>
  );
};

export default ChatBox;
