import { getSessionFromReq, clearSessionCookie } from '../../lib/google-client.js';

export async function handleSession(req: any, res: any) {
  if (req.method === 'DELETE' || (req.method === 'POST' && req.query?.action === 'logout')) {
    clearSessionCookie(res);
    return res.json({ success: true, message: 'Sesión cerrada correctamente' });
  }

  const session = getSessionFromReq(req);
  const hasOAuthEnv = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  if (!session || (!session.tokens?.refresh_token && !session.tokens?.access_token)) {
    return res.json({
      authenticated: false,
      user: null,
      hasRefreshToken: false,
      hasOAuthEnv,
    });
  }

  return res.json({
    authenticated: true,
    user: session.user,
    hasRefreshToken: Boolean(session.tokens?.refresh_token),
    hasOAuthEnv,
  });
}

export default async function handler(req: any, res: any) {
  return handleSession(req, res);
}
