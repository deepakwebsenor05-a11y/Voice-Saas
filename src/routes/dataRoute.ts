import express from 'express';
import upload from '../config/upload';
import * as dataController from '../controller/dataController';
import { startTwilioCallSession } from '../services/callWorkerTwilio';
import { verifyToken } from '../middleware/authMiddleware';

const router = express.Router();

router.use(verifyToken);

// File routes
router.post('/upload/excel', upload.single('file'), dataController.uploadExcel);
router.get('/files', dataController.getFiles);
router.get('/file/:fileId', dataController.getFile);
router.delete('/file/:fileId', dataController.deleteFile);

// Sheet routes
router.post('/sheets/connect', dataController.connectSheet);
router.get('/sheets', dataController.getSheets);
router.get('/sheet/:sheetId', dataController.getSheet); // Get individual sheet data
router.post('/sheets/refresh/:sheetId', dataController.refreshSheet); // Refresh sheet data
router.delete('/sheet/:sheetId', dataController.deleteSheet);

// Stats
router.get('/stats', dataController.getStats);

// Start ad-hoc call session (numbers: string[])
router.post('/call', async (req, res) => {
	try {
		const numbers = req.body.numbers;
		if (!Array.isArray(numbers) || numbers.length === 0) return res.status(400).json({ error: 'No numbers provided' });
		const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
		startTwilioCallSession(sessionId, numbers, undefined).catch((e) => console.error('Twilio session error', e));
		res.status(202).json({ sessionId });
	} catch (err: any) {
		res.status(500).json({ error: err.message || String(err) });
	}
});

export default router;
