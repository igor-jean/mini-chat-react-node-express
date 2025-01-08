import React, { useEffect, useRef } from 'react';
import Message from './Message';
import ClipLoader from 'react-spinners/ClipLoader';

// Composant ChatBox qui affiche la liste des messages et gère le défilement automatique
// props:
//   - messages: tableau des messages à afficher

const ChatBox = ({ messages, currentConversationId, onMessageUpdate, currentVersion, onVersionChange, setVersionNumber }) => {
  // Référence vers le dernier élément pour gérer le défilement
  const messagesEndRef = useRef(null);

  // Fonction pour faire défiler la vue vers le dernier message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Effet qui déclenche le défilement à chaque nouveau message
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="relative h-[700px] border border-border p-6 overflow-y-auto mb-5 bg-background shadow-sm">
      {messages.map((message, index) => (
        <Message 
          key={index}
          type={message.type}
          content={message.content}
          responseTime={message.responseTime}
          timestamp={message.timestamp}
          showSpinner={message.type === 'assistant' && message.content === 'En train de réfléchir...'}
          conversationId={currentConversationId}
          ordre={message.ordre}
          messageId={message.messageId}
          onMessageUpdate={onMessageUpdate}
          totalVersions={message.totalVersions}
          currentVersion={currentVersion}
          onVersionChange={onVersionChange}
          setVersionNumber={setVersionNumber}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatBox;
