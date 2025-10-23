import express, { Request, Response } from 'express';
import { verifyToken } from '../middleware/authMiddleware';
import CallLog from '../models/CallLog';

const router = express.Router();

/**
 * POST /vapi/webhook
 * Receive events from VAPI (call.ended, transcript, etc.)
 * VAPI sends this when a call completes or updates
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { event, call, messages, summary } = req.body;

    console.log('VAPI webhook event received:', event);
    console.log('VAPI call data:', call);

    // Handle call.ended event
    if (event === 'call.ended' || event === 'call-ended' || event === 'ended') {
      const { id: vapiCallId, metadata, status, endedAt } = call || {};
      const { twilioSid, phone, userId, sessionId, fileId } = metadata || {};

      if (!vapiCallId || !phone) {
        console.warn('VAPI webhook missing required fields:', { vapiCallId, phone });
        return res.status(400).json({ success: false, message: 'Missing required fields' });
      }

      // Build transcript from messages array
      const transcript = messages
        ?.map((msg: any) => `${msg.role || 'unknown'}: ${msg.content}`)
        .join('\n') || '';

      // Update or create CallLog
      const callLog = await CallLog.findOneAndUpdate(
        { vapiCallId },
        {
          status: 'completed',
          transcript,
          summary: summary || '',
          messages: messages || [],
          vapiMetadata: call,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );

      console.log('CallLog saved:', callLog._id);

      return res.json({ success: true, data: callLog });
    }

    // Handle other events (optional)
    if (event === 'call.started' || event === 'call-started' || event === 'started') {
      const { id: vapiCallId, metadata } = call || {};
      console.log('VAPI call started:', vapiCallId);

      if (vapiCallId) {
        await CallLog.findOneAndUpdate(
          { vapiCallId },
          { status: 'in-progress', updatedAt: new Date() },
          { upsert: true }
        );
      }

      return res.json({ success: true, message: 'Call started' });
    }

    // Unknown event
    console.log('Unknown VAPI event type:', event);
    res.json({ success: true, message: 'Event logged' });
  } catch (error: any) {
    console.error('VAPI webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /vapi/calls/me
 * Fetch current user's call logs with transcripts
 * Protected by verifyToken middleware
 */
router.get('/calls/me', verifyToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const callLogs = await CallLog.find({ userId })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({ success: true, data: callLogs });
  } catch (error: any) {
    console.error('Error fetching call logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
