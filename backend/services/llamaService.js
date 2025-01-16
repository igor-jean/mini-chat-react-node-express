import fetch from 'node-fetch';
import { LLAMA_PARAMS, buildPrompt } from '../config/llamaConfig.js';
import { calculateTokens } from '../db/database.js';

export const generateLlamaResponse = async (conversationContext, userMessage) => {
    const fullPrompt = buildPrompt(conversationContext, userMessage);

    console.log('\n=== Informations de contexte ===');
    console.log('Tokens du contexte:', calculateTokens(conversationContext));
    console.log('Nombre total de tokens:', calculateTokens(fullPrompt));
    console.log('Contexte complet:');
    console.log('-------------------');
    console.log(fullPrompt);
    console.log('-------------------\n');

    const llamaResponse = await fetch('http://localhost:8080/completion', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            prompt: fullPrompt,
            ...LLAMA_PARAMS
        })
    });

    const data = await llamaResponse.json();
    
    return data.content
        .replace(/<\|eot_id\|>.*$/s, '')
        .replace(/<\|start_header_id\|>.*?<\|end_header_id\|>/g, '')
        .trim();
}; 