import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { createSocketServer } from './server/socket.js';
import { authRouter } from './server/routes/auth.js';
import { communitiesRouter } from './server/routes/communities.js';
import { roomsRouter } from './server/routes/rooms.js';
import { messagesRouter } from './server/routes/messages.js';
import { usersRouter } from './server/routes/users.js';
import { notificationsRouter } from './server/routes/notifications.js';
import { reportsRouter } from './server/routes/reports.js';
import { statsRouter } from './server/routes/stats.js';
import { searchRouter } from './server/routes/search.js';
import { activityRouter } from './server/routes/activity.js';
import { extensionRouter } from './server/routes/extension.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// Security Headers & Rate Limiting
app.use(helmet({
  contentSecurityPolicy: false, // Turn off CSP for dev convenience with React client
  crossOriginResourcePolicy: false, // Allow loading images from different origins if needed
}));
app.use(cors());
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api', apiLimiter);

// Serve static files from the Vite build directory and uploads
app.use(express.static(path.join(__dirname, 'dist')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount API Routers
app.use('/api/auth', authRouter);
app.use('/api/communities', communitiesRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/users', usersRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/search', searchRouter);
app.use('/api/activity', activityRouter);
app.use('/api/extension', extensionRouter);

// Initialize HTTP & Socket Server
const httpServer = createSocketServer(app);

// Start Server
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});

// Handle client-side routing - MUST be after all other routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});