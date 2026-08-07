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
    fullText.includes('delivery no planificado');

  if (isJunkFoodOrAntojo) {
    return 'Gastos Hormiga y Antojos';
  }

  // 2. Healthy Food / Diet / Groceries / Household Supermarket Items
  const isHealthyFoodOrGrocery =
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
    s.includes('limpieza') ||
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
    k.includes('alimento') ||
    fullText.includes('plaza vea') ||
    fullText.includes('wong') ||
    fullText.includes('metro') ||
    fullText.includes('tottus') ||
    fullText.includes('vivanda');

  if (isHealthyFoodOrGrocery) {
    return 'Alimentación y Dieta';
  }

  // 3. Category Fallback / Direct Match
  if (c.includes('alimentac') || c.includes('dieta')) return 'Alimentación y Dieta';
  if (c.includes('hormiga') || c.includes('antojo')) return 'Gastos Hormiga y Antojos';
  if (c.includes('vehíc') || c.includes('vehic')) return 'Vehículo';
  if (c.includes('servicios') || c.includes('fijo')) return 'Servicios y Gastos Fijos';
  if (c.includes('ocio') || c.includes('salida')) return 'Ocio y Salidas';
  if (c.includes('crédito') || c.includes('credito') || c.includes('compromiso')) return 'Crédito y Compromisos';

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
    fullText.includes('gas') ||
    fullText.includes('calidda') ||
    fullText.includes('cálidda')
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

    // Credit card installment purchases are tracked separately in cuotas
    if (t.metodo_pago === 'CREDITO' || (t.cuotas && t.cuotas > 1)) return false;

    const text = (
      (t.titulo_resumen || '') +
      ' ' +
      (t.comercio || '') +
      ' ' +
      t.items.map((i) => `${i.concepto} ${i.subcategoria || ''} ${i.categoria_principal || ''}`).join(' ')
    ).toLowerCase();

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
      text.includes('gas') ||
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
      text.includes('netflix') ||
      text.includes('spotify') ||
      text.includes('icloud') ||
      text.includes('prime') ||
      text.includes('disney') ||
      text.includes('hbo') ||
      text.includes('paramount') ||
      text.includes('youtube') ||
      text.includes('max') ||
      text.includes('apple') ||
      text.includes('cada mes');

    if (t.es_gasto_fijo === true) return true;
    if (t.frecuencia_recurrencia === 'MENSUAL') return true;
    if (Boolean(t.dia_pago_mensual)) return true;
    if (hasFixedKeyword) return true;

    // Explicitly cancelled or marked as not fixed
    if (t.es_gasto_fijo === false) return false;

    if (t.estado_pago === 'PENDIENTE' && Boolean(t.dia_pago_mensual)) {
      return true;
    }

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

  // Sort by date descending (latest date first) and prefer PAGADO status
  const sorted = [...rawFixed].sort((a, b) => {
    const timeA = new Date(a.fecha).getTime();
    const timeB = new Date(b.fecha).getTime();
    if (timeA !== timeB) return timeB - timeA;
    if (a.estado_pago === 'PAGADO' && b.estado_pago !== 'PAGADO') return -1;
    if (b.estado_pago === 'PAGADO' && a.estado_pago !== 'PAGADO') return 1;
    return 0;
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
