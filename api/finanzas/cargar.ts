import { getAuthenticatedClients, findOrCreateSpreadsheet } from '../../lib/sheets-helper.js';

export const parseCleanAmount = (val: any): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  let str = String(val).trim();
  str = str.replace(/^(S\/\.?|\$|€|USD|PEN)\s*/i, '');
  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/,/g, '');
  } else if (str.includes(',') && !str.includes('.')) {
    str = str.replace(',', '.');
  }
  const match = str.match(/-?\d+(?:\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
};

export async function handleCargar(req: any, res: any) {
  try {
    const { drive, sheets } = getAuthenticatedClients(req, res);
    const url = new URL(req.url, 'http://localhost');
    const queryId = req.query?.spreadsheetId || url.searchParams.get('spreadsheetId');

    let targetId = queryId;
    let targetUrl = targetId ? `https://docs.google.com/spreadsheets/d/${targetId}` : '';

    if (!targetId) {
      const sheetInfo = await findOrCreateSpreadsheet(drive, sheets);
      targetId = sheetInfo.id;
      targetUrl = sheetInfo.url;
    }

    let backupParsed: any = null;

    // 1. Try reading _DataBackup tab
    try {
      const backupRes = await sheets.spreadsheets.values.get({
        spreadsheetId: targetId,
        range: "'_DataBackup'!A1:A50",
      });
      const rows = backupRes.data?.values || [];
      const rawJson = rows.map((r: any) => (r && r[0]) || '').join('');
      if (rawJson) {
        backupParsed = JSON.parse(rawJson);
      }
    } catch (err) {
      console.warn('Pestaña _DataBackup no encontrada o vacía:', err);
    }

    // 2. Discover available sheet tabs in the spreadsheet
    let targetSheetTitle = 'Transacciones';
    try {
      const meta = await sheets.spreadsheets.get({
        spreadsheetId: targetId,
        fields: 'sheets.properties.title',
      } as any);
      const sheetTitles: string[] = (meta.data.sheets || [])
        .map((s) => s.properties?.title)
        .filter((t): t is string => Boolean(t));
      if (sheetTitles.includes('Transacciones')) {
        targetSheetTitle = 'Transacciones';
      } else {
        const visibleSheet = sheetTitles.find((t) => !t.startsWith('_') && !t.includes('Backup'));
        if (visibleSheet) targetSheetTitle = visibleSheet;
      }
    } catch (metaErr) {
      console.warn('Error obteniendo pestañas de la hoja:', metaErr);
    }

    // 3. Read rows from target sheet (including header row)
    let sheetTransactions: any[] = [];
    try {
      const txRes = await sheets.spreadsheets.values.get({
        spreadsheetId: targetId,
        range: `${targetSheetTitle}!A1:Z2000`,
      });
      const rawRows: string[][] = txRes.data.values || [];

      if (rawRows.length > 0) {
        let idCol = 0;
        let dateCol = 1;
        let typeCol = 2;
        let amountCol = 3;
        let methodCol = 4;
        let quotaCol = 5;
        let monthlyQuotaCol = 6;
        let alertCol = 7;
        let freeMoneyCol = 8;
        let detailCol = 9;
        let userMsgCol = 10;
        let fixedCol = 11;
        let freqCol = 12;

        const firstRow = rawRows[0] || [];
        const hasHeaderKeywords = firstRow.some((cell) => {
          const str = String(cell || '').toLowerCase();
          return str.includes('fecha') || str.includes('monto') || str.includes('tipo') || str.includes('detalle') || str.includes('id');
        });

        let dataRows = rawRows;
        if (hasHeaderKeywords) {
          firstRow.forEach((cell, idx) => {
            const h = String(cell || '').toLowerCase().trim();
            if (h === 'id') idCol = idx;
            else if (h.includes('fecha') || h.includes('date')) dateCol = idx;
            else if (h.includes('tipo operac') || (h.includes('tipo') && !h.includes('gasto'))) typeCol = idx;
            else if (h.includes('monto total') || h.includes('monto') || h.includes('importe') || h.includes('total')) amountCol = idx;
            else if (h.includes('m[eé]todo') || h.includes('pago') || h.includes('medio')) methodCol = idx;
            else if (h === 'cuotas' || h.includes('nro cuota')) quotaCol = idx;
            else if (h.includes('cuota mensual')) monthlyQuotaCol = idx;
            else if (h.includes('alerta')) alertCol = idx;
            else if (h.includes('dinero libre') || h.includes('disponible') || h.includes('restante')) freeMoneyCol = idx;
            else if (h.includes('detalle') || h.includes('concepto') || h.includes('descrip') || h.includes('item')) detailCol = idx;
            else if (h.includes('mensaje') || h.includes('asistente') || h.includes('nota')) userMsgCol = idx;
            else if (h.includes('fijo') || h.includes('tipo gasto')) fixedCol = idx;
            else if (h.includes('frecuencia') || h.includes('recurrencia')) freqCol = idx;
          });
          dataRows = rawRows.slice(1);
        }

        sheetTransactions = dataRows
          .filter((row) => row && row.some((cell) => cell && String(cell).trim() !== ''))
          .map((row, rowIdx) => {
            const rawId = (row[idCol] || '').toString().trim();
            const id = rawId && rawId.length > 2 ? rawId : `tx-backend-${Date.now()}-${rowIdx}`;
            const fecha = row[dateCol] || new Date().toISOString().split('T')[0];
            const tipo_operacion = (row[typeCol] || '').toString().toUpperCase().includes('INGRESO') ? 'INGRESO' : 'GASTO';
            const monto_total = parseCleanAmount(row[amountCol]);
            const rawMetodo = (row[methodCol] || 'EFECTIVO').toString().toUpperCase().trim();
            const metodo_pago = rawMetodo.includes('CREDITO')
              ? 'CREDITO'
              : rawMetodo.includes('DEBITO')
              ? 'DEBITO'
              : 'EFECTIVO';

            const cuotas = parseInt(row[quotaCol] || '1', 10) || 1;
            const monto_cuota_mensual =
              parseCleanAmount(row[monthlyQuotaCol]) || (cuotas > 0 ? monto_total / cuotas : monto_total);
            const alerta_ahorro_comprometido =
              (row[alertCol] || '').toString().toUpperCase().includes('SÍ') || (row[alertCol] || '').toString().toUpperCase().includes('SI');
            const dinero_libre_restante = parseCleanAmount(row[freeMoneyCol]);
            const detailStr = (row[detailCol] || '').toString().trim();
            const mensaje_usuario = (row[userMsgCol] || 'Transacción sincronizada desde Google Sheets.').toString().trim();

            let items: any[] = [
              {
                concepto: detailStr || 'Operación',
                monto: monto_total,
                categoria_principal: 'Alimentación y Dieta',
                subcategoria: 'General',
              },
            ];

            if (detailStr && detailStr.includes(' | ')) {
              const splitParts = detailStr.split(' | ');
              items = splitParts.map((p) => {
                const match = p.match(/^(.*?)\s*\((.*?):\s*(?:S\/\.?|\$|€|USD|PEN)?\s*([\d,.]+)\)$/i);
                if (match) {
                  return {
                    concepto: match[1].trim() || 'Ítem',
                    categoria_principal: match[2].trim() || 'Alimentación y Dieta',
                    subcategoria: 'General',
                    monto: parseCleanAmount(match[3]) || monto_total / splitParts.length,
                  };
                }
                return {
                  concepto: p.trim(),
                  monto: monto_total / splitParts.length,
                  categoria_principal: 'Alimentación y Dieta',
                  subcategoria: 'General',
                };
              });
            }

            const rawTipoGasto = (row[fixedCol] || '').toString().trim().toUpperCase();
            const rawFrecuencia = (row[freqCol] || '').toString().trim().toUpperCase();
            let es_gasto_fijo: boolean | undefined = undefined;
            if (rawTipoGasto.includes('FIJO')) {
              es_gasto_fijo = true;
            } else if (rawTipoGasto.includes('ÚNICO') || rawTipoGasto.includes('UNICO') || rawTipoGasto.includes('PUNTUAL')) {
              es_gasto_fijo = false;
            }
            let frecuencia_recurrencia: 'MENSUAL' | 'PUNTUAL' | undefined = undefined;
            if (rawFrecuencia === 'MENSUAL' || rawFrecuencia === 'PUNTUAL') {
              frecuencia_recurrencia = rawFrecuencia;
            }

            return {
              id,
              fecha,
              tipo_operacion,
              monto_total,
              metodo_pago,
              cuotas,
              monto_cuota_mensual,
              alerta_ahorro_comprometido,
              dinero_libre_restante,
              items,
              mensaje_usuario,
              ...(es_gasto_fijo !== undefined ? { es_gasto_fijo } : {}),
              ...(frecuencia_recurrencia !== undefined ? { frecuencia_recurrencia } : {}),
            };
          });
      }
    } catch (sheetErr) {
      console.warn('Error leyendo pestaña de transacciones:', sheetErr);
    }

    // 4. Merge backup metadata with physical sheet rows
    const backupList: any[] = Array.isArray(backupParsed?.transactions) ? backupParsed.transactions : [];
    const map = new Map<string, any>();

    backupList.forEach((t) => {
      if (t && t.id) map.set(t.id, t);
    });

    sheetTransactions.forEach((stx) => {
      if (!stx.id) return;
      const existing = map.get(stx.id);
      if (existing) {
        map.set(stx.id, {
          ...existing,
          fecha: stx.fecha,
          monto_total: stx.monto_total,
          tipo_operacion: stx.tipo_operacion,
          metodo_pago: stx.metodo_pago,
          cuotas: stx.cuotas,
          monto_cuota_mensual: stx.monto_cuota_mensual,
          items: stx.items || existing.items,
          ...(stx.es_gasto_fijo !== undefined ? { es_gasto_fijo: stx.es_gasto_fijo } : {}),
          ...(stx.frecuencia_recurrencia !== undefined ? { frecuencia_recurrencia: stx.frecuencia_recurrencia } : {}),
        });
      } else {
        map.set(stx.id, stx);
      }
    });

    const mergedTransactions = sheetTransactions.length > 0
      ? sheetTransactions.map(stx => map.get(stx.id) || stx)
      : Array.from(map.values());

    return res.json({
      success: true,
      spreadsheetId: targetId,
      spreadsheetUrl: targetUrl,
      data: {
        transactions: mergedTransactions,
        config: backupParsed?.config,
        categoryBudgets: backupParsed?.categoryBudgets,
      },
    });
  } catch (err: any) {
    const isAuthErr =
      err?.code === '401_UNAUTHENTICATED' ||
      err?.statusCode === 401 ||
      err?.status === 401 ||
      err?.message?.includes('401') ||
      err?.code === 401;

    if (!isAuthErr) {
      console.error('Error en /api/finanzas/cargar:', err);
    }
    return res.status(isAuthErr ? 401 : 500).json({
      success: false,
      code: isAuthErr ? '401_UNAUTHENTICATED' : 'INTERNAL_ERROR',
      error: err?.message || 'Error cargando datos de Google Drive',
    });
  }
}

export default async function handler(req: any, res: any) {
  return handleCargar(req, res);
}
