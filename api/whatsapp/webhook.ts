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
    const searchParams = parsedUrl.searchParams;

    const query = req.query || {};
    const hubObj = (typeof query.hub === 'object' && query.hub !== null ? query.hub : {}) as Record<string, any>;

    // Extraer parámetros soportando URLSearchParams, req.query plano y req.query.hub anidado
    const mode =
      searchParams.get('hub.mode') ||
      searchParams.get('mode') ||
      (typeof query['hub.mode'] === 'string' ? query['hub.mode'] : undefined) ||
      (typeof hubObj.mode === 'string' ? hubObj.mode : undefined) ||
      (typeof query.mode === 'string' ? query.mode : undefined);

    const token =
      searchParams.get('hub.verify_token') ||
      searchParams.get('verify_token') ||
      searchParams.get('token') ||
      (typeof query['hub.verify_token'] === 'string' ? query['hub.verify_token'] : undefined) ||
      (typeof hubObj.verify_token === 'string' ? hubObj.verify_token : undefined) ||
      (typeof query.verify_token === 'string' ? query.verify_token : undefined) ||
      (typeof query.token === 'string' ? query.token : undefined);

    const challenge =
      searchParams.get('hub.challenge') ||
      searchParams.get('challenge') ||
      (typeof query['hub.challenge'] === 'string' ? query['hub.challenge'] : undefined) ||
      (typeof hubObj.challenge === 'string' ? hubObj.challenge : undefined) ||
      (typeof query.challenge === 'string' ? query.challenge : undefined);

    const envToken = process.env.WHATSAPP_VERIFY_TOKEN || 'asistente_financiero_token';
    const expectedToken = envToken.trim().replace(/^["']|["']$/g, '');
    const receivedToken = (token || '').trim();

    console.log('[Meta Webhook Verification GET]', {
      rawUrl: req.url,
      mode,
      receivedToken,
      expectedToken,
      challenge,
      isMatch: receivedToken === expectedToken
    });

    // 1. Si el token coincide y tenemos challenge -> Respuesta exitosa a Meta
    if (receivedToken === expectedToken && challenge) {
      console.log('✅ Webhook verificado con éxito. Respondiendo challenge:', challenge);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      return res.status(200).send(String(challenge));
    }

    // 2. Si recibimos un token pero no coincide
    if (token && receivedToken !== expectedToken) {
      console.warn(`❌ Token de verificación incorrecto. Recibido: "${receivedToken}", Esperado: "${expectedToken}"`);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(403).send('Forbidden: Token mismatch');
    }

    // 3. Petición de prueba directamente desde el navegador (sin parámetros de Meta)
    if (!mode && !token && !challenge) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send('Webhook de WhatsApp en Vercel activo y listo.');
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(403).send('Forbidden');
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
