import { clearSessionCookie } from '../../lib/google-client.js';

export async function handleLogout(req: any, res: any) {
  clearSessionCookie(res);
  return res.json({ success: true, message: 'Sesión cerrada correctamente' });
}

export default async function handler(req: any, res: any) {
  return handleLogout(req, res);
}
