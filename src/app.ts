import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import groupRoutes from './routes/groups';
import assessmentRoutes from './routes/assessments';

dotenv.config();

const app = express();

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
        fontSrc: ["'self'", 'https://cdn.jsdelivr.net'],
        connectSrc: ["'self'", 'https://cdn.jsdelivr.net'],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
        imgSrc: ["'self'", 'data:', 'https:'],
        workerSrc: ["'self'"]
      }
    }
  })
);

// CORS — restrict origins in production
const allowedOrigin =
  process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGIN || 'http://localhost:3000'
    : 'http://localhost:3000';

app.use(cors({ origin: allowedOrigin, credentials: true }));

// Body parsing with size limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Static PWA files
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/assessments', assessmentRoutes);

// Serve index.html for the root — other pages are served directly as static files
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

export default app;
