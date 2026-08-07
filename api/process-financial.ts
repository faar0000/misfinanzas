import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

let genAIClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

// Fallback transaction parser if Gemini API fails or API key is missing
function parseFallbackTransaction(
  textPrompt: string = '',
  inputMode: 'text' | 'voice' | 'image' = 'text',
  budgetInfo: any = {}
) {
  const promptLower = (textPrompt || '').toLowerCase();
  const todayStr = new Date().toISOString().split('T')[0];

  // Extract numbers
  const numberMatches = textPrompt.match(/(\d+(?:[\.,]\d{1,2})?)/g) || [];
  const numbers = numberMatches.map((n) => parseFloat(n.replace(',', '.'))).filter((n) => !isNaN(n));

  let montoTotal = numbers[0] || 50;
  let cuotas = 1;

  const cuotaMatch = promptLower.match(/(\d+)\s*cuotas?/);
  if (cuotaMatch) {
    cuotas = parseInt(cuotaMatch[1], 10) || 1;
  }

  const isIngreso =
    promptLower.includes('ingreso') ||
    promptLower.includes('sueldo') ||
    promptLower.includes('me pagaron') ||
    promptLower.includes('cobro') ||
    promptLower.includes('cobré') ||
    promptLower.includes('venta') ||
    promptLower.includes('ganancia');

  const tipoOperacion = isIngreso ? 'INGRESO' : 'GASTO';

  let metodoPago = 'DEBITO';
  if (
    promptLower.includes('tarjeta') ||
    promptLower.includes('credito') ||
    promptLower.includes('crédito') ||
    cuotas > 1 ||
    promptLower.includes('interbank') ||
    promptLower.includes('bcp') ||
    promptLower.includes('bbva') ||
    promptLower.includes('diners') ||
    promptLower.includes('scotiabank')
  ) {
    metodoPago = 'CREDITO';
  } else if (promptLower.includes('efectivo') || promptLower.includes('cash')) {
    metodoPago = 'EFECTIVO';
  }

  let entidadFinanciera = '';
  if (promptLower.includes('interbank')) entidadFinanciera = 'Interbank';
  else if (promptLower.includes('bcp')) entidadFinanciera = 'BCP';
  else if (promptLower.includes('bbva')) entidadFinanciera = 'BBVA';
  else if (promptLower.includes('scotiabank')) entidadFinanciera = 'Scotiabank';
  else if (promptLower.includes('diners')) entidadFinanciera = 'Diners Club';
  else if (promptLower.includes('cmr')) entidadFinanciera = 'CMR Falabella';

  const isGastoFijo =
    !isIngreso &&
    (promptLower.includes('alquiler') ||
      promptLower.includes('luz') ||
      promptLower.includes('agua') ||
      promptLower.includes('internet') ||
      promptLower.includes('gas') ||
      promptLower.includes('cochera') ||
      promptLower.includes('mantenimiento') ||
      promptLower.includes('gym') ||
      promptLower.includes('gimnasio') ||
      promptLower.includes('pension') ||
      promptLower.includes('pensión') ||
      promptLower.includes('suscripcion') ||
      promptLower.includes('suscripción') ||
      promptLower.includes('colegio') ||
      promptLower.includes('seguro'));

  const isPendiente =
    promptLower.includes('tengo que pagar') ||
    promptLower.includes('vence') ||
    promptLower.includes('programado') ||
    promptLower.includes('pendiente');

  const estadoPago = isPendiente ? 'PENDIENTE' : 'PAGADO';

  let conceptoClean = textPrompt
    ? textPrompt
        .replace(/(\d+(?:[\.,]\d{1,2})?)/g, '')
        .replace(/soles|s\/\.|dólares|\$|en|por|con|tarjeta|crédito|credito|cuotas|de|el|la|los|las/gi, '')
        .trim()
    : inputMode === 'image'
    ? 'Comprobante de compra'
    : 'Registro de gasto';

  if (!conceptoClean || conceptoClean.length < 2) {
    conceptoClean = isIngreso ? 'Ingreso de fondos' : 'Gasto registrado';
  }
  conceptoClean = conceptoClean.charAt(0).toUpperCase() + conceptoClean.slice(1);

  const montoCuotaMensual = cuotas > 1 ? Number((montoTotal / cuotas).toFixed(2)) : montoTotal;

  return {
    fecha: todayStr,
    tipo_operacion: tipoOperacion,
    monto_total: montoTotal,
    metodo_pago: metodoPago,
    cuotas: cuotas,
    monto_cuota_mensual: montoCuotaMensual,
    items: [
      {
        concepto: conceptoClean,
        monto: montoTotal,
        categoria_principal: isIngreso ? 'Ingresos' : isGastoFijo ? 'Servicios y Fijos' : 'Variables',
        subcategoria: isIngreso ? 'Varios' : isGastoFijo ? 'Gastos Fijos' : 'Compras Varios',
      },
    ],
    alerta_ahorro_comprometido: false,
    dinero_libre_restante: (budgetInfo.ingresosCobrados || 2500) - (budgetInfo.gastosFijos || 0) - montoTotal,
    mensaje_usuario: `ℹ️ Registro procesado (${conceptoClean} por S/. ${montoTotal.toFixed(
      2
    )}). Puedes verificar o editar los detalles en tu historial.`,
    comercio: conceptoClean,
    titulo_resumen: conceptoClean,
    entidad_financiera: entidadFinanciera,
    cuota_actual: 1,
    cuotas_restantes: Math.max(0, cuotas - 1),
    es_gasto_fijo: isGastoFijo,
    frecuencia_recurrencia: isGastoFijo ? 'MENSUAL' : 'PUNTUAL',
    estado_pago: estadoPago,
    dia_pago_mensual: isPendiente ? 21 : undefined,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      inputMode, // 'text' | 'voice' | 'image'
      textPrompt,
      audioBase64,
      audioMimeType,
      imageBase64,
      imageMimeType,
      currentBudget,
    } = req.body || {};

    const budgetInfo = currentBudget || {
      ingresoMensual: 5000,
      ingresosCobrados: 2500,
      gastosFijos: 1500,
      gastosVariables: 1000,
      cuotasCredito: 300,
    };

    const ai = getGeminiClient();

    if (!ai) {
      console.warn('GEMINI_API_KEY no configurada. Usando parser heurístico.');
      const fallback = parseFallbackTransaction(textPrompt, inputMode, budgetInfo);
      return res.status(200).json({ success: true, data: fallback });
    }

    const todayDateStr = new Date().toISOString().split('T')[0];
    const currentYearStr = new Date().getFullYear().toString();

    const systemInstruction = `
Eres un Asistente Financiero Personal Inteligente. Tu objetivo es procesar registros de ingresos y gastos (mediante texto, transcripción de voz o imágenes de boletas/comprobantes), clasificarlos con precisión y evaluar en tiempo real el impacto en la cuenta bancaria y presupuesto mensual, protegiendo la meta estricta del 10% de ahorro.

FECHA DE HOY DEL SISTEMA: ${todayDateStr} (Año actual: ${currentYearStr}).
REGLA CRÍTICA DE FECHAS:
- A menos que el usuario mencione explícitamente una fecha distinta en el pasado o futuro (ej: "el 15 de enero del año pasado" o "ayer"), DEBES asignar la fecha del registro como HOY (${todayDateStr}).
- Si el usuario menciona un día/mes sin indicar el año (ej: "el 3 de agosto"), asume siempre el año actual (${currentYearStr}).
- JAMÁS uses años pasados como 2024, 2023 o fechas por defecto si la transacción es registrada hoy.

REGLAS DE NEGOCIO Y CÁLCULO DE SALDO EN BANCO:
1. Datos del Presupuesto y Flujo de Caja Actual:
   - Ingreso Mensual Proyectado/Esperado: S/. ${budgetInfo.ingresoMensual}
   - Ingresos Reales Ingresados al Banco hasta hoy: S/. ${budgetInfo.ingresosCobrados || budgetInfo.ingresoMensual}
   - Meta Estricta de Ahorro (10%): S/. ${(budgetInfo.ingresoMensual * 0.1).toFixed(2)}
   - Gastos Fijos Actuales: S/. ${budgetInfo.gastosFijos}
   - Cuotas de Crédito Activas: S/. ${budgetInfo.cuotasCredito}
   - Gastos Variables Acumulados: S/. ${budgetInfo.gastosVariables}

2. Registro de Ingresos Parciales o Quincenales (ej: "Me pagaron el 50% de mi sueldo: 2500 soles"):
   - Si la operación es un INGRESO (cobro de sueldo, adelanto, pago parcial, venta, freelance, etc.):
     * tipo_operacion = "INGRESO"
     * categoria_principal = "Ingresos"
     * subcategoria = "Sueldo parcial" / "Adelanto quincena" / "Ingreso adicional"
     * Esto incrementa directamente los Ingresos Reales Recibidos en Banco.

3. Desglose de Boletas / Comprobantes (Visión / OCR):
   - Si se incluye una imagen de boleta o ticket, analiza CADA ÍTEM individualmente.

4. Lógica de Tarjetas de Crédito, Entidad Financiera y Cuotas:
   - Detección de Entidad Financiera / Banco (Interbank, BCP, BBVA, Scotiabank, Diners, etc.).
   - Si se menciona "tarjeta de crédito", "cuotas", etc., asigna 'metodo_pago' = 'CREDITO'.

5. Evaluación del Balance y Alerta de Ahorro:
   - Dinero Libre Disponible = (Ingresos Reales Cobrados + nuevo ingreso si aplica) - (10% Ahorro Meta) - (Nuevos Gastos Totales acumulados).
   - 'alerta_ahorro_comprometido' = true SI Y SOLO SI Dinero Libre Disponible < 0.

6. Detección de Tienda / Comercio y Título Resumen:
   - Identifica el nombre de la tienda o establecimiento.

7. Clasificación Estricta de Gasto Fijo Recurrente vs Compra Ocasional/Puntual:
   - Solo asigna es_gasto_fijo = true si es un compromiso mensual recurrente obligatorio.

8. Detección de Estado de Pago:
   - "PENDIENTE" si es un compromiso a futuro. "PAGADO" si es ejecutado hoy.

9. Formato de Salida JSON Estricto.
`;

    const contentsParts: Array<any> = [];

    if (inputMode === 'image' && imageBase64) {
      contentsParts.push({
        inlineData: {
          mimeType: imageMimeType || 'image/jpeg',
          data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
        },
      });
      contentsParts.push({
        text: textPrompt || 'Analiza este comprobante/boleta de pago y procesa el gasto.',
      });
    } else if (inputMode === 'voice' && audioBase64) {
      contentsParts.push({
        inlineData: {
          mimeType: audioMimeType || 'audio/webm',
          data: audioBase64.replace(/^data:audio\/\w+;base64,/, ''),
        },
      });
      contentsParts.push({
        text: 'Escucha este audio del usuario, transcribe lo dicho, extrae la transacción financiera, concepto, monto, medio de pago y cuotas.',
      });
    } else {
      contentsParts.push({
        text: textPrompt || 'Registra mi transacción financiera.',
      });
    }

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        fecha: {
          type: Type.STRING,
          description: 'Fecha en formato YYYY-MM-DD.',
        },
        tipo_operacion: {
          type: Type.STRING,
          enum: ['GASTO', 'INGRESO'],
        },
        monto_total: {
          type: Type.NUMBER,
        },
        metodo_pago: {
          type: Type.STRING,
          enum: ['EFECTIVO', 'DEBITO', 'CREDITO'],
        },
        cuotas: {
          type: Type.INTEGER,
        },
        monto_cuota_mensual: {
          type: Type.NUMBER,
        },
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              concepto: { type: Type.STRING },
              monto: { type: Type.NUMBER },
              categoria_principal: { type: Type.STRING },
              subcategoria: { type: Type.STRING },
            },
            required: ['concepto', 'monto', 'categoria_principal', 'subcategoria'],
          },
        },
        alerta_ahorro_comprometido: {
          type: Type.BOOLEAN,
        },
        dinero_libre_restante: {
          type: Type.NUMBER,
        },
        mensaje_usuario: {
          type: Type.STRING,
        },
        comercio: {
          type: Type.STRING,
        },
        titulo_resumen: {
          type: Type.STRING,
        },
        entidad_financiera: {
          type: Type.STRING,
        },
        cuota_actual: {
          type: Type.INTEGER,
        },
        cuotas_restantes: {
          type: Type.INTEGER,
        },
        es_gasto_fijo: {
          type: Type.BOOLEAN,
        },
        frecuencia_recurrencia: {
          type: Type.STRING,
          enum: ['MENSUAL', 'PUNTUAL'],
        },
        estado_pago: {
          type: Type.STRING,
          enum: ['PAGADO', 'PENDIENTE'],
        },
        dia_pago_mensual: {
          type: Type.INTEGER,
        },
      },
      required: [
        'fecha',
        'tipo_operacion',
        'monto_total',
        'metodo_pago',
        'cuotas',
        'monto_cuota_mensual',
        'items',
        'alerta_ahorro_comprometido',
        'dinero_libre_restante',
        'mensaje_usuario',
      ],
    };

    const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash'];
    let responseText = '';
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: { parts: contentsParts },
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0.2,
          },
        });
        responseText = response.text || '{}';
        lastError = null;
        if (responseText) break;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Vercel API] Model ${modelName} error:`, err?.message || err);
      }
    }

    let parsedData: any = null;
    if (responseText && !lastError) {
      try {
        parsedData = JSON.parse(responseText);
      } catch (parseErr) {
        console.error('Error parsing JSON:', parseErr);
      }
    }

    if (!parsedData) {
      parsedData = parseFallbackTransaction(textPrompt, inputMode, budgetInfo);
    }

    return res.status(200).json({
      success: true,
      data: parsedData,
    });
  } catch (err: any) {
    console.error('Exception in /api/process-financial:', err);
    const fallback = parseFallbackTransaction(req.body?.textPrompt || '', req.body?.inputMode || 'text', req.body?.currentBudget || {});
    return res.status(200).json({
      success: true,
      data: fallback,
    });
  }
}
