import {
  getOAuth2Client,
  setSessionCookie,
  getSessionFromReq,
  GoogleSessionData,
} from './_google-client.js';

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

    // Fetch user profile info via lightweight Google userinfo endpoint
    let userinfoData: any = {};
    try {
      if (tokens.access_token) {
        const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (userRes.ok) {
          userinfoData = await userRes.json();
        }
      }
    } catch (fetchErr) {
      console.warn('Could not fetch Google user profile info:', fetchErr);
    }

    const sessionData: GoogleSessionData = {
      tokens: {
        access_token: tokens.access_token || existingSession?.tokens?.access_token || null,
        refresh_token: refreshToken,
        scope: tokens.scope || existingSession?.tokens?.scope,
        token_type: tokens.token_type || 'Bearer',
        expiry_date: tokens.expiry_date || null,
      },
      user: {
        id: userinfoData.id || 'google-user',
        email: userinfoData.email || null,
        displayName: userinfoData.name || userinfoData.email || 'Usuario Google',
        photoURL: userinfoData.picture || null,
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
