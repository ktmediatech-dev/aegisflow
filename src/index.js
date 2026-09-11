import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

import authRoutes from './routes/auth.routes.js';
import companiesRoutes from './routes/companies.routes.js';
import usersRoutes from './routes/users.routes.js';
import rolesRoutes from './routes/roles.routes.js';
import hrRoutes from './routes/hr.routes.js';
import financeRoutes from './routes/finance.routes.js';
import procurementRoutes from './routes/procurement.routes.js';
import complianceRoutes from './routes/compliance.routes.js';
import stationsRoutes from './routes/stations.routes.js';
import fleetRoutes from './routes/fleet.routes.js';
import tanksRoutes from './routes/tanks.routes.js';
import maintenanceRoutes from './routes/maintenance.routes.js';
import contractorsRoutes from './routes/contractors.routes.js';
import suppliersRoutes from './routes/suppliers.routes.js';
import alertsRoutes from './routes/alerts.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import nozzlesRoutes from './routes/nozzles.routes.js';
import deletionRequestsRoutes from './routes/deletionRequests.routes.js';
import settingsRoutes from './routes/settings.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Running behind Webuzo's reverse proxy — trust its X-Forwarded-For so
// express-rate-limit identifies real client IPs instead of the proxy's.
app.set('trust proxy', 1);

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Basic brute-force protection on login.
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use('/api/auth/login', loginLimiter);

app.get('/health', (req, res) => res.json({ ok: true }));

// Every API route lives under /api — this is what the built frontend
// (src/services/api.js) calls, and what the Vite dev proxy forwards.
// Hosting environments that run this Express process as the single
// handler for the whole subdomain (e.g. Webuzo's Node app manager) need
// the API and the static frontend on one process/port, hence the prefix
// plus the static-file serving below instead of two separate servers.
const api = express.Router();
api.use('/auth', authRoutes);
api.use('/companies', companiesRoutes);
api.use('/users', usersRoutes);
api.use('/roles', rolesRoutes);
api.use('/hr', hrRoutes);
api.use('/finance', financeRoutes);
api.use('/procurement', procurementRoutes);
api.use('/compliance', complianceRoutes);
api.use('/stations', stationsRoutes);
api.use('/fleet', fleetRoutes);
api.use('/tanks', tanksRoutes);
api.use('/maintenance', maintenanceRoutes);
api.use('/contractors', contractorsRoutes);
api.use('/suppliers', suppliersRoutes);
api.use('/alerts', alertsRoutes);
api.use('/analytics', analyticsRoutes);
api.use('/nozzles', nozzlesRoutes);
api.use('/deletion-requests', deletionRequestsRoutes);
api.use('/settings', settingsRoutes);
app.use('/api', api);

// API error handler — must come right after the API routes so it only
// ever produces JSON, never the SPA fallback below.
app.use('/api', (err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Serve the built React app (npm run build -> dist/) and hand any
// non-API, non-static-file request to it so client-side routing
// (e.g. a direct hit on /stations) resolves correctly. Harmless if dist/
// doesn't exist yet (e.g. `npm run server` during frontend-only dev via
// `npm run client` on a separate Vite port) — those routes just 404.
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) next();
  });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`AegisFlow listening on port ${port}`);
});
