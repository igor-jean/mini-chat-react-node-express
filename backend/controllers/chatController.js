import { generateLlamaResponse } from '../services/llamaService.js';
import { extractEntities } from '../config/nlpConfig.js';
import { LLAMA_PARAMS } from '../config/llamaConfig.js';
import { 
    insertNewMessage, 
    updateUserInformation, 
    buildUserContext, 
    getRelevantMessages, 
    insertAssistantMessage,
    queries,
    db,
    calculateTokens,
    createNewVersionGroup,
    updateVersionGroup,
    getMessageVersionsWithValidation
} from '../db/database.js';

export const handleChat = async (req, res) => {
    try {
        let { message, conversationId, versionId } = req.body;
        const now = new Date().toISOString();
        const startTime = Date.now();

        // Configuration du streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        console.log('\n=== Nouvelle requête chat ===');
        console.log('Timestamp:', new Date(now).toLocaleString('fr-FR'));
        console.log('Message reçu:', message);

        const nlpResult = await extractEntities(message);
        
        console.log('\n=== Analyse NLP ===');
        if (Object.keys(nlpResult.entities).length > 0) {
            console.log('Entités détectées:');
            Object.entries(nlpResult.entities).forEach(([type, value]) => {
                console.log(`  - ${type}: ${value}`);
            });
        } else {
            console.log('Aucune entité détectée');
        }
        
        console.log('\nLangue détectée:', nlpResult.language);
        console.log('-------------------');

        let conversation = queries.getConversation.get(conversationId);
        if (!conversation) {
            const result = queries.insertConversation.run('', now);
            conversationId = result.lastInsertRowid;
            conversation = { title: '' };
        }

        if (Object.keys(nlpResult.entities).length > 0) {
            updateUserInformation(conversationId, nlpResult.entities);
        }

        if (!conversation.title) {
            let title = message.length > 40 ? message.substring(0, 40) + '...' : message;
            queries.updateConversationTitle.run(title, conversationId);
        }

        const userMessageId = insertNewMessage(conversationId, 'user', message, now);

        let conversationContext = buildUserContext(conversationId);
        const userContextTokens = calculateTokens(conversationContext);
        
        if (versionId) {
            const availableTokens = LLAMA_PARAMS.truncation_length - 1000 - userContextTokens;
            const relevantMessages = getRelevantMessages(versionId, availableTokens);
            const messageContexts = relevantMessages.map(msg => 
                `<|start_header_id|>${msg.role}<|end_header_id|>${msg.content}<|eot_id|>`
            );
            conversationContext += messageContexts.join('\n');
        }

        let fullResponse = '';
        try {
            const responseGenerator = generateLlamaResponse(conversationContext, message);
            
            for await (const chunk of responseGenerator) {
                fullResponse += chunk;
                res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
            }
        } catch (error) {
            console.error('Erreur lors de la génération de la réponse:', error);
            res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
            return res.end();
        }
        
        const assistantMessageId = insertAssistantMessage(
            conversationId,
            fullResponse,
            startTime
        );

        let finalVersionId;
        if (versionId) {
            const currentVersion = queries.getVersionGroup.get(versionId);
            if (currentVersion) {
                const currentGroup = JSON.parse(currentVersion.version_group);
                currentGroup.push(userMessageId, assistantMessageId);
                finalVersionId = updateVersionGroup(versionId, currentGroup);
            } else {
                finalVersionId = createNewVersionGroup(conversationId, [userMessageId, assistantMessageId]);
            }
        } else {
            const latestVersion = queries.getLatestVersionGroup.get(conversationId);
            finalVersionId = createNewVersionGroup(conversationId, [userMessageId, assistantMessageId]);
        }
        
        queries.updateConversationTimestamp.run(now, conversationId);

        res.write(`data: ${JSON.stringify({ 
            done: true,
            conversationId,
            userMessageId,
            assistantMessageId,
            versionId: finalVersionId
        })}\n\n`);
        
        res.end();
    } catch (error) {
        console.error('Erreur:', error);
        res.write(`data: ${JSON.stringify({ 
            error: 'Erreur lors de l\'exécution',
            details: error.message 
        })}\n\n`);
        res.end();
    }
};

