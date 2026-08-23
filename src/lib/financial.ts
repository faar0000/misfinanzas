import { TransactionRecord } from '../types';

/**
 * Resolves the true main category for an item or transaction.
 * Ensures health food, proteins, fruits, vegetables, groceries, and diet inputs
 * are classified as "Alimentación y Dieta", while "Gastos Hormiga y Antojos"
 * is strictly reserved for junk food, snacks, beer, pizza, fast food, and spontaneous treats.
 */
export const getNormalizedCategoryName = (
  catName?: string,
  subcatName?: string,
  concepto?: string,
  extraText?: string
): string => {
  const c = (catName || '').toLowerCase().trim();
  const s = (subcatName || '').toLowerCase().trim();
  const k = (concepto || '').toLowerCase().trim();
  const e = (extraText || '').toLowerCase().trim();
  const fullText = `${c} ${s} ${k} ${e}`;

  // 1. Explicit Junk Food / Antojos check
  const isJunkFoodOrAntojo =
    s.includes('chatarra') ||
    s.includes('galleta') ||
    s.includes('cerveza') ||
    s.includes('pollo a la brasa') ||
    s.includes('pizza') ||
    s.includes('hamburguesa') ||
    s.includes('gaseosa') ||
    s.includes('snack') ||
    s.includes('dulce') ||
    s.includes('golosina') ||
    s.includes('postre') ||
    s.includes('helado') ||
    s.includes('papas fritas') ||
    s.includes('piqueo') ||
    s.includes('antojo') ||
    s.includes('capricho') ||
    s.includes('licor') ||
    s.includes('trago') ||
    k.includes('chatarra') ||
    k.includes('galleta') ||
    k.includes('cerveza') ||
    k.includes('pollo a la brasa') ||
    k.includes('pizza') ||
    k.includes('hamburguesa') ||
    k.includes('gaseosa') ||
    k.includes('snack') ||
    k.includes('dulce') ||
    k.includes('golosina') ||
    k.includes('postre') ||
    k.includes('helado') ||
    k.includes('papas fritas') ||
    k.includes('piqueo') ||
    k.includes('antojo') ||
    c.includes('hormiga') ||
    c.includes('antojo') ||
    fullText.includes('delivery no planificado');

  if (isJunkFoodOrAntojo) {
    return 'Gastos Hormiga y Antojos';
  }

  // 2. Vehicle & Transport
  const isVehicle =
    c.includes('vehíc') ||
    c.includes('vehic') ||
    c.includes('auto') ||
    s.includes('estacionamiento') ||
    s.includes('cochera') ||
    s.includes('parqueo') ||
    s.includes('gasolina') ||
    s.includes('combustible') ||
    s.includes('peaje') ||
    s.includes('repuesto') ||
    s.includes('lavado') ||
    k.includes('estacionamiento') ||
    k.includes('cochera') ||
    k.includes('parqueo') ||
    k.includes('gasolina') ||
    k.includes('combustible') ||
    k.includes('peaje');

  if (isVehicle) {
    return 'Vehículo';
  }

  // 3. Household, Services, Cleaning, Repairs, Kitchen Utensils, Donations
  const isServicesOrHousehold =
    c.includes('servicios') ||
    c.includes('fijo') ||
    c.includes('vivienda') ||
    c.includes('hogar') ||
    c.includes('casa') ||
    s.includes('limpieza') ||
    s.includes('mantenimiento') ||
    s.includes('reparaci') ||
    s.includes('utensilio') ||
    s.includes('cocina') ||
    s.includes('alquiler') ||
    s.includes('agua') ||
    s.includes('luz') ||
    s.includes('electricidad') ||
    s.includes('internet') ||
    s.includes('teléfono') ||
    s.includes('telefono') ||
    s.includes('gas') ||
    s.includes('donaci') ||
    s.includes('seguro') ||
    s.includes('educaci') ||
    k.includes('limpieza') ||
    k.includes('mantenimiento') ||
    k.includes('reparaci') ||
    k.includes('utensilio') ||
    k.includes('alquiler') ||
    k.includes('donaci');

  if (isServicesOrHousehold) {
    return 'Servicios y Gastos Fijos';
  }

  // 4. Credit & Debt Commitments
  const isCredit =
    c.includes('crédito') ||
    c.includes('credito') ||
    c.includes('compromiso') ||
    s.includes('tarjeta') ||
    s.includes('préstamo') ||
    s.includes('prestamo') ||
    s.includes('cuotas');

  if (isCredit) {
    return 'Crédito y Compromisos';
  }

  // 5. Leisure & Outings
  const isLeisure =
    c.includes('ocio') ||
    c.includes('salida') ||
    s.includes('viaje') ||
    s.includes('cine') ||
    s.includes('restaurante') ||
    s.includes('pasatiempo');

  if (isLeisure) {
    return 'Ocio y Salidas';
  }

  // 6. Healthy Food / Diet / Groceries
  const isHealthyFoodOrGrocery =
    c.includes('alimentac') ||
    c.includes('dieta') ||
    s.includes('proteín') ||
    s.includes('protein') ||
    s.includes('dieta') ||
    s.includes('fruta') ||
    s.includes('lácteo') ||
    s.includes('lacteo') ||
    s.includes('verdura') ||
    s.includes('carne') ||
    s.includes('supermercado') ||
    s.includes('abarrote') ||
    s.includes('víveres') ||
    s.includes('viveres') ||
    s.includes('insumo') ||
    s.includes('alimento') ||
    s.includes('huevo') ||
    s.includes('pan') ||
    s.includes('leche') ||
    s.includes('yogurt') ||
    s.includes('queso') ||
    s.includes('empaque') ||
    k.includes('proteín') ||
    k.includes('protein') ||
    k.includes('dieta') ||
    k.includes('fruta') ||
    k.includes('lácteo') ||
    k.includes('lacteo') ||
    k.includes('verdura') ||
    k.includes('carne') ||
    k.includes('supermercado') ||
    k.includes('abarrote') ||
    k.includes('víveres') ||
    k.includes('viveres') ||
    k.includes('insumo') ||
    k.includes('alimento');

  if (isHealthyFoodOrGrocery) {
    return 'Alimentación y Dieta';
  }

  // 7. Respect explicit category name if provided
  if (catName && catName !== 'Otros' && catName !== 'General') {
    return catName;
  }

  return 'Alimentación y Dieta';
};

