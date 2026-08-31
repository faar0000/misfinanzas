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

export function extractDateFromPrompt(prompt: string): string {
  const promptLower = (prompt || '').toLowerCase();
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1-12

  // 1. Check relative days: "ayer", "anteayer", "hoy"
  if (/\bayer\b/.test(promptLower)) {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }
  if (/\banteayer\b/.test(promptLower) || /\bante\s+ayer\b/.test(promptLower)) {
    const d = new Date(today);
    d.setDate(d.getDate() - 2);
    return d.toISOString().split('T')[0];
  }

  // 2. Check full date DD/MM/YYYY or DD-MM-YYYY
  const fullDateMatch = promptLower.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (fullDateMatch) {
    const d = fullDateMatch[1].padStart(2, '0');
    const m = fullDateMatch[2].padStart(2, '0');
    const y = fullDateMatch[3];
    return `${y}-${m}-${d}`;
  }

  // 3. Check DD/MM or DD-MM (e.g. 30/08 or 30-08)
  const shortDateMatch = promptLower.match(/\b(\d{1,2})[\/\-](\d{1,2})\b/);
  if (shortDateMatch) {
    const d = shortDateMatch[1].padStart(2, '0');
    const m = shortDateMatch[2].padStart(2, '0');
    return `${currentYear}-${m}-${d}`;
  }

  // 4. Check Spanish named months (e.g. "30 de agosto", "el 30 ago", "15 de setiembre")
  const monthNamesMap: Record<string, string> = {
    enero: '01', ene: '01',
    febrero: '02', feb: '02',
    marzo: '03', mar: '03',
    abril: '04', abr: '04',
    mayo: '05', may: '05',
    junio: '06', jun: '06',
    julio: '07', jul: '07',
    agosto: '08', ago: '08',
    setiembre: '09', septiembre: '09', sep: '09', set: '09',
    octubre: '10', oct: '10',
    noviembre: '11', nov: '11',
    diciembre: '12', dic: '12',
  };

  const monthRegex = /\b(\d{1,2})\s*(?:de|\/|-)?\s*(enero|ene|febrero|feb|marzo|mar|abril|abr|mayo|may|junio|jun|julio|jul|agosto|ago|setiembre|septiembre|sep|set|octubre|oct|noviembre|nov|diciembre|dic)\b/i;
  const monthMatch = promptLower.match(monthRegex);
  if (monthMatch) {
    const day = monthMatch[1].padStart(2, '0');
    const monthKey = monthMatch[2].toLowerCase();
    const monthNum = monthNamesMap[monthKey] || String(currentMonth).padStart(2, '0');
    return `${currentYear}-${monthNum}-${day}`;
  }

  // 5. Check "el dia 30" or "el 30"
  const dayOnlyMatch = promptLower.match(/\b(?:el\s+(?:día\s+|dia\s+)?|del\s+)(\d{1,2})\b/);
  if (dayOnlyMatch) {
    const day = parseInt(dayOnlyMatch[1], 10);
    if (day >= 1 && day <= 31) {
      return `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return today.toISOString().split('T')[0];
}

// Fallback transaction parser if Gemini API hits 429 rate limit or missing key
export function parseFallbackTransaction(
  textPrompt: string = '',
  inputMode: 'text' | 'voice' | 'image' = 'text',
  budgetInfo: any = {}
) {
  const promptLower = (textPrompt || '').toLowerCase();
  const transactionDate = extractDateFromPrompt(textPrompt);

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

  // Check if expense is explicitly an occasional/variable purchase, fuel, or repair
  const isOcasional =
    promptLower.includes('gasolina') ||
    promptLower.includes('combustible') ||
    promptLower.includes('grifo') ||
    promptLower.includes('diesel') ||
    promptLower.includes('diésel') ||
    promptLower.includes('peaje') ||
    promptLower.includes('reparacion') ||
    promptLower.includes('reparación') ||
    promptLower.includes('arregla') ||
    promptLower.includes('arreglo') ||
    promptLower.includes('mecanico') ||
    promptLower.includes('mecánico') ||
    promptLower.includes('gasfitero') ||
    promptLower.includes('repuesto') ||
    promptLower.includes('lavadora') ||
    promptLower.includes('electrodomestico') ||
    promptLower.includes('electrodoméstico');

  // Fixed expense check using strict terms
  const isGastoFijo =
    !isIngreso &&
    !isOcasional &&
    (promptLower.includes('alquiler') ||
      promptLower.includes('recibo de luz') ||
      promptLower.includes('recibo de agua') ||
      promptLower.includes('internet') ||
      promptLower.includes('plan movil') ||
      promptLower.includes('plan celular') ||
      /\bgas natural\b/i.test(promptLower) ||
      /\bcalidda\b/i.test(promptLower) ||
      promptLower.includes('cochera mensual') ||
      promptLower.includes('mantenimiento de edificio') ||
      promptLower.includes('mantenimiento del condominio') ||
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

  // Detect home equipment / repairs
  const isHouseholdOrRepair =
    promptLower.includes('mueble') ||
    promptLower.includes('balanza') ||
    promptLower.includes('lavadora') ||
    promptLower.includes('reparaci') ||
    promptLower.includes('arreglo') ||
    promptLower.includes('gasfiter') ||
    promptLower.includes('pintura') ||
    promptLower.includes('electrodom') ||
    promptLower.includes('olla') ||
    promptLower.includes('sarten') ||
    promptLower.includes('sartén') ||
    promptLower.includes('ferreter');

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
    fecha: transactionDate,
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
          ? 'Servicios y Gastos Fijos'
          : isHouseholdOrRepair
          ? 'Hogar y Mantenimiento'
          : isFoodOrGrocery
          ? 'Alimentación y Dieta'
          : 'Ocio y Salidas',
        subcategoria: isIngreso
          ? 'Varios'
          : isGastoFijo
          ? 'Servicios Fijos'
          : isHouseholdOrRepair
          ? 'Hogar y Equipamiento'
          : isFoodOrGrocery
          ? 'Víveres y Compras'
          : 'Compras y Salidas',
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

2. Registro de Ingresos (Sueldo Base vs Ingreso Adicional / Extra):
   - Si la operación es un INGRESO:
     * tipo_operacion = "INGRESO"
     * categoria_principal = "Ingresos"
     * Si es el sueldo base mensual regular, nómina o adelanto quincenal de sueldo:
       - subcategoria = "Sueldo mensual" o "Quincena"
       - frecuencia_recurrencia = "MENSUAL"
     * Si es un ingreso extra, adicional, freelance, venta, honorarios, consultoría, bono o premio:
       - subcategoria = "Ingreso adicional" / "Freelance" / "Bono" / "Venta"
       - frecuencia_recurrencia = "PUNTUAL"
       - NOTA: Este ingreso extra se suma al sueldo fijo base mensual (Sueldo + Adicional) incrementando el flujo total del mes.

3. Desglose de Boletas / Comprobantes (Visión / OCR):
   - Si se incluye una imagen de boleta o ticket, analiza CADA ÍTEM individualmente.
   - Clasifica como "Alimentación y Dieta": todo alimento saludable o planificado (Proteínas, Insumos de Dieta, Frutas, Lácteos, Verduras, Carnes, Abarrotes de supermercado, Víveres, Huevos, Pan, Palta, etc.).
   - Clasifica como "Gastos Hormiga y Antojos" ÚNICAMENTE: Comida chatarra, galletas, golosinas, cerveza, licores, pollo a la brasa, pizza, hamburguesas, gaseosas, snacks, postres o caprichos espontáneos.

4. Lógica de Tarjetas de Crédito, Entidad Financiera y Cuotas:
   - Detección de Entidad Financiera / Banco: Extrae el nombre del banco o tarjeta si se menciona (ej: "Interbank", "BCP", "BBVA", "Scotiabank", "Diners", "CMR", "Efectivo").
   - Si se menciona "tarjeta de crédito", "tarjeta credito", "cuota", "interbank", "bcp", "bbva", etc., DEBES clasificar 'metodo_pago' = 'CREDITO'.

5. Clasificación Estricta de Categorías Principales y Subcategorías Estandarizadas:
   - 'Servicios y Gastos Fijos' (es_gasto_fijo = true, frecuencia_recurrencia = "MENSUAL"): Subcategorías: 'Alquiler de departamento', 'Mantenimiento de edificio', 'Luz / Electricidad', 'Agua', 'Internet y Telefonía', 'Gas domiciliario', 'Suscripciones (gimnasio, streaming)', 'Pensiones y Seguros'.
   - 'Hogar y Mantenimiento' (es_gasto_fijo = false, frecuencia_recurrencia = "PUNTUAL"): Subcategorías: 'Muebles y Equipamiento', 'Electrodomésticos y Balanza', 'Reparaciones y Arreglos del Hogar', 'Artículos para el hogar y Menaje', 'Ferretería y Herramientas', 'Decoración y Mejoras'.
   - 'Vehículo' (frecuencia_recurrencia = "PUNTUAL"): Subcategorías: 'Gasolina / Combustible', 'Cochera', 'Mantenimiento preventivo/correctivo', 'Peajes', 'Repuestos y lavado'. (Nota: Todo gasto de auto, carro, lavado de auto, estacionamiento, peajes o transporte debe clasificarse en 'Vehículo', nunca en categorías no estándar como 'Transporte').
   - 'Alimentación y Dieta': Subcategorías: 'Supermercado', 'Menú / Almuerzo', 'Insumos de dieta estructurada', 'Proteína y suplementos', 'Compras de alimento planificado'.
   - 'Gastos Hormiga y Antojos': Subcategorías: 'Comida chatarra', 'Deliveries no planificados', 'Antojos espontáneos', 'Bebidas y snacks', 'Paseos y caprichos menores'.
   - 'Ocio y Salidas': Subcategorías: 'Salidas en pareja', 'Compras por internet/tecnología', 'Viajes/escapadas', 'Pasatiempos y entretenimiento'.
   - 'Crédito y Compromisos': Subcategorías: 'Pagos de tarjeta de crédito', 'Compras diferidas en cuotas', 'Préstamos y amortizaciones'.

   - REGLA DE ORO: Las compras de muebles, balanzas, electrodomésticos y reparaciones de artefactos/lavadora NUNCA son gastos fijos; pertenecen a 'Hogar y Mantenimiento' con es_gasto_fijo = false y frecuencia_recurrencia = "PUNTUAL".

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
          description: 'True SOLO para obligaciones mensuales fijas (alquiler, luz, agua, internet, suscripciones). False para gasolina, combustible, reparaciones, mantenimiento de lavadora, comida o compras.',
        },
        frecuencia_recurrencia: {
          type: Type.STRING,
          enum: ['MENSUAL', 'PUNTUAL'],
          description: 'MENSUAL si se paga obligatoriamente todos los meses. PUNTUAL si es una compra o reparación ocasional como gasolina o arreglo de artefactos.',
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

    const modelsToTry = ['gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
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
        const errMsg = err?.message || String(err);
        const isQuotaOrUnavailable =
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.includes('503') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('quota');
        if (isQuotaOrUnavailable) {
          console.warn(`[Gemini API] Modelo '${modelName}' con límite de cuota o alta demanda temporal. Probando siguiente modelo...`);
        } else {
          console.warn(`[Gemini API] Modelo '${modelName}' error: ${errMsg}`);
        }
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
      console.warn('Gemini API temporalmente no disponible o cuota alcanzada. Usando motor heurístico de respaldo.');
      parsedData = parseFallbackTransaction(textPrompt, inputMode, budgetInfo);
      parsedData.fallbackReason = lastError?.message?.includes('429') ? 'quota_exceeded' : 'api_fallback';
    }

    if (parsedData) {
      const promptDate = extractDateFromPrompt(textPrompt || '');
      const todayISO = new Date().toISOString().split('T')[0];
      if (promptDate !== todayISO && (!parsedData.fecha || parsedData.fecha === todayISO)) {
        parsedData.fecha = promptDate;
      }
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
