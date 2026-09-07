import { handleLogin } from './login.js';
import { handleSession } from './session.js';
import { handleLogout } from './logout.js';

export default async function handler(req: any, res: any) {
  const action = req.query?.action;
  if (action === 'logout' || req.method === 'DELETE') {
    return handleLogout(req, res);
  }
  if (action === 'session') {
    return handleSession(req, res);
  }
  return handleLogin(req, res);
}
