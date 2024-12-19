import React from 'react';
import ClipLoader from 'react-spinners/ClipLoader';
import { Bot, User } from 'lucide-react';

// Composant Message qui affiche un message individuel avec son style et ses métadonnées
// props:
//   - type: 'user' ou 'assistant' pour déterminer le style et la position
//   - content: contenu du message
//   - showSpinner: booléen pour afficher un spinner de chargement
//   - responseTime: temps de réponse pour les messages de l'assistant
//   - timestamp: horodatage du message
const Message = ({ type, content, showSpinner, responseTime, timestamp }) => {
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
        {/* Bulle du message avec couleur conditionnelle */}
        <div className={`
          px-4 py-2 rounded-[0.5rem] text-white relative
          ${type === 'user' 
            ? 'bg-primary' 
            : 'bg-secondary'}
        `}>
          {content}
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
