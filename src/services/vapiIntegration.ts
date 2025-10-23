import axios from 'axios';

const VAPI_API_KEY = process.env.VAPI_PRIVATE_KEY || '';
const VAPI_AGENT_ID = process.env.VAPI_AGENT_ID || '';
const VAPI_API_URL = 'https://api.vapi.ai';

interface VapiCallRequest {
  assistantId?: string;
  customerNumber?: string;
  customerName?: string;
  metadata?: any;
}

interface VapiCallResponse {
  id: string;
  status: string;
  [key: string]: any;
}

export async function startVapiCall(request: VapiCallRequest): Promise<VapiCallResponse> {
  if (!VAPI_API_KEY || !VAPI_AGENT_ID) {
    throw new Error('VAPI_PRIVATE_KEY or VAPI_AGENT_ID not configured');
  }

  try {
    const payload = {
      assistantId: request.assistantId || VAPI_AGENT_ID,
      customerNumber: request.customerNumber,
      customerName: request.customerName || 'Customer',
      metadata: request.metadata || {}
    };

    console.log('Starting VAPI call:', { customerNumber: request.customerNumber, assistantId: payload.assistantId });

    const response = await axios.post(`${VAPI_API_URL}/call`, payload, {
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('VAPI call started successfully:', response.data);
    return response.data;
  } catch (error: any) {
    const errorMsg = error.response?.data?.message || error.message || String(error);
    console.error('VAPI call error:', errorMsg);
    throw new Error(`VAPI call failed: ${errorMsg}`);
  }
}

export async function getVapiCallStatus(callId: string): Promise<VapiCallResponse> {
  if (!VAPI_API_KEY) {
    throw new Error('VAPI_PRIVATE_KEY not configured');
  }

  try {
    const response = await axios.get(`${VAPI_API_URL}/call/${callId}`, {
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error: any) {
    const errorMsg = error.response?.data?.message || error.message || String(error);
    console.error('VAPI get status error:', errorMsg);
    throw new Error(`Failed to get VAPI call status: ${errorMsg}`);
  }
}

export default {
  startVapiCall,
  getVapiCallStatus
};
