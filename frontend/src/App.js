import React from 'react';
import ChatBox from './components/ChatBox';
import MessageInput from './components/MessageInput';
import './styles/globals.css';
import { Bot, PlusCircle, X } from 'lucide-react';
import { useChat } from './hooks/useChat';

function App() {
  const {
    messages,
    conversations,
    currentConversationId,
    isLoading,
    currentVersionId,
    handleSendMessage,
    handleMessageUpdate,
    handleVersionChange,
    createNewConversation,
    deleteConversation,
    setCurrentConversationId
  } = useChat();

  return (
    <div className="min-h-screen bg-background p-12">
      <div className="min-w-6xl mx-auto p-4 flex gap-4">
        <div className="w-96 border border-border rounded-2xl p-4">
          <button
            onClick={createNewConversation}
            disabled={conversations.length === 0}
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
              onClick={(e) => currentConversationId && deleteConversation(currentConversationId, e)}
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
            currentVersionId={currentVersionId}
            onVersionChange={handleVersionChange}
          />
          <MessageInput 
            onSend={handleSendMessage} 
            disabled={isLoading} 
          />
        </div>
      </div>
    </div>
  );
}

export default App;