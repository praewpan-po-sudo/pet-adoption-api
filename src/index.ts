import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import categoryRoutes from './routes/category.routes';
import petRoutes from './routes/pet.routes';
import applicationRoutes from './routes/application.routes';
import uploadRoutes from './routes/upload.routes';

import path from 'path';
import shelterRoutes from './routes/shelter.routes';

dotenv.config();

const app = express();
const port = process.env.APP_PORT || 9091;

// Middlewares
app.use(cors());
app.use(express.json());
app.use('/admin', express.static(path.join(__dirname, '../public/admin')));

// Health Check
app.get('/', (_req, res) => {
  res.json({
    status: 'online',
    project: 'Pet Adoption API',
    database: 'Supabase (PostgreSQL)',
    version: '1.0.0',
    adminDashboard: 'http://localhost:' + port + '/admin',
    endpoints: {
      auth: '/api/auth',
      admin: '/admin',
      categories: '/api/categories',
      shelters: '/api/shelters',
      pets: '/api/pets',
      applications: '/api/applications',
    },
  });
});

// Register Routes
app.use('/', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/shelters', shelterRoutes);
app.use('/api/pets', petRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/upload', uploadRoutes);

// Error Handling Middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled Error:', err);
  res.status(err.status || 500).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'Something went wrong',
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`🐾 Pet Adoption API server running at: http://localhost:${port}`);
    console.log(`📡 Ready to test with api.http.simple in VS Code REST Client`);
  });
}

export { app };
export default app;
