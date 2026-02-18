// 1. Load environment variables FIRST (must be first import)
import './env.js';

// 2. Now import everything else
import express from 'express';
import cors from 'cors';
import { initDB } from './database/db.js';

// Routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import expenseRoutes from './routes/expenses.js';
import eventsRoutes from './routes/events.js';
import settingsRoutes from './routes/settings.js';
import analyticsRoutes from './routes/analytics.js';
import jokersRoutes from './routes/gandus.js';

const app = express();

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? process.env.ALLOWED_ORIGIN || true : true,
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

// Initialize DB
initDB().catch(console.error);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/gandus', jokersRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), platform: 'vercel-serverless' });
});

// Export for Vercel
export default app;

// Local development
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