/**
 * Normalizes recurring payment concepts (e.g., Luz, Agua, Teléfono/Internet, Alquiler, Cochera, Mantenimiento)
 * to group multiple historical receipts under the same recurring service concept.
 */
export const getRecurringConceptKey = (tx: TransactionRecord): string => {
  const fullText = (
    (tx.titulo_resumen || '') +
    ' ' +
    (tx.items[0]?.concepto || '') +
    ' ' +
    (tx.items[0]?.subcategoria || '') +
    ' ' +
    (tx.items[0]?.categoria_principal || '')
  )
    .toLowerCase()
    .trim();

  // 1. Vehicle fuel & gasoline must NOT be confused with domestic gas utility
  const isVehicleFuel =
    fullText.includes('gasolina') ||
    fullText.includes('gasohol') ||
    fullText.includes('combustible') ||
    fullText.includes('grifo') ||
    fullText.includes('primax') ||
    fullText.includes('repsol') ||
    fullText.includes('pecsa') ||
    fullText.includes('petroperu');

  if (isVehicleFuel) {
    return 'combustible_vehiculo';
  }

  if (fullText.includes('mantenimiento')) return 'mantenimiento_edificio';
  if (
    fullText.includes('cochera') ||
    fullText.includes('estacionamiento') ||
    fullText.includes('parqueo') ||
    fullText.includes('garage')
  ) {
    return 'alquiler_cochera';
  }
  if (
    fullText.includes('alquiler') ||
    fullText.includes('departamento') ||
    fullText.includes('depa') ||
    fullText.includes('renta depa')
  ) {
    return 'alquiler_departamento';
  }
  if (
    fullText.includes('luz') ||
    fullText.includes('enel') ||
    fullText.includes('luz del sur') ||
    fullText.includes('electricidad')
  ) {
    return 'servicio_luz';
  }
  if (fullText.includes('agua') || fullText.includes('sedapal')) {
    return 'servicio_agua';
  }
  if (
    fullText.includes('internet') ||
    fullText.includes('cable') ||
    fullText.includes('claro') ||
    fullText.includes('movistar') ||
    fullText.includes('win') ||
    fullText.includes('entel') ||
    fullText.includes('telefono') ||
    fullText.includes('teléfono') ||
    fullText.includes('celular')
  ) {
    return 'servicio_internet_telefono';
  }
  if (
    fullText.includes('calidda') ||
    fullText.includes('cálidda') ||
    fullText.includes('balon de gas') ||
    fullText.includes('balón de gas') ||
    fullText.includes('servicio de gas') ||
    fullText.includes('recibo de gas') ||
    (/\bgas\b/i.test(fullText) && !fullText.includes('gasto') && !fullText.includes('gastron') && !fullText.includes('gasfitero'))
  ) {
    return 'servicio_gas';
  }
  if (
    fullText.includes('arbitrios') ||
    fullText.includes('muni') ||
    fullText.includes('predial')
  ) {
    return 'arbitrios_municipales';
  }
  if (
    fullText.includes('gym') ||
    fullText.includes('gimnasio') ||
    fullText.includes('smartfit')
  ) {
    return 'suscripcion_gimnasio';
  }
  if (
    fullText.includes('colegio') ||
    fullText.includes('escuela') ||
    fullText.includes('universidad') ||
    fullText.includes('pension') ||
    fullText.includes('pensión')
  ) {
    return 'pension_educativa';
  }
  if (fullText.includes('paramount')) return 'suscripcion_paramount';
  if (fullText.includes('netflix')) return 'suscripcion_netflix';
  if (fullText.includes('spotify')) return 'suscripcion_spotify';
  if (fullText.includes('icloud') || fullText.includes('apple')) return 'suscripcion_apple_icloud';
  if (fullText.includes('amazon') || fullText.includes('prime')) return 'suscripcion_amazon_prime';
  if (fullText.includes('disney')) return 'suscripcion_disney';
  if (fullText.includes('hbo') || fullText.includes('max')) return 'suscripcion_hbo_max';

  // Normalize generic concept: strip generic terms like "suscripcion", "servicio", "pago", month names, numbers
  const titleOrConcept = (tx.titulo_resumen || tx.items[0]?.concepto || '').toLowerCase();
  const cleaned = titleOrConcept
    .replace(/\b(suscripcion|suscripción|servicio|pago|cuota|mensual|fee|de|del|la|el|gastos|gasto|fijo)\b/gi, '')
    .replace(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre)\b/gi, '')
    .replace(/\b20\d\d\b/g, '')
    .replace(/[\d]/g, '')
    .replace(/[^\w\s]/gi, '')
    .trim();

  return cleaned || tx.id;
};

