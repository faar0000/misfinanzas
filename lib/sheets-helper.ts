import { getOAuth2Client, getSessionFromReq, setSessionCookie, GoogleSessionData } from './google-client.js';

export const SPREADSHEET_TITLE = 'Control Financiero Personal';

export function getAuthenticatedClients(req: any, res: any) {
  const session = getSessionFromReq(req);

  // Check if an access token was provided directly in Authorization header, body, or query
  const authHeader = req.headers?.authorization;
  const bearerToken = authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;
  const bodyOrQueryToken = req.body?.accessToken || req.query?.accessToken;
  const directToken = (bearerToken && bearerToken !== 'backend-session' ? bearerToken : null) ||
                      (bodyOrQueryToken && bodyOrQueryToken !== 'backend-session' ? bodyOrQueryToken : null);

  const hasSession = Boolean(session && (session.tokens?.refresh_token || session.tokens?.access_token));

  if (!hasSession && !directToken) {
    const err: any = new Error('401_UNAUTHENTICATED: No hay sesión activa de Google. Por favor inicia sesión con Google Drive.');
    err.statusCode = 401;
    err.code = '401_UNAUTHENTICATED';
    throw err;
  }

  const oauth2Client = getOAuth2Client(req);

  if (directToken && (!hasSession || !session?.tokens?.refresh_token)) {
    oauth2Client.setCredentials({
      access_token: directToken,
    });
  } else if (session) {
    oauth2Client.setCredentials({
      access_token: session.tokens.access_token || undefined,
      refresh_token: session.tokens.refresh_token || undefined,
      expiry_date: session.tokens.expiry_date || undefined,
    });

    // Automatically persist refreshed access token if silently refreshed
    oauth2Client.on('tokens', (newTokens: any) => {
      try {
        const updatedSession: GoogleSessionData = {
          ...session,
          tokens: {
            ...session.tokens,
            access_token: newTokens.access_token || session.tokens.access_token,
            refresh_token: newTokens.refresh_token || session.tokens.refresh_token,
            expiry_date: newTokens.expiry_date || session.tokens.expiry_date,
          },
        };
        setSessionCookie(res, updatedSession, req);
      } catch (err) {
        console.warn('Error actualizando cookie con nuevo access_token:', err);
      }
    });
  }

  async function getAccessToken(): Promise<string> {
    if (directToken && (!hasSession || !session?.tokens?.refresh_token)) {
      return directToken;
    }
    try {
      const { token } = await oauth2Client.getAccessToken();
      if (token) return token;
    } catch {
      // Fallback to existing session token
    }
    if (session?.tokens?.access_token) return session.tokens.access_token;
    if (directToken) return directToken;
    throw new Error('401_UNAUTHENTICATED: No se pudo obtener access_token válido de Google.');
  }

  // Centralized fetch wrapper with automatic token refresh on 401
  async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<any> {
    let token = await getAccessToken();
    const makeHeaders = (t: string) => {
      const h = new Headers(options.headers || {});
      h.set('Authorization', `Bearer ${t}`);
      return h;
    };

    let apiRes = await fetch(url, {
      ...options,
      headers: makeHeaders(token),
    });

    // If 401 (expired token), attempt to refresh token automatically and retry once
    if (apiRes.status === 401 && (session?.tokens?.refresh_token || oauth2Client.credentials.refresh_token)) {
      try {
        const refreshRes = await oauth2Client.refreshAccessToken();
        const newTokens = refreshRes?.credentials;
        if (newTokens?.access_token) {
          token = newTokens.access_token;
          oauth2Client.setCredentials(newTokens);
          if (session) {
            const updatedSession: GoogleSessionData = {
              ...session,
              tokens: {
                ...session.tokens,
                access_token: newTokens.access_token,
                refresh_token: newTokens.refresh_token || session.tokens.refresh_token,
                expiry_date: newTokens.expiry_date || Date.now() + 3600 * 1000,
              },
            };
            setSessionCookie(res, updatedSession, req);
          }
          apiRes = await fetch(url, {
            ...options,
            headers: makeHeaders(token),
          });
        }
      } catch (refreshErr) {
        console.warn('No se pudo refrescar automáticamente el token de Google:', refreshErr);
      }
    }

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      const isAuth = apiRes.status === 401;
      const err: any = new Error(
        isAuth
          ? '401_UNAUTHENTICATED: Tu sesión de Google Drive ha expirado. Por favor vuelve a conectar tu cuenta de Google.'
          : `Google API error (${apiRes.status}): ${errText}`
      );
      err.statusCode = apiRes.status;
      err.code = isAuth ? '401_UNAUTHENTICATED' : `ERR_${apiRes.status}`;
      throw err;
    }

    // Try parsing JSON, or return empty object if response has no content
    const text = await apiRes.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  }

  // Lightweight fetch-based Google Drive client
  const drive = {
    files: {
      list: async (params: { q?: string; fields?: string; spaces?: string }) => {
        const url = new URL('https://www.googleapis.com/drive/v3/files');
        if (params.q) url.searchParams.set('q', params.q);
        if (params.fields) url.searchParams.set('fields', params.fields);
        if (params.spaces) url.searchParams.set('spaces', params.spaces);
        const data = await authenticatedFetch(url.toString());
        return { data };
      },
    },
  };

  // Lightweight fetch-based Google Sheets client
  const sheets = {
    spreadsheets: {
      create: async (params: { requestBody: any }) => {
        const data = await authenticatedFetch('https://sheets.googleapis.com/v4/spreadsheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params.requestBody),
        });
        return { data };
      },
      get: async (params: { spreadsheetId: string }) => {
        const data = await authenticatedFetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${params.spreadsheetId}`
        );
        return { data };
      },
      batchUpdate: async (params: { spreadsheetId: string; requestBody: any }) => {
        const data = await authenticatedFetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${params.spreadsheetId}:batchUpdate`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params.requestBody),
          }
        );
        return { data };
      },
      values: {
        get: async (params: { spreadsheetId: string; range: string }) => {
          const data = await authenticatedFetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${params.spreadsheetId}/values/${encodeURIComponent(params.range)}`
          );
          return { data };
        },
        update: async (params: {
          spreadsheetId: string;
          range: string;
          valueInputOption?: string;
          requestBody: any;
        }) => {
          const opt = params.valueInputOption || 'USER_ENTERED';
          const data = await authenticatedFetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${params.spreadsheetId}/values/${encodeURIComponent(params.range)}?valueInputOption=${opt}`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(params.requestBody),
            }
          );
          return { data };
        },
        clear: async (params: { spreadsheetId: string; range: string }) => {
          const data = await authenticatedFetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${params.spreadsheetId}/values/${encodeURIComponent(params.range)}:clear`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({}),
            }
          );
          return { data };
        },
      },
    },
  };

  return { oauth2Client, drive, sheets, session };
}

export async function findOrCreateSpreadsheet(drive: any, sheets: any, title: string = SPREADSHEET_TITLE) {
  // 1. Search in Drive
  const query = `name = '${title}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
  const searchRes = await drive.files.list({
    q: query,
    fields: 'files(id, name, webViewLink)',
    spaces: 'drive',
  });

  const files = searchRes.data.files;
  if (files && files.length > 0) {
    const file = files[0];
    return {
      id: file.id as string,
      url: (file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}`) as string,
      isNew: false,
    };
  }

  // 2. Create new spreadsheet if not found
  const createRes = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [
        { properties: { title: 'Transacciones' } },
        { properties: { title: 'Resumen Presupuesto' } },
        { properties: { title: '_DataBackup', hidden: true } },
      ],
    },
  });

  const newId = createRes.data.spreadsheetId;
  return {
    id: newId as string,
    url: (createRes.data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${newId}`) as string,
    isNew: true,
  };
}

export async function ensureBackupTabExists(sheets: any, spreadsheetId: string) {
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const tabs = meta.data.sheets || [];
    const exists = tabs.some((s: any) => s.properties?.title === '_DataBackup');
    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: '_DataBackup',
                  hidden: true,
                },
              },
            },
          ],
        },
      });
    }
  } catch (err) {
    // Tab might already exist
  }
}

export default function handler(_req: any, res: any) {
  return res.status(404).json({ error: 'Helper module, not an API route' });
}
