import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { createListingsRouter } from './routes/listings.js';
import { createGarageIntakesRouter } from './routes/garage-intakes.js';
import { createGarageInspectionsRouter } from './routes/garage-inspections.js';

export function createApp(database, options = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: env.frontendOrigin }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (_request, response) => {
    try {
      await database.command({ ping: 1 });
      response.json({ status: 'ok', database: database.databaseName });
    } catch {
      response.status(503).json({ status: 'unavailable' });
    }
  });
  app.use('/api/listings', createListingsRouter(database));
  const garageAuth = options.garageAuth || {
    token: env.garageApiToken,
    userId: env.garageStaffId,
    production: process.env.NODE_ENV === 'production',
  };
  app.use('/api/garage', createGarageIntakesRouter(database, garageAuth));
  app.use('/api/garage', createGarageInspectionsRouter(database, garageAuth));

  app.use((_request, response) =>
    response.status(404).json({ error: { message: 'API route not found.' } }),
  );
  app.use((error, _request, response, _next) => {
    const status =
      Number.isInteger(error.status) &&
      error.status >= 400 &&
      error.status <= 599
        ? error.status
        : 500;
    if (status >= 500 && !error.expose) console.error(error);
    response.status(status).json({
      error: {
        message:
          status >= 500 && !error.expose
            ? 'Internal server error.'
            : error.message,
        ...(status < 500 && error.details ? { details: error.details } : {}),
      },
    });
  });
  return app;
}
