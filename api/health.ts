import type { Request, Response } from 'express';

export default function handler(req: any, res: any) {
  const hasApiKey = Boolean(process.env.GEMINI_API_KEY);
  return res.status(200).json({
    status: 'ok',
    hasApiKey,
    environment: process.env.VERCEL ? 'Vercel Serverless' : 'Node Container Server',
    time: new Date().toISOString()
  });
}
