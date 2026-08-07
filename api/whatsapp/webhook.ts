import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { saveWhatsAppTransaction } from '../../src/lib/waStore';

// Instancia de Gemini AI
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  return new GoogleGenAI({ apiKey });
}

// Formatear mensaje de respuesta para WhatsApp con emojis
function formatWhatsAppReply(parsed: any, rawMessage: string): string {
  const isIngreso = parsed.tipo_operacion === 'INGRESO';
  const icon = isIngreso ? '🟢' : '🔴';
  const tipoLabel = isIngreso ? 'INGRESO' : 'GASTO';
  const itemConcepto = parsed.items?.[0]?.concepto || parsed.titulo_resumen || rawMessage;
  const monto = Number(parsed.monto_total || 0).toFixed(2);
  const metodo = parsed.metodo_pago || 'DEBITO';
  const bancoStr = parsed.entidad_financiera ? ` (${parsed.entidad_financiera})` : '';

  let reply = `${icon} *${tipoLabel} REGISTRADO EN TU CUENTA*\n\n`;
  reply += `📌 *Concepto:* ${itemConcepto}\n`;
  reply += `💰 *Monto:* S/. ${monto}\n`;
  reply += `💳 *Medio:* ${metodo}${bancoStr}\n`;

  if (parsed.cuotas && parsed.cuotas > 1) {
    const cuotaMonto = Number(parsed.monto_cuota_mensual || parsed.monto_total || 0).toFixed(2);
    reply += `📊 *Cuotas:* 1/${parsed.cuotas} (S/. ${cuotaMonto}/mes)\n`;
  }

  reply += `✅ *Estado:* Confirmado y Sincronizado en tu Aplicación\n\n`;
  reply += `💬 _${parsed.mensaje_confirmacion || 'Registrado exitosamente en tu panel financiero.'}_`;
  return reply;
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

      // Procesar el mensaje con Gemini AI para estructurar la transacción financiera
      let parsedData: any = null;
      let replyText = '';

      try {
        const ai = getGeminiClient();
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Analiza este mensaje financiero enviado por WhatsApp: "${messageText}"`,
          config: {
            systemInstruction: `Eres un asistente de finanzas personales inteligente. Analiza el mensaje del usuario y devuelve un JSON estricto con esta estructura:
{
  "tipo_operacion": "GASTO" o "INGRESO",
  "monto_total": number,
  "metodo_pago": "DEBITO" o "CREDITO" o "EFECTIVO",
  "cuotas": number (por defecto 1),
  "monto_cuota_mensual": number,
  "entidad_financiera": string (ej: "BCP", "Interbank", "Yape", "BBVA" o vacio ""),
  "items": [
    {
      "concepto": string,
      "monto": number,
      "categoria_principal": string (ej: "Alimentación y Dieta", "Servicios y Gastos Fijos", "Ocio y Salidas", "Crédito y Compromisos", "Vehículo y Transporte", "Gastos Hormiga", "Ingresos"),
      "subcategoria": string
    }
  ],
  "titulo_resumen": string,
  "es_gasto_fijo": boolean,
  "mensaje_confirmacion": string
}`,
            responseMimeType: 'application/json',
          },
        });

        parsedData = JSON.parse(response.text || '{}');
      } catch (err: any) {
        console.error('[Gemini Parse Error]:', err?.message || err);
        // Fallback básico si falla el JSON de Gemini
        const numbers = messageText.match(/(\d+(?:[\.,]\d{1,2})?)/g) || [];
        const monto = numbers[0] ? parseFloat(numbers[0].replace(',', '.')) : 0;
        parsedData = {
          tipo_operacion: messageText.toLowerCase().includes('ingreso') || messageText.toLowerCase().includes('cobré') ? 'INGRESO' : 'GASTO',
          monto_total: monto,
          metodo_pago: 'DEBITO',
          cuotas: 1,
          monto_cuota_mensual: monto,
          items: [{ concepto: messageText, monto, categoria_principal: 'Variables', subcategoria: 'WhatsApp' }],
          titulo_resumen: messageText,
          es_gasto_fijo: false,
          mensaje_confirmacion: 'Transacción anotada correctamente.',
        };
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const txRecord = {
        id: `wa-tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        fecha: todayStr,
        tipo_operacion: parsedData.tipo_operacion || 'GASTO',
        monto_total: Number(parsedData.monto_total || 0),
        metodo_pago: parsedData.metodo_pago || 'DEBITO',
        cuotas: parsedData.cuotas || 1,
        monto_cuota_mensual: Number(parsedData.monto_cuota_mensual || parsedData.monto_total || 0),
        items: parsedData.items || [
          {
            concepto: parsedData.titulo_resumen || messageText,
            monto: Number(parsedData.monto_total || 0),
            categoria_principal: parsedData.tipo_operacion === 'INGRESO' ? 'Ingresos' : 'Alimentación y Dieta',
            subcategoria: 'WhatsApp Bot',
          },
        ],
        alerta_ahorro_comprometido: false,
        dinero_libre_restante: 0,
        mensaje_usuario: parsedData.mensaje_confirmacion || `Registrado desde WhatsApp: S/. ${parsedData.monto_total || 0}`,
        comercio: parsedData.entidad_financiera || parsedData.titulo_resumen || 'WhatsApp',
        titulo_resumen: parsedData.titulo_resumen || messageText,
        entidad_financiera: parsedData.entidad_financiera || '',
        es_gasto_fijo: Boolean(parsedData.es_gasto_fijo),
        frecuencia_recurrencia: parsedData.es_gasto_fijo ? 'MENSUAL' : 'PUNTUAL',
        estado_pago: 'PAGADO',
        senderPhone: senderPhone,
      };

      // Guardar la transacción en el almacén persistente para sincronizar con la app web
      saveWhatsAppTransaction({
        id: txRecord.id,
        phone: senderPhone,
        rawMessage: messageText,
        transaction: txRecord,
        createdAt: new Date().toISOString(),
      });

      console.log('✅ Transacción de WhatsApp guardada:', txRecord.id, txRecord.titulo_resumen, txRecord.monto_total);

      replyText = formatWhatsAppReply(parsedData, messageText);

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
