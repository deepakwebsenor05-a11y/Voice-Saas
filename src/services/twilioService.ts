import Twilio from 'twilio';

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_NUMBER = process.env.TWILIO_PHONE_NUMBER || '';

const client = Twilio(ACCOUNT_SID, AUTH_TOKEN);

export async function makeCallWithAudio(to: string, audioUrl: string) {
  if (!ACCOUNT_SID || !AUTH_TOKEN || !TWILIO_NUMBER) throw new Error('Twilio not configured');
  // Twilio expects full URL; caller should prefix with ngrok/public host or your server host
  const call = await client.calls.create({
    to,
    from: TWILIO_NUMBER,
    twiml: `<Response><Play>${audioUrl}</Play></Response>`
  });
  return call;
}

export default makeCallWithAudio;
