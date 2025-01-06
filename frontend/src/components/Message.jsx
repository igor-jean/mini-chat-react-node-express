import React, { useState } from 'react';
import ClipLoader from 'react-spinners/ClipLoader';
import { Bot, User, Edit, Check, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Composant Message qui affiche un message individuel avec son style et ses métadonnées
// props:
//   - type: 'user' ou 'assistant' pour déterminer le style et la position
//   - content: contenu du message
//   - showSpinner: booléen pour afficher un spinner de chargement
//   - responseTime: temps de réponse pour les messages de l'assistant
//   - timestamp: horodatage du message
const Message = ({ type, content, showSpinner, responseTime, timestamp }) => {
  const [isEditing, setIsEditing] = useState(false)

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
                    onClick={() => {
                      setIsEditing(false)
                      // Ajouter ici la logique pour sauvegarder les modifications
                    }} 
                  />
                  <X 
                    className="w-4 h-4 text-white/80 hover:text-white cursor-pointer" 
                    onClick={() => {
                      setIsEditing(false)
                      // Ajouter ici la logique pour annuler les modifications
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
                defaultValue={content}
                autoFocus
                onBlur={() => setIsEditing(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    setIsEditing(false)
                    // Ici vous pourrez ajouter la logique pour sauvegarder le nouveau contenu
                  }
                }}
                onChange={(e) => {
                  // Ajuste automatiquement la hauteur
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
              />
            ) : (
              content
            )
          )}
        </div>

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
