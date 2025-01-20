export const SYSTEM_PROMPT = `Vous êtes un assistant IA serviable, intelligent, aimable et efficace. Vous répondez toujours aux demandes des utilisateurs au mieux de vos capacités.`;

export const LLAMA_PARAMS = {
    temperature: 0.3,
    cpu_threads: 8,
    top_p: 0.92,
    min_p: 0.05,
    top_k: 40,
    n_predict: 2048,
    truncation_length: 8192,
    truncation_strategy: 1,
    repeat_penalty: 1.15,
    presence_penalty: 0.35,
    frequency_penalty: 0.35,
    stop: ["<|eot_id|>", "<|start_header_id|>"],
    n_batch: 512
};

export function buildPrompt(conversationContext, userMessage) {
    return `<|start_header_id|>system<|end_header_id|>
${SYSTEM_PROMPT}
<|eot_id|>

${conversationContext}

<|start_header_id|>user<|end_header_id|>${userMessage}<|eot_id|>
<|start_header_id|>assistant<|end_header_id|>`;
} 