/**
  Checks if two transaction records represent the exact same recurring fixed concept.
 */
export const areSameRecurringConcept = (t1: TransactionRecord, t2: TransactionRecord): boolean => {
  if (t1.id === t2.id) return true;
  const key1 = getRecurringConceptKey(t1);
  const key2 = getRecurringConceptKey(t2);
  if (key1 && key2 && key1 === key2) return true;

  const getCleanName = (tx: TransactionRecord) => {
    const raw = (tx.titulo_resumen || tx.items[0]?.concepto || '').toLowerCase();
    return raw
      .replace(/\b(suscripcion|suscripción|servicio|pago|cuota|mensual|fee|de|del|la|el|gastos|gasto|fijo)\b/gi, '')
      .replace(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre)\b/gi, '')
      .replace(/\b20\d\d\b/g, '')
      .replace(/[\d]/g, '')
      .replace(/[^\w\s]/gi, '')
      .trim();
  };

  const name1 = getCleanName(t1);
  const name2 = getCleanName(t2);
  if (name1 && name2 && (name1 === name2 || name1.includes(name2) || name2.includes(name1))) {
    return true;
  }

  return false;
};

/**
 * Filter transactions that represent recurring fixed expenses (Rent, Utilities, Subscriptions, Maintenance).
 */
