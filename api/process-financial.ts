import { GoogleGenAI, Type } from '@google/genai';

let genAIClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('La clave GEMINI_API_KEY no está configurada en las variables de entorno.');
    }
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

// Fallback transaction parser if Gemini API hits 429 rate limit or missing key
export function parseFallbackTransaction(
  textPrompt: string = '',
  inputMode: 'text' | 'voice' | 'image' = 'text',
  budgetInfo: any = {}
) {
  const promptLower = (textPrompt || '').toLowerCase();
  const todayStr = new Date().toISOString().split('T')[0];

  // Extract all numbers from prompt
  const numberMatches = textPrompt.match(/(\d+(?:[\.,]\d{1,2})?)/g) || [];
  const numbers = numberMatches.map((n) => parseFloat(n.replace(',', '.'))).filter((n) => !isNaN(n));

  let montoTotal = numbers[0] || 50;
  let cuotas = 1;

  // Check if cuotas are mentioned (e.g., "3 cuotas", "en 6 cuotas")
  const cuotaMatch = promptLower.match(/(\d+)\s*cuotas?/);
  if (cuotaMatch) {
    cuotas = parseInt(cuotaMatch[1], 10) || 1;
  }

  // Detect operation type
  const isIngreso =
    promptLower.includes('ingreso') ||
    promptLower.includes('sueldo') ||
    promptLower.includes('me pagaron') ||
    promptLower.includes('cobro') ||
    promptLower.includes('cobré') ||
    promptLower.includes('venta') ||
    promptLower.includes('ganancia');

  const tipoOperacion = isIngreso ? 'INGRESO' : 'GASTO';

  // Detect payment method & bank
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

  // Fixed expense check using strict word boundary regex to avoid "gaste" matching "gas"
  const isGastoFijo =
    !isIngreso &&
    (promptLower.includes('alquiler') ||
      promptLower.includes('luz') ||
      promptLower.includes('agua') ||
      promptLower.includes('internet') ||
      /\bgas\b/i.test(promptLower) ||
      promptLower.includes('cochera') ||
      promptLower.includes('mantenimiento') ||
      /\bgym\b/i.test(promptLower) ||
      promptLower.includes('gimnasio') ||
      promptLower.includes('pension') ||
      promptLower.includes('pensión') ||
      promptLower.includes('suscripcion') ||
      promptLower.includes('suscripción') ||
      promptLower.includes('colegio') ||
      promptLower.includes('seguro'));

  // Pending vs Paid
  const isPendiente =
    promptLower.includes('tengo que pagar') ||
    promptLower.includes('vence') ||
    promptLower.includes('programado') ||
    promptLower.includes('pendiente');

  const estadoPago = isPendiente ? 'PENDIENTE' : 'PAGADO';

  // Clean concept title by stripping common noise verbs and prepositions
  let conceptoClean = textPrompt
    ? textPrompt
        .replace(/(\d+(?:[\.,]\d{1,2})?)/g, '')
        .replace(/\b(gaste|gasté|compré|compre|pagué|pague|soles|s\/\.|dólares|\$|en|por|con|tarjeta|crédito|credito|cuotas|de|el|la|los|las|un|una|unos|unas)\b/gi, '')
        .trim()
    : inputMode === 'image'
    ? 'Comprobante de compra'
    : 'Registro de gasto';

  if (!conceptoClean || conceptoClean.length < 2) {
    conceptoClean = isIngreso ? 'Ingreso de fondos' : 'Gasto registrado';
  }
  conceptoClean = conceptoClean.charAt(0).toUpperCase() + conceptoClean.slice(1);

  const montoCuotaMensual = cuotas > 1 ? Number((montoTotal / cuotas).toFixed(2)) : montoTotal;

  // Detect food/grocery items
  const isFoodOrGrocery =
    promptLower.includes('palta') ||
    promptLower.includes('fruta') ||
    promptLower.includes('verdura') ||
    promptLower.includes('comida') ||
    promptLower.includes('almuerzo') ||
    promptLower.includes('cena') ||
    promptLower.includes('pan') ||
    promptLower.includes('leche') ||
    promptLower.includes('arroz') ||
    promptLower.includes('huevos');

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
        categoria_principal: isIngreso
          ? 'Ingresos'
          : isGastoFijo
          ? 'Servicios y Fijos'
          : isFoodOrGrocery
          ? 'Alimentación y Dieta'
          : 'Variables',
        subcategoria: isIngreso
          ? 'Varios'
          : isGastoFijo
          ? 'Gastos Fijos'
          : isFoodOrGrocery
          ? 'Víveres y Compras'
          : 'Compras Varios',
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
    processedBy: 'fallback_heuristic',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    fallbackReason: !process.env.GEMINI_API_KEY
      ? 'Falta GEMINI_API_KEY en las variables de entorno'
      : 'Cuota de Gemini AI no disponible o error de red',
  };
}

