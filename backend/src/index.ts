import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import authRoutes from './routes/auth';
import docRoutes from './routes/documents';
import segmentRoutes from './routes/segments';
import categoryRoutes from './routes/categories';
import tagRoutes from './routes/tags';
import searchRoutes from './routes/search';
import syncRoutes from './routes/sync'; // Add this
import { errorHandler } from './middleware/errorHandler';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/documents', docRoutes);
app.use('/api/v1/segments', segmentRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/tags', tagRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/sync', syncRoutes); // Add this

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 Handler
app.all('*', (req, res, next) => {
  res.status(404).json({
    status: 'fail',
    message: `Can't find ${req.originalUrl} on this server!`,
  });
});

// Global Error Handler
app.use(errorHandler);

// Start Server
const port = env.PORT;
app.listen(port, () => {
  console.log(`
  🚀 Server running in ${env.NODE_ENV} mode
  🔊 Listening on port ${port}
  🔗 http://localhost:${port}
  `);
});