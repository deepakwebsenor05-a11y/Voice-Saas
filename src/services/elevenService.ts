import axios from 'axios';
import fs from 'fs';
import path from 'path';

const ELEVEN_API_KEY = process.env.ELEVEN_API_KEY || '';
const VOICE_ID = process.env.ELEVEN_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

export async function generateElevenAudio(text: string): Promise<string> {
  if (!ELEVEN_API_KEY) throw new Error('ELEVEN_API_KEY not set');
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;
  const resp = await axios.post(url, {
    text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: { stability: 0.5, similarity_boost: 0.75 }
  }, {
    headers: { 'xi-api-key': ELEVEN_API_KEY, 'Content-Type': 'application/json' },
    responseType: 'arraybuffer'
  });

  const outDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const fileName = `eleven_${Date.now()}.mp3`;
  const filePath = path.join(outDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(resp.data));
  return `/audio/${fileName}`; // return relative path to be served by express static
}

export default generateElevenAudio;