export const filterRawFixedExpenses = (transactions: TransactionRecord[]): TransactionRecord[] => {
  return transactions.filter((t) => {
    if (t.tipo_operacion !== 'GASTO') return false;

    // Multi-installment credit card purchases (> 1 cuota) are tracked separately in cuotas projection
    if (t.metodo_pago === 'CREDITO' && t.cuotas > 1) return false;

    // Vehicle fuel (Gasolina, Repsol, Primax) is an operational variable expense, not a fixed home utility
    const text = (
      (t.titulo_resumen || '') +
      ' ' +
      (t.comercio || '') +
      ' ' +
      t.items.map((i) => `${i.concepto} ${i.subcategoria || ''} ${i.categoria_principal || ''}`).join(' ')
    ).toLowerCase();

    const isVehicleFuel =
      text.includes('gasolina') ||
      text.includes('gasohol') ||
      text.includes('combustible') ||
      text.includes('grifo') ||
      text.includes('primax') ||
      text.includes('repsol') ||
      text.includes('pecsa') ||
      text.includes('petroperu');

    if (isVehicleFuel && t.es_gasto_fijo !== true) return false;

    // 1. Explicitly marked as fixed by user, badge, or recurring settings
    if (t.es_gasto_fijo === true) return true;
    if (t.frecuencia_recurrencia === 'MENSUAL') return true;

    // 2. Pending commitments with payment day or fixed keywords
    if (t.estado_pago === 'PENDIENTE' && Boolean(t.dia_pago_mensual)) return true;

    // Explicitly cancelled or marked as not fixed for executed historical one-time purchases
    if (t.es_gasto_fijo === false && t.frecuencia_recurrencia === 'PUNTUAL' && t.estado_pago !== 'PENDIENTE') {
      return false;
    }

    // 3. Keyword heuristic detection
    const isCleaningOrGrocery =
      text.includes('limpieza') ||
      text.includes('aseo') ||
      text.includes('detergente') ||
      text.includes('desinfectante') ||
      text.includes('jabón') ||
      text.includes('jabon') ||
      text.includes('shampoo') ||
      text.includes('supermercado') ||
      text.includes('abarrotes') ||
      text.includes('víveres') ||
      text.includes('viveres');

    if (isCleaningOrGrocery) return false;

    const hasFixedKeyword =
      text.includes('alquiler') ||
      text.includes('departamento') ||
      text.includes('depa') ||
      text.includes('cochera') ||
      text.includes('estacionamiento') ||
      text.includes('mantenimiento') ||
      text.includes('luz') ||
      text.includes('agua') ||
      text.includes('internet') ||
      text.includes('calidda') ||
      text.includes('cálidda') ||
      text.includes('servicio de gas') ||
      text.includes('recibo de gas') ||
      text.includes('balon de gas') ||
      text.includes('balón de gas') ||
      (/\bgas\b/i.test(text) && !text.includes('gasto') && !text.includes('gastron') && !text.includes('gasfitero')) ||
      text.includes('telefono') ||
      text.includes('teléfono') ||
      text.includes('celular') ||
      text.includes('suscripc') ||
      text.includes('colegio') ||
      text.includes('escuela') ||
      text.includes('pension') ||
      text.includes('pensión') ||
      text.includes('gym') ||
      text.includes('gimnasio') ||
      text.includes('seguro') ||
      text.includes('arbitrios') ||
      text.includes('paramount') ||
      text.includes('netflix') ||
      text.includes('spotify') ||
      text.includes('icloud') ||
      text.includes('prime') ||
      text.includes('disney') ||
      text.includes('hbo') ||
      text.includes('youtube') ||
      text.includes('max') ||
      text.includes('apple') ||
      text.includes('cada mes');

    if (hasFixedKeyword) return true;

    return false;
  });
};

/**
 * Obtains the latest registered/paid transaction for each recurring fixed service concept.
 * This ensures variable services (Luz, Agua, Teléfono) use the exact amount of the LAST PAID MONTH
 * rather than summing or averaging historical receipts.
 */
