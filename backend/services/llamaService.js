import fetch from 'node-fetch';
import { LLAMA_PARAMS, buildPrompt } from '../config/llamaConfig.js';
import { calculateTokens } from '../db/database.js';
import { Readable } from 'stream';

export const generateLlamaResponse = async function* (conversationContext, userMessage) {
    const fullPrompt = buildPrompt(conversationContext, userMessage);

    console.log('\n=== Informations de contexte ===');
    console.log('Tokens du contexte:', calculateTokens(conversationContext));
    console.log('Nombre total de tokens:', calculateTokens(fullPrompt));
    console.log('Contexte complet:');
    console.log('-------------------');
    console.log(fullPrompt);
    console.log('-------------------\n');

    const response = await fetch('http://localhost:8080/completion', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
            prompt: fullPrompt,
            stream: true,
            ...LLAMA_PARAMS
        })
    });

    if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
    }

    const stream = Readable.from(response.body);
    let buffer = '';
    let accumulatedResponse = '';

    for await (const chunk of stream) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                try {
                    const data = JSON.parse(line.slice(6));
                    if (data.content) {
                        accumulatedResponse += data.content;
                        yield data.content;
                    }
                } catch (e) {
                    console.error('Erreur parsing SSE:', e);
                }
            }
        }
    }

    // Traiter le reste du buffer si nécessaire
    if (buffer && buffer.startsWith('data: ')) {
        try {
            const data = JSON.parse(buffer.slice(6));
            if (data.content) {
                accumulatedResponse += data.content;
                yield data.content;
            }
        } catch (e) {
            console.error('Erreur parsing SSE:', e);
        }
    }

    return accumulatedResponse
        .replace(/<\|eot_id\|>.*$/s, '')
        .replace(/<\|start_header_id\|>.*?<\|end_header_id\|>/g, '')
        .trim();
}; 