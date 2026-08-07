import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getWhatsAppTransactions } from '../../src/lib/waStore';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Allow CORS for fetching transactions from web app
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const list = getWhatsAppTransactions();

  return res.status(200).json({
    success: true,
    count: list.length,
    transactions: list,
  });
}
