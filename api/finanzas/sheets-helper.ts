import { google } from 'googleapis';
import { getOAuth2Client, getSessionFromReq, setSessionCookie, GoogleSessionData } from '../auth/google-client.js';

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

    // Automatically persist refreshed access token if googleapis silently refreshed it
    oauth2Client.on('tokens', (newTokens) => {
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

  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

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
