export const VAPI_CONFIG = {
  API_KEY: process.env.VAPI_API_KEY || '',
  ASSISTANT_ID: process.env.ASSISTANT_ID || '',
  PHONE_NUMBER_ID: process.env.PHONE_NUMBER_ID || '',
  CALL_DELAY_MS: Number(process.env.VAPI_CALL_DELAY_MS || '500'),
  RETRY_ATTEMPTS: Number(process.env.VAPI_RETRY_ATTEMPTS || '1')
};

