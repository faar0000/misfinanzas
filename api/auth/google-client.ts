import { google } from 'googleapis';
import crypto from 'crypto';

export function parseCookie(header: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!header) return list;
  header.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    if (name) {
      list[name] = decodeURIComponent(parts.join('=') || '');
    }
  });
  return list;
}

export function serializeCookie(
  name: string,
  val: string,
  opt: { httpOnly?: boolean; secure?: boolean; sameSite?: string; path?: string; maxAge?: number; expires?: Date } = {}
): string {
  let enc = `${encodeURIComponent(name)}=${encodeURIComponent(val)}`;
  if (opt.maxAge !== undefined) enc += `; Max-Age=${Math.floor(opt.maxAge)}`;
  if (opt.path) enc += `; Path=${opt.path}`;
  if (opt.expires) enc += `; Expires=${opt.expires.toUTCString()}`;
  if (opt.httpOnly) enc += '; HttpOnly';
  if (opt.secure) enc += '; Secure';
  if (opt.sameSite) enc += `; SameSite=${opt.sameSite}`;
  return enc;
}

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

export const COOKIE_NAME = 'gd_tokens';
export const COOKIE_MAX_AGE_DAYS = 30;
export const COOKIE_MAX_AGE_SECONDS = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;

export interface GoogleSessionTokens {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string;
  token_type?: string;
  expiry_date?: number | null;
}

export interface GoogleSessionUser {
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface GoogleSessionData {
  tokens: GoogleSessionTokens;
  user: GoogleSessionUser;
  createdAt: number;
}

/**
 * Derives the base URL / origin from the incoming request or environment.
 */
export function getBaseUrl(req?: any): string {
  if (process.env.APP_URL && process.env.APP_URL.trim() !== '') {
    return process.env.APP_URL.replace(/\/+$/, '');
  }

  if (req) {
    const proto = req.headers?.['x-forwarded-proto'] || (req.connection?.encrypted ? 'https' : 'http');
    const host = req.headers?.['x-forwarded-host'] || req.headers?.host;
    if (host) {
      return `${proto}://${host}`.replace(/\/+$/, '');
    }
  }

  return 'http://localhost:3000';
}

/**
 * Returns the OAuth2 redirect URI configured or deduced.
 */
export function getRedirectUri(req?: any): string {
  const base = getBaseUrl(req);
  return `${base}/api/auth/callback`;
}

/**
 * Instantiates the google.auth.OAuth2 client with credentials.
 */
export function getOAuth2Client(req?: any) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = getRedirectUri(req);

  if (!clientId || !clientSecret) {
    console.warn(
      '⚠️ GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET no están configuradas en las variables de entorno.'
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Encodes session data safely for HttpOnly cookie storage.
 * If COOKIE_SECRET is set, signs the payload to prevent tampering.
 */
export function serializeSession(session: GoogleSessionData): string {
  const jsonStr = JSON.stringify(session);
  const secret = process.env.COOKIE_SECRET;

  if (secret) {
    const hmac = crypto.createHmac('sha256', secret).update(jsonStr).digest('hex');
    const b64 = Buffer.from(jsonStr, 'utf-8').toString('base64url');
    return `${b64}.${hmac}`;
  }

  return Buffer.from(jsonStr, 'utf-8').toString('base64url');
}

/**
 * Decodes and verifies session data from cookie.
 */
export function deserializeSession(val: string): GoogleSessionData | null {
  try {
    const secret = process.env.COOKIE_SECRET;
    let jsonStr: string;

    if (secret && val.includes('.')) {
      const [b64, signature] = val.split('.');
      jsonStr = Buffer.from(b64, 'base64url').toString('utf-8');
      const expectedHmac = crypto.createHmac('sha256', secret).update(jsonStr).digest('hex');
      if (signature !== expectedHmac) {
        console.warn('Firma de cookie de sesión inválida.');
        return null;
      }
    } else {
      const raw = val.includes('.') ? val.split('.')[0] : val;
      jsonStr = Buffer.from(raw, 'base64url').toString('utf-8');
    }

    const data = JSON.parse(jsonStr) as GoogleSessionData;
    if (data && data.tokens) {
      return data;
    }
    return null;
  } catch (err) {
    console.warn('Error deserializando cookie de sesión:', err);
    return null;
  }
}

/**
 * Reads and parses the session from request cookies.
 */
export function getSessionFromReq(req: any): GoogleSessionData | null {
  const cookieHeader = req.headers?.cookie;
  if (!cookieHeader) return null;

  const cookies = parseCookie(cookieHeader);
  const rawCookie = cookies[COOKIE_NAME];
  if (!rawCookie) return null;

  return deserializeSession(rawCookie);
}

/**
 * Sets the secure HttpOnly cookie on the response.
 */
export function setSessionCookie(res: any, session: GoogleSessionData, req?: any) {
  const serialized = serializeSession(session);
  const isProd = process.env.NODE_ENV === 'production' || (req && req.headers?.['x-forwarded-proto'] === 'https');

  const cookieStr = serializeCookie(COOKIE_NAME, serialized, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });

  appendSetCookie(res, cookieStr);
}

/**
 * Clears the session cookie on the response.
 */
export function clearSessionCookie(res: any) {
  const cookieStr = serializeCookie(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });

  appendSetCookie(res, cookieStr);
}

function appendSetCookie(res: any, cookieStr: string) {
  const existing = res.getHeader?.('Set-Cookie') || res.getHeader?.('set-cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', cookieStr);
  } else if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookieStr]);
  } else {
    res.setHeader('Set-Cookie', [existing, cookieStr]);
  }
}

export default function handler(_req: any, res: any) {
  return res.status(404).json({ error: 'Helper module, not an API route' });
}
