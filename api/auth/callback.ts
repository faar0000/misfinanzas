import { google } from 'googleapis';
import {
  getOAuth2Client,
  setSessionCookie,
  getSessionFromReq,
  GoogleSessionData,
} from './google-client.js';

export async function handleCallback(req: any, res: any) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const code = req.query?.code || url.searchParams.get('code');
    const error = req.query?.error || url.searchParams.get('error');

    if (error) {
      console.warn('OAuth callback error from Google:', error);
      res.writeHead(302, { Location: `/?auth_error=${encodeURIComponent(String(error))}` });
      return res.end();
    }

    if (!code) {
      res.writeHead(302, { Location: '/?auth_error=missing_code' });
      return res.end();
    }

    const oauth2Client = getOAuth2Client(req);
    const { tokens } = await oauth2Client.getToken(String(code));
    oauth2Client.setCredentials(tokens);

    // If Google didn't return a refresh_token (for example on re-authentication if prompt was somehow omitted),
    // retain the existing refresh_token if we already had one in the cookie
    const existingSession = getSessionFromReq(req);
    const refreshToken = tokens.refresh_token || existingSession?.tokens?.refresh_token || null;

    // Fetch user profile info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userinfo = await oauth2.userinfo.get();

    const sessionData: GoogleSessionData = {
      tokens: {
        access_token: tokens.access_token || existingSession?.tokens?.access_token || null,
        refresh_token: refreshToken,
        scope: tokens.scope || existingSession?.tokens?.scope,
        token_type: tokens.token_type || 'Bearer',
        expiry_date: tokens.expiry_date || null,
      },
      user: {
        id: userinfo.data.id || 'google-user',
        email: userinfo.data.email || null,
        displayName: userinfo.data.name || userinfo.data.email || 'Usuario Google',
        photoURL: userinfo.data.picture || null,
      },
      createdAt: Date.now(),
    };

    setSessionCookie(res, sessionData, req);

    res.writeHead(302, { Location: '/?auth=success' });
    res.end();
  } catch (err: any) {
    console.error('Error in OAuth callback:', err);
    res.writeHead(302, { Location: `/?auth_error=${encodeURIComponent(err?.message || 'token_exchange_failed')}` });
    res.end();
  }
}

export default async function handler(req: any, res: any) {
  return handleCallback(req, res);
}
