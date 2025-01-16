import express from 'express';
import { 
    getConversations, 
    createConversation, 
    getLatestVersion, 
    getVersionMessages,
    deleteConversation,
} from '../controllers/conversationController.js';

const router = express.Router();

router.get('/conversations', getConversations);
router.post('/conversations', createConversation);
router.get('/conversations/:id/latest-version', getLatestVersion);
router.get('/versions/:id/messages', getVersionMessages);
router.delete('/conversations/:id', deleteConversation);

export default router; 