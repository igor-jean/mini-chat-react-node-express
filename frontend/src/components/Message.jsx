import React, { useState, useEffect } from 'react';
import ClipLoader from 'react-spinners/ClipLoader';
import { Bot, User, Edit, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Composant Message qui affiche un message individuel avec son style et ses métadonnées
// props:
//   - type: 'user' ou 'assistant' pour déterminer le style et la position
//   - content: contenu du message
//   - showSpinner: booléen pour afficher un spinner de chargement
//   - responseTime: temps de réponse pour les messages de l'assistant
//   - timestamp: horodatage du message
//   - conversationId: ID de la conversation
//   - ordre: ordre du message dans la conversation
//   - messageId: ID du message
const Message = ({ type, content, showSpinner, responseTime, timestamp, conversationId, ordre, messageId }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [versions, setVersions] = useState(null);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(0);

  // Fonction pour charger les versions du message
  const fetchVersions = async () => {
    try {
      const response = await api.get(`/messages/${messageId}/versions`);
      if (response.data.hasMultipleVersions) {
        setVersions(response.data.versions);
        // Trouver l'index de la version actuelle
        const currentIndex = response.data.versions.findIndex(v => v.content === content);
        setCurrentVersionIndex(currentIndex !== -1 ? currentIndex : 0);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des versions:', error);
    }
  };

  useEffect(() => {
    if (messageId) {
      fetchVersions();
    }
  }, [messageId]);

  // Navigation entre les versions
  const navigateVersion = (direction) => {
    const newIndex = direction === 'next' 
      ? (currentVersionIndex + 1) % versions.length 
      : (currentVersionIndex - 1 + versions.length) % versions.length;
    setCurrentVersionIndex(newIndex);
    setEditedContent(versions[newIndex].content);
  };

  const handleSaveEdit = async () => {
    try {
      if (editedContent !== content) {
        await api.post('/messages/version', {
          conversation_id: conversationId,
          ordre: ordre,
          content: editedContent
        });
        // Vous pouvez ajouter ici un callback pour mettre à jour la liste des messages
        // onMessageUpdate(editedContent);
      }
      setIsEditing(false);
    } catch (error) {
      console.error('Erreur lors de la modification du message:', error);
      // Optionnel : ajouter une notification d'erreur
    }
  };

  return (
    // Container principal avec alignement conditionnel selon le type de message
    <div className={`flex ${type === 'user' ? 'justify-end' : 'justify-start'} mb-3 items-end`}>
      {type === 'assistant' && (
        <div className="flex flex-col items-center mr-2">
          <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-secondary" />
          </div>
          {timestamp && !showSpinner && (
            <span className="text-xs text-muted-foreground">
              {timestamp}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col max-w-[70%]">
        <div className={`
          px-4 py-3 rounded-[0.5rem] text-white relative group
          ${type === 'user' 
            ? 'bg-primary' 
            : 'bg-secondary'}
        `}>
          {type === 'user' && (
            <div className="absolute right-1 bottom-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {isEditing ? (
                <div className="flex gap-1">
                  <Check 
                    className="w-4 h-4 text-white/80 hover:text-white cursor-pointer" 
                    onClick={handleSaveEdit} 
                  />
                  <X 
                    className="w-4 h-4 text-white/80 hover:text-white cursor-pointer" 
                    onClick={() => {
                      setIsEditing(false);
                      setEditedContent(content); // Réinitialiser le contenu édité
                    }} 
                  />
                </div>
              ) : (
                <Edit 
                  className="w-4 h-4 text-white/80 hover:text-white" 
                  onClick={() => setIsEditing(true)} 
                />
              )}
            </div>
          )}
          {type === 'assistant' ? (
            <ReactMarkdown className="prose prose-invert max-w-none
              prose-headings:text-blue-300
              prose-p:text-gray-100
              prose-strong:text-yellow-300
              prose-em:text-green-300
              prose-code:text-pink-300
              prose-ul:text-gray-100
              prose-li:text-gray-100">
              {content}
            </ReactMarkdown>
          ) : (
            isEditing ? (
              <textarea 
                className='w-full bg-transparent outline-none text-white resize-none min-h-[24px] overflow-y-hidden'
                value={editedContent}
                onChange={(e) => {
                  setEditedContent(e.target.value);
                  // Ajuste automatiquement la hauteur
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveEdit();
                  }
                }}
              />
            ) : (
              content
            )
          )}
        </div>

        {/* Contrôles de version */}
        {versions && versions.length > 1 && (
          <div className="flex items-center justify-center gap-2 mt-1">
            <button 
              onClick={() => navigateVersion('prev')}
              className="p-1 hover:bg-accent rounded-full"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-muted-foreground">
              Version {currentVersionIndex + 1}/{versions.length}
            </span>
            <button 
              onClick={() => navigateVersion('next')}
              className="p-1 hover:bg-accent rounded-full"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Temps de réponse pour les messages de l'assistant */}
        {type === 'assistant' && responseTime && (
          <span className="text-xs text-muted-foreground mt-1 ml-1">
            Temps de réponse : {responseTime}s
          </span>
        )}
      </div>

      {/* Avatar et timestamp pour l'utilisateur (affiché à droite) */}
      {type === 'user' && (
        <div className="flex flex-col items-center ml-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          {timestamp && (
            <span className="text-xs text-muted-foreground">
              {timestamp}
            </span>
          )}
        </div>
      )}

      {/* Spinner de chargement pendant la génération de réponse */}
      {showSpinner && (
        <div className="h-[45px] w-[45px] flex justify-center items-center">
          <ClipLoader color="var(--muted-foreground)" size={15} />
        </div>
      )}
    </div>
  );
};

export default Message;
