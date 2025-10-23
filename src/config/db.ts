import mongoose from 'mongoose';

const connectDB = async (): Promise<void> => {
  try {
    if (!process.env.MONGO_URL) {
      throw new Error('MONGO_URL not set in environment');
    }
    await mongoose.connect(process.env.MONGO_URL);
    console.log('MongoDB connected');
  } catch (error: any) {
    console.error('MongoDB connection failed:', error.message || error);
    process.exit(1);
  }
};

export default connectDB;
