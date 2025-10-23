import express from 'express';
import dotenv from 'dotenv';
import serverless from 'serverless-http';
import connectDB from './config/db';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import userRoutes from './routes/userRoute';
import dataRoute from './routes/dataRoute';
import vapiWebhookRoute from './routes/vapiWebhookRoute';

dotenv.config();

const app = express();

connectDB();

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use('/api/users', userRoutes);
app.use('/api/data', dataRoute);
app.use('/api/vapi', vapiWebhookRoute);

// Serve generated audio files
app.use('/audio', express.static('public'));

// Optional: root route to check server
app.get('/', (req, res) => {
  res.send('AI Agent Backend is running!');
});

export const handler = serverless(app);
