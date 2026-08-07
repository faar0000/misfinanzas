import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

// Instancia de Gemini AI
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  return new GoogleGenAI({ apiKey });
}

// Handler principal para Vercel Serverless Function
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const expectedVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'asistente_financiero_token';

  // 1. VALIDACIÓN DE WEBHOOK (GET) requerida por Meta for Developers
  if (req.method === 'GET') {
    const host = req.headers.host || 'misfinanzas-fir5.vercel.app';
    const parsedUrl = new URL(req.url || '', `https://${host}`);

    const mode = parsedUrl.searchParams.get('hub.mode') || (req.query?.['hub.mode'] as string) || (req.query?.mode as string);
    const token = parsedUrl.searchParams.get('hub.verify_token') || (req.query?.['hub.verify_token'] as string) || (req.query?.verify_token as string) || (req.query?.token as string);
    const challenge = parsedUrl.searchParams.get('hub.challenge') || (req.query?.['hub.challenge'] as string) || (req.query?.challenge as string);

    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'asistente_financiero_token';

    console.log('[Meta Webhook GET Verification]', { mode, token, challenge, VERIFY_TOKEN });

    // Verificación exitosa del token y retorno del challenge
    if (token === VERIFY_TOKEN && challenge) {
      console.log('✅ Webhook verificado con éxito. Respondiendo challenge:', challenge);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(String(challenge));
    }

    // Petición de prueba directa desde navegador (sin parámetros)
    if (!mode && !token && !challenge) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send('Webhook de WhatsApp en Vercel activo y listo.');
    }

    console.warn('❌ Token de verificación incorrecto o parámetros faltantes.');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(403).send('Forbidden: Token mismatch');
  }

  // 2. PROCESAMIENTO DE MENSAJES ENTRANTES (POST)
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      console.log('[Vercel Webhook POST] Mensaje recibido:', JSON.stringify(body, null, 2));

      let messageText = '';
      let senderPhone = '';

      // Estructura oficial de Meta WhatsApp Cloud API
      if (body.object === 'whatsapp_business_account') {
        const entry = body.entry?.[0];
        const change = entry?.changes?.[0]?.value;
        const message = change?.messages?.[0];

        if (message) {
          senderPhone = message.from; // Número de teléfono del usuario que escribe
          if (message.type === 'text') {
            messageText = message.text?.body || '';
          } else if (message.type === 'interactive') {
            messageText = message.interactive?.button_reply?.title || '';
          }
        }
      }

      // Si no hay texto de mensaje (o es un evento de estado como 'read'/'delivered'), responder 200 OK inmediatamente
      if (!messageText) {
        return res.status(200).json({ status: 'ignored', reason: 'Evento no requiere procesamiento' });
      }

      // Procesar el mensaje con Gemini AI
      let replyText = '';
      try {
        const ai = getGeminiClient();
        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: messageText,
          config: {
            systemInstruction: `Eres un asistente de finanzas personales amable y eficiente. 
Analiza el mensaje del usuario (por ejemplo: "Gasté 50 en almuerzo", "Cobré 1200 por un trabajo", etc.).
Responde de forma clara, amigable y estructurada con emojis confirmando el registro de la transacción financiero y dando un breve consejo si aplica.`,
          },
        });

        replyText = response.text || 'Mensaje procesado correctamente.';
      } catch (err: any) {
        console.error('[Gemini Error]:', err?.message || err);
        replyText = `✅ *Registro anotado:* "${messageText}"\n(Procesado en modo directo)`;
      }

      // Enviar la respuesta de vuelta a WhatsApp vía Meta Cloud API (si tenemos credenciales)
      const whatsappAccessToken = process.env.WHATSAPP_ACCESS_TOKEN;
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

      if (whatsappAccessToken && phoneNumberId && senderPhone) {
        const sendUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
        await fetch(sendUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${whatsappAccessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: senderPhone,
            type: 'text',
            text: { body: replyText },
          }),
        });
        console.log(`[WhatsApp Reply Sent] Enviado a ${senderPhone}`);
      } else {
        console.log('[WhatsApp Reply Skipped] Falta WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID en Vercel.');
      }

      return res.status(200).json({
        status: 'success',
        processedMessage: messageText,
        aiReply: replyText,
      });
    } catch (error: any) {
      console.error('[Vercel Webhook Error]:', error);
      return res.status(500).json({ error: error?.message || 'Internal Server Error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
