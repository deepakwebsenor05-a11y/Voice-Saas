import mongoose from 'mongoose';

const CallLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId: { type: String },                          // call session id from our system
  fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'File' }, // which file this call came from
  phone: { type: String, required: true },              // E.164 formatted number
  rawPhone: { type: String },                           // original user input
  twilioCallSid: { type: String },                      // Twilio call ID
  vapiCallId: { type: String },                         // VAPI call ID
  vapiAgentId: { type: String },                        // VAPI agent used
  status: { type: String, enum: ['pending', 'in-progress', 'completed', 'failed'], default: 'pending' },
  transcript: { type: String },                         // full conversation transcript
  summary: { type: String },                            // VAPI summary if provided
  messages: [{
    role: { type: String },                             // 'user', 'assistant', 'system'
    content: { type: String },
    timestamp: { type: Date, default: Date.now }
  }],
  vapiMetadata: { type: mongoose.Schema.Types.Mixed }, // raw VAPI response data
  error: { type: String },                              // error message if call failed
  duration: { type: Number },                           // call duration in seconds
  cost: { type: Number },                               // estimated cost (Twilio + ElevenLabs)
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

CallLogSchema.index({ userId: 1, createdAt: -1 });
CallLogSchema.index({ sessionId: 1 });
CallLogSchema.index({ twilioCallSid: 1 });
CallLogSchema.index({ vapiCallId: 1 });

export default mongoose.model('CallLog', CallLogSchema);
