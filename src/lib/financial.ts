import { TransactionRecord } from '../types';

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

  // Remove month names, years, numbers and dates to normalize recurring titles like "Luz Julio 2026"
  const cleaned = fullText
    .replace(
      /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre)\b/gi,
      ''
    )
    .replace(/\b20\d\d\b/g, '')
    .replace(/[\d]/g, '')
    .trim();

  return cleaned || tx.id;
};

/**
 * Filter transactions that represent recurring fixed expenses (Rent, Utilities, Subscriptions, Maintenance).
 */
export const filterRawFixedExpenses = (transactions: TransactionRecord[]): TransactionRecord[] => {
  return transactions.filter((t) => {
    if (t.tipo_operacion !== 'GASTO') return false;

    // Credit card installment purchases are tracked separately in cuotas
    if (t.metodo_pago === 'CREDITO' || (t.cuotas && t.cuotas > 1)) return false;

    if (t.estado_pago === 'PENDIENTE') return true;
    if (t.es_gasto_fijo === true) return true;

    const text = (
      (t.titulo_resumen || '') +
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
      text.includes('pension') ||
      text.includes('pensión') ||
      text.includes('gym') ||
      text.includes('gimnasio') ||
      text.includes('seguro') ||
      text.includes('arbitrios');

    return hasFixedKeyword || t.es_gasto_fijo !== false;
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
