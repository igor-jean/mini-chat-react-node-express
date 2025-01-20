import express from 'express';
import { handleChat, handleMessageUpdate, getMessageVersions } from '../controllers/chatController.js';

const router = express.Router();

// Route de chat
router.post('/chat', handleChat);
router.put('/messages/:messageId', handleMessageUpdate);
router.get('/messages/:messageId/versions', getMessageVersions);

export default router; 