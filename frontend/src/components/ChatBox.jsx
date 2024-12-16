import React, { useEffect, useRef } from 'react';
import Message from './Message';
import ClipLoader from 'react-spinners/ClipLoader';

const ChatBox = ({ messages, isLoading, isResetting }) => {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="relative h-[500px] border border-border rounded-2xl p-6 overflow-y-auto mb-5 bg-background shadow-sm">
      {/* Overlay de reset */}
      {isResetting && (
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center rounded-2xl z-50">
          <div className="flex flex-col items-center gap-4">
            <ClipLoader color="white" size={40} />
            <span className="text-white font-medium">Réinitialisation...</span>
          </div>
        </div>
      )}
      
      {messages.map((message, index) => (
        <Message 
          key={index}
          type={message.type}
          content={message.content}
          responseTime={message.responseTime}
          timestamp={message.timestamp}
          showSpinner={message.type === 'assistant' && message.content === 'En train de réfléchir...'}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatBox;
