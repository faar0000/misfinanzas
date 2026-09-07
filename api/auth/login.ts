import { getOAuth2Client, GOOGLE_SCOPES } from './_google-client.js';

export async function handleLogin(req: any, res: any) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    const errorMsg =
      'Variables de entorno GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET no configuradas. Configúralas en Vercel o en tu archivo .env.';
    if (req.headers?.accept?.includes('application/json')) {
      return res.status(500).json({ error: errorMsg });
    }
    return res.status(500).send(`<h1>Error de Configuración</h1><p>${errorMsg}</p>`);
  }

  const oauth2Client = getOAuth2Client(req);

  // Generate Google OAuth consent URL with offline access to ensure refresh_token
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_SCOPES,
    include_granted_scopes: true,
  });

  // If requested via JSON API
  if (req.headers?.accept?.includes('application/json') && req.query?.format === 'json') {
    return res.json({ url: authUrl });
  }

  // Redirect user to Google OAuth consent screen
  res.writeHead(302, { Location: authUrl });
  res.end();
}

export default async function handler(req: any, res: any) {
  return handleLogin(req, res);
}
