import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Enable JSON parser with large payload limit for image OCR & voice base64 data
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

// Health check route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    time: new Date().toISOString()
  });
});

// Fallback transaction parser if Gemini API hits 429 rate limit or quota limits
function parseFallbackTransaction(
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

  // Fixed expense check
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

  // Pending vs Paid
  const isPendiente =
    promptLower.includes('tengo que pagar') ||
    promptLower.includes('vence') ||
    promptLower.includes('programado') ||
    promptLower.includes('pendiente');

  const estadoPago = isPendiente ? 'PENDIENTE' : 'PAGADO';

  // Clean concept title
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

// Process Financial Operation Route
app.post('/api/process-financial', async (req, res) => {
  try {
    const {
      inputMode, // 'text' | 'voice' | 'image'
      textPrompt,
      audioBase64,
      audioMimeType,
      imageBase64,
      imageMimeType,
      currentBudget, // { ingresoMensual, gastosFijos, gastosVariables, cuotasCredito }
    } = req.body;

    const budgetInfo = currentBudget || {
      ingresoMensual: 5000,
      ingresosCobrados: 2500,
      gastosFijos: 1500,
      gastosVariables: 1000,
      cuotasCredito: 300,
    };

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

2. Registro de Ingresos Parciales o Quincenales (ej: "Me pagaron el 50% de mi sueldo: 2500 soles"):
   - Si la operación es un INGRESO (cobro de sueldo, adelanto, pago parcial, venta, freelance, etc.):
     * tipo_operacion = "INGRESO"
     * categoria_principal = "Ingresos"
     * subcategoria = "Sueldo parcial" / "Adelanto quincena" / "Ingreso adicional"
     * Esto incrementa directamente los Ingresos Reales Recibidos en Banco.
     * Si el usuario indica un pago parcial (ej: 50% de sueldo), menciónale en 'mensaje_usuario' el monto abonado a su cuenta bancaria y cuánto resta por cobrar según su ingreso mensual proyectado.

3. Desglose de Boletas / Comprobantes (Visión / OCR):
   - Si se incluye una imagen de boleta o ticket, analiza CADA ÍTEM individualmente.
   - Clasifica como "Alimentación y Dieta": todo alimento saludable o planificado (Proteínas, Insumos de Dieta, Frutas, Lácteos, Verduras, Carnes, Abarrotes de supermercado, Víveres, Huevos, Pan, etc.).
   - Clasifica como "Gastos Hormiga y Antojos" ÚNICAMENTE: Comida chatarra, galletas, golosinas, cerveza, licores, pollo a la brasa, pizza, hamburguesas, gaseosas, snacks, postres o caprichos espontáneos.
   - Separa artículos de limpieza o empaques en "Alimentación y Dieta" o "Limpieza", PERO NO los clasifiques como gasto fijo recurrente mensual.

4. Lógica de Tarjetas de Crédito, Entidad Financiera y Cuotas:
   - Detección de Entidad Financiera / Banco: Extrae el nombre del banco o tarjeta si se menciona (ej: "Interbank", "BCP", "BBVA", "Scotiabank", "Diners", "American Express", "CMR", "Tarjeta Oh!", "Dinero / Efectivo"). Asigna este valor en 'entidad_financiera'.
   - Si se menciona "tarjeta de crédito", "tarjeta credito", "cuota", "interbank", "bcp", "bbva", etc., DEBES clasificar 'metodo_pago' = 'CREDITO'.
   - Interpretación inteligente de cuotas y cuotas restantes:
     * Si el usuario registra un pago de cuota en curso indicando el número de cuota y/o cuotas restantes (ej: "Pague 51.67 de mi tarjeta credito interbank... es la tercera cuota, me quedan 2"):
       - metodo_pago = "CREDITO"
       - entidad_financiera = "Interbank"
       - cuota_actual = 3 (número de cuota pagada hoy)
       - cuotas_restantes = 2 (cuotas que le quedan pendientes a futuro)
       - cuotas = cuota_actual + cuotas_restantes = 5 (total de cuotas del compromiso)
       - monto_cuota_mensual = 51.67
       - monto_total = 51.67 * 5 (o el total indicado)
     * Si el usuario registra una compra nueva a cuotas (ej: "300 soles a 3 cuotas"):
       - metodo_pago = "CREDITO"
       - cuota_actual = 1
       - cuotas_restantes = 2
       - cuotas = 3
       - monto_cuota_mensual = 100.00
       - monto_total = 300.00
   - Si no es en cuotas, cuotas = 1, cuota_actual = 1, cuotas_restantes = 0, monto_cuota_mensual = monto_total.

5. Evaluación del Balance y Alerta de Ahorro:
   - Dinero Libre Disponible = (Ingresos Reales Cobrados + nuevo ingreso si aplica) - (10% Ahorro Meta) - (Nuevos Gastos Totales acumulados).
   - 'alerta_ahorro_comprometido' = true SI Y SOLO SI Dinero Libre Disponible < 0.

6. Detección de Tienda / Comercio y Título Resumen:
   - Identifica el nombre de la tienda o establecimiento si está presente en la boleta/ticket o texto (ej: "Plaza Vea", "Wong", "Tottus", "Inkafarma", "iShop", "Saga Falabella", "Metro", "Uber", "Primax", etc.). Guarda este nombre en 'comercio'.
   - Genera un 'titulo_resumen' inteligente y conceptual:
     * Si se detecta la tienda (ej: "Plaza Vea"): asigna 'Plaza Vea' en 'comercio' y en 'titulo_resumen' pon ej: "Plaza Vea" o "Compras en Plaza Vea".
     * Si NO se detecta la tienda y la compra consta de múltiples ítems o boleta: pon en 'titulo_resumen' una categoría general como "Productos de tecnología", "Víveres y supermercado", "Insumos de dieta", "Artículos de hogar y limpieza", etc., en lugar de usar literalmente el nombre del primer producto aislado.
     * Si es una transacción simple o un solo producto o ingreso: usa el concepto claro (ej: "50% Sueldo de Julio", "Alquiler de departamento", "Laptop de trabajo").

7. Clasificación Estricta de Gasto Fijo Recurrente vs Compra Ocasional/Puntual (Proyección de Caja):
   - Asigna es_gasto_fijo = true y frecuencia_recurrencia = "MENSUAL" a compromisos u obligaciones periódicas que se pagan todos los meses (Alquiler de vivienda, Mantenimiento de condominio/edificio, Servicios básicos como Luz, Agua, Internet, Plan móvil, Colegio/Pensiones educativas, Suscripciones digitales como Netflix, Spotify, Prime, Disney, iCloud, Gimnasio, Seguros mensuales, o cualquier pago que especifique "día X de cada mes", "para el día X" o "cada mes").
   - NO clasifiques como gasto fijo recurrente mensual (asigna es_gasto_fijo = false y frecuencia_recurrencia = "PUNTUAL"):
     * Artículos de limpieza, detergentes, desinfectantes, aseo personal o del hogar (ya que se compran habitualmente cada 2 o 3 meses de forma variable u ocasional).
     * Víveres de supermercado, abarrotes, restaurantes, caprichos/gastos hormiga, ropa, viajes o electrodomésticos.

8. Detección de Estado de Pago (Transacción Ejecutada vs Compromiso Programado Pendiente):
   - Evalúa si el usuario está indicando una compra/pago ya realizado o un compromiso de pago a futuro programado:
     * Si la frase expresa una obligación/compromiso a futuro o recurrente (ej: "Netflix por S/. 61.80 para el día 9 de cada mes", "tengo que pagar el 21 de cada mes", "mi alquiler vence el 25"):
       - Asigna es_gasto_fijo = true y frecuencia_recurrencia = "MENSUAL".
       - Asigna estado_pago = "PENDIENTE" (salvo que explicite que ya lo pagó).
       - Extrae el día del mes correspondiente en dia_pago_mensual (ej: 9).
       - En mensaje_usuario, aclara empáticamente: "Se registró tu Gasto Fijo Programado de S/. 61.80 para el día 9 de cada mes. Estado: Pendiente de pago. Se encuentra reservado en tus Gastos Fijos Recurrentes."
     * Si la frase o boleta indica un pago ya realizado (ej: "Pagué Netflix", "Pagué el alquiler", "Compré..."):
       - Asigna estado_pago = "PAGADO".

9. Formato de Salida JSON Estricto:
   Debes devolver un objeto JSON válido con los campos exactos solicitados.
   El campo 'mensaje_usuario' debe ser un texto empático, claro y profesional en español que confirme si el pago fue ejecutado o si quedó registrado como compromiso pendiente programado, el dinero abonado o retirado del banco, las cuotas si aplican y alertas de ahorro.
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
          description: 'Fecha en formato YYYY-MM-DD (usar fecha actual si no se especifica otra).',
        },
        tipo_operacion: {
          type: Type.STRING,
          enum: ['GASTO', 'INGRESO'],
          description: 'Tipo de operación financiera.',
        },
        monto_total: {
          type: Type.NUMBER,
          description: 'Monto total de la transacción.',
        },
        metodo_pago: {
          type: Type.STRING,
          enum: ['EFECTIVO', 'DEBITO', 'CREDITO'],
          description: 'Medio de pago utilizado.',
        },
        cuotas: {
          type: Type.INTEGER,
          description: 'Número de cuotas en las que se difiere el pago (mínimo 1).',
        },
        monto_cuota_mensual: {
          type: Type.NUMBER,
          description: 'Monto mensual por cuota.',
        },
        items: {
          type: Type.ARRAY,
          description: 'Desglose detallado por ítem o concepto.',
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
          description: 'True si el dinero libre restante es menor a 0.',
        },
        dinero_libre_restante: {
          type: Type.NUMBER,
          description: 'Dinero libre restante proyectado tras este registro.',
        },
        mensaje_usuario: {
          type: Type.STRING,
          description: 'Mensaje amigable y explicativo para el usuario confirmando el registro y alertando de ser necesario.',
        },
        comercio: {
          type: Type.STRING,
          description: 'Nombre de la tienda, establecimiento o comercio si se detectó en la boleta o texto (ej: "Plaza Vea", "Wong", "Inkafarma").',
        },
        titulo_resumen: {
          type: Type.STRING,
          description: 'Título resumen representativo para el historial (ej: "Plaza Vea", "Productos de tecnología", "Máquina de huevos").',
        },
        entidad_financiera: {
          type: Type.STRING,
          description: 'Nombre del banco, tarjeta o entidad financiera (ej: "Interbank", "BCP", "BBVA", "Scotiabank", "Diners").',
        },
        cuota_actual: {
          type: Type.INTEGER,
          description: 'Número de la cuota pagada/registrada en esta operación (ej: 3 si es la 3era cuota). Por defecto 1.',
        },
        cuotas_restantes: {
          type: Type.INTEGER,
          description: 'Número de cuotas que le restan pagar a futuro tras este pago (ej: 2 si le quedan 2 cuotas por pagar).',
        },
        es_gasto_fijo: {
          type: Type.BOOLEAN,
          description: 'True si es un gasto fijo recurrente mensual (alquiler, luz, agua, internet, suscripciones, mantenimiento, etc.). False si es una compra única/puntual.',
        },
        frecuencia_recurrencia: {
          type: Type.STRING,
          enum: ['MENSUAL', 'PUNTUAL'],
          description: 'MENSUAL si se repite todos los meses, PUNTUAL si es una compra única.',
        },
        estado_pago: {
          type: Type.STRING,
          enum: ['PAGADO', 'PENDIENTE'],
          description: 'PENDIENTE si es un compromiso de pago a futuro programado (ej: "tengo que pagar el 21"). PAGADO si es una transacción ya ejecutada.',
        },
        dia_pago_mensual: {
          type: Type.INTEGER,
          description: 'Día del mes (1 a 31) en que vence o se realiza el pago si es un compromiso programado.',
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
          break; // Successfully got response from Gemini
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        const isQuotaError = errMsg.includes('429') || errMsg.includes('quota') || err?.status === 429 || err?.code === 429;
        if (isQuotaError) {
          console.log(`[Gemini API] Quota/rate-limit reached for model '${modelName}'. Trying next model or fallback.`);
        } else {
          console.warn(`[Gemini API] Model '${modelName}' error: ${errMsg.slice(0, 150)}`);
        }
      }
    }

    let parsedData: any = null;
    if (responseText && !lastError) {
      try {
        parsedData = JSON.parse(responseText);
      } catch (parseErr) {
        console.error('Error parsing Gemini JSON response:', parseErr, responseText);
      }
    }

    // Fallback engine if Gemini API quota is exhausted (429) or network/model error occurs
    if (!parsedData) {
      console.warn('Gemini API quota exceeded or unavailable. Using fallback heuristic parser.');
      parsedData = parseFallbackTransaction(textPrompt, inputMode, budgetInfo);
    }

    return res.json({
      success: true,
      data: parsedData,
    });
  } catch (err: any) {
    console.error('API /api/process-financial Exception:', err);
    // Even if top level throws, return fallback so app never crashes
    const fallback = parseFallbackTransaction(req.body?.textPrompt || '', req.body?.inputMode || 'text', req.body?.currentBudget || {});
    return res.json({
      success: true,
      data: fallback,
    });
  }
});

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

start();
