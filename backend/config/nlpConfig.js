import { NlpManager } from 'node-nlp';

// Création du manager NLP
const manager = new NlpManager({ 
    languages: ['fr'],
    forceNER: true,
    nlu: { log: true }
});

// Configuration des entités personnalisées
async function setupEntities() {
    // Ajout des patterns pour la détection des entités
    manager.addRegexEntity('age', 'fr', /\b([1-9][0-9]?|1[01][0-9]|120)\b(?:\s*ans?)?/i);
    manager.addRegexEntity('email', 'fr', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);

    // Patterns pour la détection des noms
    const namePatterns = [
        'je m\'appelle (.*?)(?=\\s|$|,|\\.|et)',
        'mon nom est (.*?)(?=\\s|$|,|\\.|et)',
        'je suis (.*?)(?=\\s|$|,|\\.|et)',
        'c\'est moi (.*?)(?=\\s|$|,|\\.|et)'
    ];

    // Patterns pour la détection des villes
    const cityPatterns = [
        'j\'habite à (.*?)(?=\\s|$|,|\\.|et)',
        'je vis à (.*?)(?=\\s|$|,|\\.|et)',
        'je viens de (.*?)(?=\\s|$|,|\\.|et)',
        'je suis de (.*?)(?=\\s|$|,|\\.|et)',
        'habitant de (.*?)(?=\\s|$|,|\\.|et)',
        'originaire de (.*?)(?=\\s|$|,|\\.|et)'
    ];

    // Ajout des patterns comme entités
    namePatterns.forEach(pattern => {
        manager.addRegexEntity('nom', 'fr', new RegExp(pattern, 'i'));
    });

    cityPatterns.forEach(pattern => {
        manager.addRegexEntity('ville', 'fr', new RegExp(pattern, 'i'));
    });

    // Entraînement du modèle
    await manager.train();
}

// Fonction pour nettoyer le texte extrait
function cleanExtractedText(text) {
    if (!text) return null;
    return text.replace(/[,.\s]+$/, '').trim();
}

// Fonction pour extraire les entités d'un message
async function extractEntities(text) {
    const result = await manager.process('fr', text);
    const entities = {};

    // Extraction du nom
    const nomMatch = text.match(/je m'appelle (.*?)(?=\s|$|,|\.|et)|mon nom est (.*?)(?=\s|$|,|\.|et)|je suis (.*?)(?=\s|$|,|\.|et)/i);
    if (nomMatch) {
        entities.nom = cleanExtractedText(nomMatch[1] || nomMatch[2] || nomMatch[3]);
    }

    // Extraction de l'âge
    const ageMatch = text.match(/\b([1-9][0-9]?|1[01][0-9]|120)\b(?:\s*ans?)?/i);
    if (ageMatch) {
        entities.age = ageMatch[1];
    }

    // Extraction de la ville
    const villeMatch = text.match(/(?:j'habite à|je vis à|je viens de|je suis de|habitant de|originaire de)\s+(.*?)(?=\s|$|,|\.|et)/i);
    if (villeMatch) {
        entities.ville = cleanExtractedText(villeMatch[1]);
    }

    // Extraction de l'email
    const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    if (emailMatch) {
        entities.email = emailMatch[0];
    }

    // Log pour le débogage
    console.log('\n=== Entités détectées ===');
    if (Object.keys(entities).length > 0) {
        Object.entries(entities).forEach(([type, valeur]) => {
            console.log(`${type}: ${valeur}`);
        });
    } else {
        console.log('Aucune entité détectée');
    }
    console.log('------------------------\n');

    return {
        entities,
        sentiment: result.sentiment,
        language: result.language
    };
}

// Initialisation
setupEntities().catch(console.error);

export { manager, extractEntities }; 