import mongoose, { Document, Schema } from 'mongoose';

export interface ISheet extends Document {
  name: string;
  sheetId: string;
  url: string;
  userId: mongoose.Types.ObjectId;
  rows?: any[];
  rowCount?: number;
  columns?: string[];
  lastSync?: Date;
  data?: any[];
  createdAt?: Date;
}

const sheetSchema: Schema = new Schema({
  name: {
    type: String,
    required: true
  },
  sheetId: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rows: [{
    type: Schema.Types.Mixed
  }],
  data: [{ type: Schema.Types.Mixed }],
  rowCount: {
    type: Number,
    default: 0
  },
  columns: [{
    type: String
  }],
  lastSync: {
    type: Date,
    default: Date.now
  },
}, { timestamps: true });

export default mongoose.model<ISheet>('Sheet', sheetSchema);
