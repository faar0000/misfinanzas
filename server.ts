import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { processFinancialCore } from './api/process-financial.js';
import { handleLogin } from './api/auth/login.js';
import { handleCallback } from './api/auth/callback.js';
import { handleSession } from './api/auth/session.js';
import { handleLogout } from './api/auth/logout.js';
import { handleGuardar } from './api/finanzas/guardar.js';
import { handleCargar } from './api/finanzas/cargar.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Enable JSON parser with large payload limit for image OCR & voice base64 data
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    hasOAuth: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    time: new Date().toISOString()
  });
});

// Google OAuth Web Server Flow Routes (Vercel & Express compatible)
app.get('/api/auth/login', handleLogin);
app.get('/api/auth/callback', handleCallback);
app.get('/api/auth/session', handleSession);
app.post('/api/auth/session', handleSession);
app.post('/api/auth/logout', handleLogout);

// Google Drive & Google Sheets Proxy Routes
app.post('/api/finanzas/guardar', handleGuardar);
app.get('/api/finanzas/cargar', handleCargar);

// Process Financial Operation Route
app.post('/api/process-financial', async (req, res) => {
  try {
    const result = await processFinancialCore(req.body);
    return res.json(result);
  } catch (err: any) {
    console.error('API /api/process-financial Exception:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Error interno del servidor',
    });
  }
});

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

start();