export async function processFinancialCore(body: any) {
  const {
    inputMode, // 'text' | 'voice' | 'image'
    textPrompt,
    audioBase64,
    audioMimeType,
    imageBase64,
    imageMimeType,
    currentBudget,
  } = body || {};

  const budgetInfo = currentBudget || {
    ingresoMensual: 5000,
    ingresosCobrados: 2500,
    gastosFijos: 1500,
    gastosVariables: 1000,
    cuotasCredito: 300,
  };

  const hasApiKey = Boolean(process.env.GEMINI_API_KEY);

  if (!hasApiKey) {
    console.warn('[Process Financial] Missing GEMINI_API_KEY in environment. Using fallback heuristic parser.');
    const fallback = parseFallbackTransaction(textPrompt, inputMode, budgetInfo);
    return {
      success: true,
      data: fallback,
    };
  }

  try {
    const ai = getGeminiClient();

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

2. Registro de Ingresos Parciales o Quincenales:
   - Si la operación es un INGRESO (cobro de sueldo, adelanto, pago parcial, venta, freelance, etc.):
     * tipo_operacion = "INGRESO"
     * categoria_principal = "Ingresos"
     * subcategoria = "Sueldo parcial" / "Adelanto quincena" / "Ingreso adicional"

3. Desglose de Boletas / Comprobantes (Visión / OCR):
   - Si se incluye una imagen de boleta o ticket, analiza CADA ÍTEM individualmente.
   - Clasifica como "Alimentación y Dieta": todo alimento saludable o planificado (Proteínas, Insumos de Dieta, Frutas, Lácteos, Verduras, Carnes, Abarrotes de supermercado, Víveres, Huevos, Pan, Palta, etc.).
   - Clasifica como "Gastos Hormiga y Antojos" ÚNICAMENTE: Comida chatarra, galletas, golosinas, cerveza, licores, pollo a la brasa, pizza, hamburguesas, gaseosas, snacks, postres o caprichos espontáneos.

4. Lógica de Tarjetas de Crédito, Entidad Financiera y Cuotas:
   - Detección de Entidad Financiera / Banco: Extrae el nombre del banco o tarjeta si se menciona (ej: "Interbank", "BCP", "BBVA", "Scotiabank", "Diners", "CMR", "Efectivo").
   - Si se menciona "tarjeta de crédito", "tarjeta credito", "cuota", "interbank", "bcp", "bbva", etc., DEBES clasificar 'metodo_pago' = 'CREDITO'.

5. Clasificación Estricta de Gasto Fijo Recurrente vs Compra Ocasional/Puntual:
   - Asigna es_gasto_fijo = true y frecuencia_recurrencia = "MENSUAL" ÚNICAMENTE a compromisos u obligaciones periódicas que se pagan todos los meses (Alquiler de vivienda, Mantenimiento, Luz, Agua, Internet, Plan móvil, Colegio, Suscripciones, Gimnasio, Seguros).
   - JAMÁS clasifiques como gasto fijo (asigna es_gasto_fijo = false y frecuencia_recurrencia = "PUNTUAL") compras de comida, fruta, palta, víveres, restaurantes, ropa o compras ocasionales.

6. Formato de Salida JSON Estricto:
   Debes devolver un objeto JSON válido con los campos exactos solicitados.
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
        text: textPrompt || 'Analiza este comprobante/boleta de pago, desglosa los ítems clasificando dieta vs antojos/hormiga, y procesa el gasto.',
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

    const modelsToTry = ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
    let responseText = '';
    let usedModel = '';
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
        if (responseText && responseText !== '{}') {
          usedModel = modelName;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini API] Model '${modelName}' error: ${err?.message || err}`);
      }
    }

    let parsedData: any = null;
    if (responseText && !lastError) {
      try {
        parsedData = JSON.parse(responseText);
        parsedData.processedBy = 'gemini_ai';
        parsedData.modelUsed = usedModel;
        parsedData.hasApiKey = true;
      } catch (parseErr) {
        console.error('Error parsing Gemini JSON response:', parseErr);
      }
    }

    if (!parsedData) {
      console.warn('Gemini API quota exceeded or unavailable. Using fallback heuristic parser.');
      parsedData = parseFallbackTransaction(textPrompt, inputMode, budgetInfo);
    }

    return {
      success: true,
      data: parsedData,
    };
  } catch (err: any) {
    console.error('Exception processing transaction:', err);
    const fallback = parseFallbackTransaction(textPrompt, inputMode, budgetInfo);
    return {
      success: true,
      data: fallback,
    };
  }
}

// Vercel Serverless Function Handler
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
  }

  try {
    const result = await processFinancialCore(req.body);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Error interno al procesar transacción',
    });
  }
}