export const handleMessageUpdate = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { content } = req.body;
        const now = new Date().toISOString();
        const startTime = Date.now();

        // Configuration du streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        const originalMessage = db.prepare(`
            SELECT conversation_id, ordre, role
            FROM messages 
            WHERE id = ?
        `).get(messageId);

        if (!originalMessage) {
            res.write(`data: ${JSON.stringify({ error: 'Message non trouvé' })}\n\n`);
            return res.end();
        }

        const currentVersion = queries.getLatestVersionGroup.get(originalMessage.conversation_id);
        if (!currentVersion) {
            res.write(`data: ${JSON.stringify({ error: 'Groupe de versions non trouvé' })}\n\n`);
            return res.end();
        }

        const currentGroup = JSON.parse(currentVersion.version_group);
        const messageIndex = currentGroup.indexOf(parseInt(messageId));

        if (messageIndex === -1) {
            res.write(`data: ${JSON.stringify({ error: 'Message non trouvé dans le groupe de versions' })}\n\n`);
            return res.end();
        }

        const nbTokens = calculateTokens(content);
        const newMessageId = queries.insertMessage.run(
            originalMessage.conversation_id,
            originalMessage.role,
            content,
            now,
            originalMessage.ordre,
            nbTokens,
            null
        ).lastInsertRowid;

        let newGroup;
        if (messageIndex === 0) {
            newGroup = [newMessageId];
        } else {
            newGroup = [...currentGroup.slice(0, messageIndex), newMessageId];
        }

        const messages = newGroup.map(id => {
            return db.prepare('SELECT role, content FROM messages WHERE id = ?').get(id);
        });

        const conversationContext = messages
            .map(msg => `<|start_header_id|>${msg.role}<|end_header_id|>${msg.content}<|eot_id|>`)
            .join('\n');

        let fullResponse = '';
        try {
            const responseGenerator = generateLlamaResponse(conversationContext, content);
            
            for await (const chunk of responseGenerator) {
                fullResponse += chunk;
                res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
            }
        } catch (error) {
            console.error('Erreur lors de la génération de la réponse:', error);
            res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
            return res.end();
        }

        const assistantNbTokens = calculateTokens(fullResponse);
        const assistantMessageId = queries.insertMessage.run(
            originalMessage.conversation_id,
            'assistant',
            fullResponse,
            now,
            originalMessage.ordre + 1,
            assistantNbTokens,
            Date.now() - startTime
        ).lastInsertRowid;

        newGroup.push(assistantMessageId);

        const finalVersionId = createNewVersionGroup(originalMessage.conversation_id, newGroup);

        res.write(`data: ${JSON.stringify({ 
            done: true,
            messageId: newMessageId,
            assistantMessageId,
            versionId: finalVersionId,
            timestamp: now
        })}\n\n`);
        
        res.end();
    } catch (error) {
        console.error('Erreur:', error);
        res.write(`data: ${JSON.stringify({ 
            error: 'Erreur lors de la modification',
            details: error.message 
        })}\n\n`);
        res.end();
    }
};

export const getMessageVersions = async (req, res) => {
    try {
        const { messageId } = req.params;
        
        const messageInfo = db.prepare(`
            SELECT conversation_id, ordre 
            FROM messages 
            WHERE id = ?
        `).get(messageId);
        

        if (!messageInfo) {
            return res.status(404).json({ 
                error: 'Message non trouvé' 
            });
        }

        try {
            const versionsInfo = getMessageVersionsWithValidation(messageInfo.ordre, messageInfo.conversation_id);
            
            res.json({
                messageId,
                totalGroups: versionsInfo.totalGroups,
                versionGroups: versionsInfo.versionGroups
            });
        } catch (error) {
            console.error('Error in getMessageVersionsWithValidation:', error);
            res.status(500).json({ 
                error: 'Erreur lors de la validation des versions',
                details: error.message,
                stack: error.stack
            });
        }
    } catch (error) {
        console.error('Error in /messages/:messageId/versions:', error);
        res.status(500).json({ 
            error: 'Erreur lors de la récupération des versions',
            details: error.message,
            stack: error.stack
        });
    }
}; 