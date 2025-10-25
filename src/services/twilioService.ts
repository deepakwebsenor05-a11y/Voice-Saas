import Twilio from 'twilio';

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_NUMBER = process.env.TWILIO_PHONE_NUMBER || '';

// Small helper to mask sensitive values in logs
function mask(s: string) {
  if (!s) return '(missing)';
  if (s.length <= 8) return s.replace(/./g, '*');
  return `${s.slice(0,4)}...${s.slice(-4)}`;
}

if (!ACCOUNT_SID || !AUTH_TOKEN || !TWILIO_NUMBER) {
  console.warn('Twilio configuration incomplete. Ensure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER are set.');
} else {
  // print only masked values to help diagnose which credential may be missing/incorrect (no secrets leaked)
  console.log('Twilio configured:', { account: mask(ACCOUNT_SID), from: TWILIO_NUMBER });
}

const client = Twilio(ACCOUNT_SID, AUTH_TOKEN);

export async function makeCallWithAudio(to: string, audioUrl: string) {
  if (!ACCOUNT_SID || !AUTH_TOKEN || !TWILIO_NUMBER) throw new Error('Twilio not configured');
  // Twilio expects full URL; caller should prefix with your public host
  try {
    const call = await client.calls.create({
      to,
      from: TWILIO_NUMBER,
      twiml: `<Response><Play>${audioUrl}</Play></Response>`
    });
    return call;
  } catch (err: any) {
    // Twilio errors often include a response body with message/code — log safely
    const status = err?.status || err?.statusCode || 'unknown';
    const twilioMessage = err?.message || err?.response?.data || err?.response?.data?.message;
    console.error('Twilio call error', { to, status, message: twilioMessage });
    // If it's a 401, explicitly hint it's an auth issue
    if (status === 401) {
      console.error('Twilio 401 Unauthorized — check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN on the running server (Render/host).');
    }
    throw err;
  }
}

export default makeCallWithAudio;