export const getLatestFixedExpenses = (transactions: TransactionRecord[]): TransactionRecord[] => {
  const rawFixed = filterRawFixedExpenses(transactions);

  // Sort by prioritizing PENDIENTE commitments (unpaid upcoming receipts) first,
  // then explicitly marked es_gasto_fijo, then date descending.
  const sorted = [...rawFixed].sort((a, b) => {
    // 1. Pending commitments take highest precedence
    if (a.estado_pago === 'PENDIENTE' && b.estado_pago !== 'PENDIENTE') return -1;
    if (b.estado_pago === 'PENDIENTE' && a.estado_pago !== 'PENDIENTE') return 1;

    // 2. Explicitly marked as fixed
    if (a.es_gasto_fijo === true && b.es_gasto_fijo !== true) return -1;
    if (b.es_gasto_fijo === true && a.es_gasto_fijo !== true) return 1;

    // 3. Most recent date
    const dateA = new Date(a.fecha);
    const dateB = new Date(b.fecha);
    const timeA = dateA.getTime();
    const timeB = dateB.getTime();
    if (timeA !== timeB) return timeB - timeA;
    return (b.id || '').localeCompare(a.id || '');
  });

  const latestMap = new Map<string, TransactionRecord>();
  sorted.forEach((tx) => {
    const key = getRecurringConceptKey(tx);
    if (!latestMap.has(key)) {
      latestMap.set(key, tx);
    }
  });

  return Array.from(latestMap.values());
};

/**
 * Checks if an income transaction corresponds to the regular base monthly salary (nómina/haberes/planilla).
 * Incomes that are freelance, bonuses, sales, commissions, or other extras are classified as additional incomes.
 */
export const isSalaryIncomeTransaction = (tx: TransactionRecord): boolean => {
  if (tx.tipo_operacion !== 'INGRESO') return false;

  const text = (
    (tx.titulo_resumen || '') +
    ' ' +
    (tx.comercio || '') +
    ' ' +
    (tx.mensaje_usuario || '') +
    ' ' +
    tx.items.map((i) => `${i.concepto} ${i.subcategoria || ''} ${i.categoria_principal || ''}`).join(' ')
  ).toLowerCase();

  // Explicit salary phrases (nómina, haberes, adelantos de sueldo, quincena, etc.)
  const isExplicitSalaryPhrase =
    text.includes('sueldo') ||
    text.includes('salario') ||
    text.includes('adelanto') ||
    text.includes('anticipo') ||
    text.includes('quincena') ||
    text.includes('nómina') ||
    text.includes('nomina') ||
    text.includes('planilla') ||
    text.includes('remuneracion') ||
    text.includes('remuneración') ||
    text.includes('haberes') ||
    text.includes('a cuenta de sueldo') ||
    text.includes('pago mensual') ||
    tx.frecuencia_recurrencia === 'MENSUAL';

  const isExtraOrFreelance =
    text.includes('extra') ||
    text.includes('adicional') ||
    text.includes('freelance') ||
    text.includes('honorario') ||
    text.includes('bono') ||
    text.includes('comision') ||
    text.includes('comisión') ||
    text.includes('venta') ||
    text.includes('interes') ||
    text.includes('interés') ||
    text.includes('rendimiento') ||
    text.includes('dividendo') ||
    text.includes('alquiler cobrado') ||
    text.includes('cashback') ||
    text.includes('reembolso') ||
    text.includes('devolucion') ||
    text.includes('devolución') ||
    text.includes('premio') ||
    text.includes('regalo') ||
    text.includes('propina');

  // If it mentions salary/adelanto/quincena, treat as base salary advance
  if (isExplicitSalaryPhrase) {
    // Only exclude if it's explicitly marked as an extra bonus on top of salary
    if (text.includes('bono extra') || text.includes('ingreso adicional')) return false;
    return true;
  }

  if (isExtraOrFreelance) return false;

  return false;
};

/**
 * Checks if a transaction is a pending fixed expense due within 4 days (or overdue).
 */
