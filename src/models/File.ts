import mongoose, { Document, Schema } from 'mongoose';

export interface IFile extends Document {
  filename: string;
  path: string;
  size: number;
  userId: mongoose.Types.ObjectId;
  rows?: any[];
  rowCount?: number;
  columns?: string[];
  uploadedAt?: Date;
  name?: string;
  type?: string;
  data?: any[];
  createdAt?: Date;
}

const fileSchema: Schema = new Schema({
  name: {
    type: String
  },
  filename: {
    type: String,
    required: true
  },
  type: {
    type: String
  },
  data: [{ type: Schema.Types.Mixed }],
  path: {
    type: String,
    required: true
  },
  size: {
    type: Number,
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
  rowCount: {
    type: Number,
    default: 0
  },
  columns: [{
    type: String
  }],
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

export default mongoose.model<IFile>('File', fileSchema);
