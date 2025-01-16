import React, { useState, useEffect } from 'react';
import ClipLoader from 'react-spinners/ClipLoader';
import { Bot, User, Edit, Check, X, ChevronLeft, ChevronRight, Clock, Clock1, Clock12 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';

// Composant Message qui affiche un message individuel avec son style et ses métadonnées
// props:
//   - type: 'user' ou 'assistant' pour déterminer le style et la position
//   - content: contenu du message
//   - showSpinner: booléen pour afficher un spinner de chargement
//   - responseTime: temps de réponse pour les messages de l'assistant
//   - timestamp: horodatage du message
//   - messageId: ID du message
//   - availableVersions: tableau des versions disponibles pour ce message
//   - isDivergencePoint: booléen indiquant si ce message est un point de divergence
//   - currentVersionId: ID de la version actuellement affichée
//   - onMessageUpdate: fonction appelée lors de la modification d'un message
//   - onVersionChange: fonction appelée lors du changement de version
//   - conversationId: ID de la conversation
const Message = ({ 
  type, 
  content, 
  showSpinner, 
  responseTime, 
  nbTokens,
  timestamp, 
  messageId, 
  onMessageUpdate, 
  availableVersions = [],
  isDivergencePoint = false,
  currentVersionId,
  onVersionChange,
  conversationId
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [isUpdating, setIsUpdating] = useState(false);

  // Réinitialiser l'état d'édition lors du changement de conversation
  useEffect(() => {
    setIsEditing(false);
    setEditedContent(content);
    setIsUpdating(false);
  }, [conversationId, content]);

  const handleSaveEdit = async () => {
    try {
      if (editedContent !== content) {
        setIsUpdating(true);
        await onMessageUpdate(messageId, editedContent);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Erreur lors de la modification du message:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className={`flex flex-col ${type === 'user' ? 'items-end' : 'items-start'} mb-3`}>
      <div className={`flex ${type === 'user' ? 'justify-end' : 'justify-start'} items-end`}>
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
            {type === 'user' && !isUpdating && (
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
                        setEditedContent(content);
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
              <ReactMarkdown 
                rehypePlugins={[rehypeHighlight]} 
                className="prose prose-lg text-white prose-headings:text-blue-400 prose-p:text-white prose-strong:text-white"
              >
                {content}
              </ReactMarkdown>
            ) : (
              isEditing ? (
                <textarea 
                  className='w-full bg-transparent outline-none text-white resize-none min-h-[24px] overflow-y-hidden'
                  value={editedContent}
                  onChange={(e) => {
                    setEditedContent(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  ref={(textarea) => {
                    if (textarea) {
                      textarea.style.height = 'auto';
                      textarea.style.height = textarea.scrollHeight + 'px';
                    }
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
            {isUpdating && (
              <div className="absolute inset-0 bg-primary/50 rounded-[0.5rem] flex items-center justify-center">
                <ClipLoader color="white" size={20} />
              </div>
            )}
          </div>

          {/* Contrôles de version - uniquement pour les points de divergence */}
          {type === 'user' && isDivergencePoint && availableVersions && availableVersions.length > 1 && (
            <div className="flex items-center gap-2 mt-2 bg-accent/10 px-2 py-1 rounded-md">
              <button
                onClick={() => {
                  const currentGroupIndex = availableVersions.findIndex(
                    group => group && group.versions && Array.isArray(group.versions) && 
                    group.versions.some(v => v && v.versionId === parseInt(currentVersionId))
                  );
                  if (currentGroupIndex > 0 && availableVersions[currentGroupIndex - 1]?.versions?.[0]?.versionId) {
                    const nextVersionId = availableVersions[currentGroupIndex - 1].versions[0].versionId;
                    onVersionChange(messageId, nextVersionId);
                  }
                }}
                className="p-1 hover:bg-accent rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!currentVersionId || availableVersions.findIndex(
                  group => group && group.versions && Array.isArray(group.versions) && 
                  group.versions.some(v => v && v.versionId === parseInt(currentVersionId))
                ) <= 0}
                title="Version précédente"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="min-w-[3rem] text-center text-sm">
                {(() => {
                  const currentGroupIndex = availableVersions.findIndex(
                    group => group && group.versions && Array.isArray(group.versions) && 
                    group.versions.some(v => v && v.versionId === parseInt(currentVersionId))
                  );
                  return currentGroupIndex >= 0 ? `${currentGroupIndex + 1}/${availableVersions.length}` : '-';
                })()}
              </div>

              <button
                onClick={() => {
                  const currentGroupIndex = availableVersions.findIndex(
                    group => group && group.versions && Array.isArray(group.versions) && 
                    group.versions.some(v => v && v.versionId === parseInt(currentVersionId))
                  );
                  if (currentGroupIndex < availableVersions.length - 1 && availableVersions[currentGroupIndex + 1]?.versions?.[0]?.versionId) {
                    onVersionChange(messageId, availableVersions[currentGroupIndex + 1].versions[0].versionId);
                  }
                }}
                className="p-1 hover:bg-accent rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!currentVersionId || availableVersions.findIndex(
                  group => group && group.versions && Array.isArray(group.versions) && 
                  group.versions.some(v => v && v.versionId === parseInt(currentVersionId))
                ) >= availableVersions.length - 1}
                title="Version suivante"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Temps de réponse pour les messages de l'assistant */}
          {type === 'assistant' && responseTime && (
            <span className="text-xs text-muted-foreground mt-1 ml-1 flex items-center gap-1">
              <Clock12 className="w-3 h-3" />
              {(responseTime / 1000).toFixed(2)}s • {nbTokens} tokens • {(nbTokens / (responseTime / 1000)).toFixed(2)} tokens/s
            </span>
          )}
        </div>

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

        {showSpinner && (
          <div className="h-[45px] w-[45px] flex justify-center items-center">
            <ClipLoader color="var(--muted-foreground)" size={15} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Message;
