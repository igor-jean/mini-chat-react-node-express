import express from 'express';
import { 
    getConversations, 
    createConversation, 
    getLatestVersion, 
    getVersionMessages,
    deleteConversation,
    resetConversation
} from '../controllers/conversationController.js';

const router = express.Router();

router.get('/conversations', getConversations);
router.post('/conversations', createConversation);
router.get('/conversations/:id/latest-version', getLatestVersion);
router.get('/versions/:id/messages', getVersionMessages);
router.delete('/conversations/:id', deleteConversation);
router.post('/reset/:id', resetConversation);

export default router; 