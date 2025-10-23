import { generateElevenAudio } from './elevenService';
import { makeCallWithAudio } from './twilioService';
import formatToE164 from '../utils/phone';
import { startVapiCall } from './vapiIntegration';
import CallLog from '../models/CallLog';

interface StartSessionOptions {
  sessionId: string;
  numbers: string[];
  messageTemplate?: string;
  userId?: string;
  fileId?: string;
  useVapi?: boolean;  // whether to connect VAPI agent
}

export const startTwilioCallSession = async (
  sessionId: string,
  numbers: string[],
  messageTemplate?: string,
  userId?: string,
  fileId?: string,
  useVapi: boolean = true
) => {
  console.log('Starting Twilio call session', sessionId, 'numbers:', numbers.length, 'useVapi:', useVapi);
  for (const raw of numbers) {
    try {
      const toRaw = String(raw).trim();
      const defaultRegion = process.env.TWILIO_DEFAULT_REGION || process.env.DEFAULT_PHONE_REGION || undefined;
      const to = formatToE164(toRaw, defaultRegion);
      if (!to) {
        console.warn('Skipping invalid phone number:', toRaw);
        continue;
      }

      // Create CallLog entry for tracking
      let callLogEntry: any = null;
      if (userId) {
        callLogEntry = await CallLog.create({
          userId,
          sessionId,
          fileId,
          phone: to,
          rawPhone: toRaw,
          status: 'pending'
        });
        console.log('CallLog created:', callLogEntry._id);
      }

      const message = messageTemplate ? messageTemplate.replace('{{number}}', to) : `Hello, this is a voice call.`;
      const audioPath = await generateElevenAudio(message);
      // audioPath is e.g. /audio/eleven_123.mp3; Twilio needs a full URL
      const host = process.env.PUBLIC_HOST || `http://localhost:${process.env.PORT || 5000}`;
      const audioUrl = host.replace(/\/$/, '') + audioPath;
      console.log('Placing call to', to, 'with audio', audioUrl);
      const resp = await makeCallWithAudio(to, audioUrl);
      const twilioCallSid = resp?.sid || resp?.callSid || null;
      console.log('Twilio call created:', twilioCallSid);

      // Update CallLog with Twilio info
      if (callLogEntry && twilioCallSid) {
        await CallLog.findByIdAndUpdate(callLogEntry._id, {
          twilioCallSid,
          status: 'in-progress'
        });
      }

      // If VAPI is enabled, start VAPI call connected to this Twilio call
      if (useVapi) {
        try {
          const vapiResp = await startVapiCall({
            customerNumber: to,
            customerName: `Customer ${to}`,
            metadata: {
              twilioSid: twilioCallSid,
              phone: to,
              userId,
              sessionId,
              fileId,
              callLogId: callLogEntry?._id
            }
          });

          const vapiCallId = vapiResp.id || vapiResp.callId;
          console.log('VAPI call started:', vapiCallId);

          // Update CallLog with VAPI info
          if (callLogEntry && vapiCallId) {
            await CallLog.findByIdAndUpdate(callLogEntry._id, {
              vapiCallId,
              vapiMetadata: vapiResp
            });
          }
        } catch (vapiErr: any) {
          console.error('VAPI start error for', to, ':', vapiErr.message);
          // VAPI failure shouldn't block the flow; Twilio call still proceeds
          if (callLogEntry) {
            await CallLog.findByIdAndUpdate(callLogEntry._id, {
              error: `VAPI start failed: ${vapiErr.message}`
            });
          }
        }
      }
    } catch (err: any) {
      console.error('Twilio call error for', raw, err && err.message ? err.message : err);
    }
    await new Promise((r) => setTimeout(r, Number(process.env.CALL_DELAY_MS || 1000)));
  }
  console.log('Twilio call session done', sessionId);
};

export default startTwilioCallSession;