export const isUpcomingDueDateAlert = (tx: TransactionRecord, currentDay = new Date().getDate()): boolean => {
  if (tx.tipo_operacion !== 'GASTO') return false;
  if (tx.estado_pago !== 'PENDIENTE') return false;
  
  const dueDay = tx.dia_pago_mensual || 21;
  const daysRemaining = dueDay - currentDay;
  
  // Alert activates if due within 4 days (or overdue)
  return daysRemaining <= 4;
};

export type PyGPersonalTier = 'SUBSISTENCIA' | 'OPERATIVO' | 'DISCRECIONAL' | 'DEUDA_PASIVO';

/**
 * Maps a transaction or item into the Standard Personal P&G (Estado de Resultados) Financial Tiers:
 * 1. SUBSISTENCIA: Costos Fijos Estructurales (Alquiler, Vivienda, Luz, Agua, Internet, Educación, Salud)
 * 2. OPERATIVO: Costos Variables Operativos (Alimentación/Supermercado diario, Combustible, Mantenimiento preventivo)
 * 3. DISCRECIONAL: Gastos Discrecionales (Estilo de Vida, Antojos, Salidas, Ocio, Compras)
 * 4. DEUDA_PASIVO: Servicio de Deuda / Reducción de Pasivos (Cuotas de Crédito, Amortizaciones de Tarjeta o Préstamo)
 */
export const getFinancialTier = (
  catName: string,
  subcatName: string,
  concepto: string,
  metodoPago: string,
  cuotas: number,
  esGastoFijo?: boolean
): PyGPersonalTier => {
  const c = catName.toLowerCase().trim();
  const s = subcatName.toLowerCase().trim();
  const k = concepto.toLowerCase().trim();
  const text = `${c} ${s} ${k}`;

  // 1. Debt Service / Liabilities reduction
  if (
    c.includes('crédito') ||
    c.includes('credito') ||
    c.includes('compromisos') ||
    s.includes('tarjeta') ||
    s.includes('préstamo') ||
    s.includes('prestamo') ||
    s.includes('cuotas') ||
    s.includes('amortización') ||
    s.includes('amortizacion') ||
    k.includes('tarjeta') ||
    k.includes('préstamo') ||
    k.includes('prestamo') ||
    k.includes('amortización') ||
    (metodoPago === 'CREDITO' && cuotas > 1)
  ) {
    return 'DEUDA_PASIVO';
  }

  // 2. Fixed Structural / Existence Expenses (Subsistencia)
  if (
    esGastoFijo ||
    c.includes('servicios') ||
    c.includes('vivienda') ||
    s.includes('alquiler') ||
    s.includes('mantenimiento de edificio') ||
    s.includes('agua') ||
    s.includes('luz') ||
    s.includes('electricidad') ||
    s.includes('internet') ||
    s.includes('teléfono') ||
    s.includes('telefono') ||
    s.includes('gas') ||
    s.includes('educación') ||
    s.includes('educacion') ||
    s.includes('colegio') ||
    s.includes('universidad') ||
    s.includes('salud') ||
    s.includes('seguro') ||
    s.includes('gimnasio') ||
    k.includes('alquiler') ||
    k.includes('mantenimiento') ||
    k.includes('cochera')
  ) {
    return 'SUBSISTENCIA';
  }

  // 3. Discretionary / Lifestyle
  if (
    c.includes('ocio') ||
    c.includes('salidas') ||
    c.includes('hormiga') ||
    c.includes('antojos') ||
    s.includes('salida') ||
    s.includes('restaurante') ||
    s.includes('chatarra') ||
    s.includes('deliveries') ||
    s.includes('delivery') ||
    s.includes('viaje') ||
    s.includes('pasatiempo') ||
    s.includes('compras por internet') ||
    k.includes('antojo') ||
    k.includes('capricho') ||
    k.includes('cine') ||
    k.includes('ropa') ||
    k.includes('tecnología') ||
    k.includes('tecnologia')
  ) {
    return 'DISCRECIONAL';
  }

  // 4. Default Operational Variable (Supermarket, Fuel, Transportation, Pets, Personal Care)
  return 'OPERATIVO';
};

