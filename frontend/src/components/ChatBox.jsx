import React, { useEffect, useRef } from 'react';
import Message from './Message';
import ClipLoader from 'react-spinners/ClipLoader';

// Composant ChatBox qui affiche la liste des messages et gère le défilement automatique
// props:
//   - messages: tableau des messages à afficher
//   - isLoading: booléen indiquant si un chargement est en cours
//   - isResetting: booléen indiquant si une réinitialisation est en cours
const ChatBox = ({ messages, isLoading, isResetting }) => {
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
    <div className="relative h-[500px] border border-border p-6 overflow-y-auto mb-5 bg-background shadow-sm">
      {/* Affiche un overlay avec spinner pendant la réinitialisation */}
      {isResetting && (
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center rounded-2xl z-50">
          <div className="flex flex-col items-center gap-4">
            <ClipLoader color="white" size={40} />
            <span className="text-white font-medium">Réinitialisation...</span>
          </div>
        </div>
      )}
      
      {/* Affiche la liste des messages avec leurs propriétés */}
      {messages.map((message, index) => (
        <Message 
          key={index}
          type={message.type}
          content={message.content}
          responseTime={message.responseTime}
          timestamp={message.timestamp}
          // Affiche un spinner si c'est un message de l'assistant en cours de réflexion
          showSpinner={message.type === 'assistant' && message.content === 'En train de réfléchir...'}
        />
      ))}
      
      {/* Élément invisible utilisé comme référence pour le défilement */}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatBox;
