import axios from 'axios';

const VAPI_API_KEY = process.env.VAPI_PRIVATE_KEY || '';
const VAPI_AGENT_ID = process.env.VAPI_AGENT_ID || '';
const VAPI_API_URL = 'https://api.vapi.ai';

interface VapiCallRequest {
  assistantId?: string;
  customerNumber?: string;
  phoneNumberId?: string;
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
    // VAPI API schema rejects unknown top-level properties such as customerNumber/customerName.
    // Move those into the metadata object which is accepted by the VAPI /call endpoint.
    // VAPI requires either a top-level `phoneNumber` or a `phoneNumberId` (a provisioned number).
    // Provide `phoneNumber` at top-level (E.164) and also include compatibility metadata.
    const rawPhone = request.customerNumber || request.metadata?.customerNumber || request.metadata?.phoneNumber;

    // Determine if a VAPI-managed phoneNumberId is available (preferred).
    const envPhoneNumberId = process.env.PHONE_NUMBER_ID || undefined;
    const providedPhoneNumberId = request.phoneNumberId || request.metadata?.phoneNumberId || envPhoneNumberId;

    // If a phoneNumberId is provided, send that and do NOT include a phoneNumber object.
    // Otherwise, if Twilio env vars are configured, include Twilio-specific phoneNumber object.
    const twilioSid = process.env.TWILIO_ACCOUNT_SID || undefined;
    const twilioFrom = process.env.TWILIO_PHONE_NUMBER || undefined;

    let payload: any = {
      assistantId: request.assistantId || VAPI_AGENT_ID,
      metadata: {
        ...(request.metadata || {}),
        customerNumber: rawPhone,
        customerName: request.customerName || 'Customer'
      }
    };

    if (providedPhoneNumberId) {
      payload.phoneNumberId = providedPhoneNumberId;
      // When supplying a VAPI-managed number, VAPI still needs a customer object or ID
      // so it knows which customer to contact or associate with the session.
      // Provide a minimal customer object constructed from the phone we have.
      payload.customer = payload.customer || {};
      if (rawPhone) {
        payload.customer.phoneNumber = rawPhone;
      }
      if (request.customerName) {
        payload.customer.name = request.customerName;
      }
      console.log('Starting VAPI call using phoneNumberId:', providedPhoneNumberId, 'customerPreview:', payload.customer);
    } else if (twilioSid && twilioFrom) {
      // VAPI expects Twilio integration keys to be provided under phoneNumber
      // Ensure twilioPhoneNumber is in E.164 and twilioSid is present
      payload.phoneNumber = {
        twilioPhoneNumber: twilioFrom,
        twilioAccountSid: twilioSid,
        // some VAPI schemas expect customer info separately
        twilioCustomerPhoneNumber: rawPhone
      };
      // also include a minimal customer object
      payload.customer = payload.customer || {};
      if (rawPhone) payload.customer.phoneNumber = rawPhone;
      if (request.customerName) payload.customer.name = request.customerName;
      console.log('Starting VAPI call using Twilio context:', { twilioPhoneNumber: twilioFrom, twilioAccountSid: twilioSid, customerPreview: payload.customer });
    } else if (rawPhone) {
      // Last-resort: include the customer number only in metadata — provider may still reject.
      console.log('Starting VAPI call with customerNumber only (provider may require phoneNumberId or Twilio config):', rawPhone);
    } else {
      console.log('Starting VAPI call without phoneNumber/phoneNumberId');
    }

    const response = await axios.post(`${VAPI_API_URL}/call`, payload, {
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('VAPI call started successfully:', response.data);
    return response.data;
  } catch (error: any) {
    // Prefer the provider's structured error if available for clearer diagnostics
    const respData = error.response?.data;
    const errorMsg = respData?.message || respData || error.message || String(error);
    console.error('VAPI call error:', { status: error.response?.status, body: respData, message: error.message });
    throw new Error(`VAPI call failed: ${Array.isArray(respData) ? respData.join(',') : respData?.message || error.message || String(respData)}`);
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
