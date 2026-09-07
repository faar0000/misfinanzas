import { getAuthenticatedClients, findOrCreateSpreadsheet } from './_sheets-helper.js';

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
        range: '_DataBackup!A1',
      });
      const rawJson = backupRes.data.values?.[0]?.[0];
      if (rawJson) {
        backupParsed = JSON.parse(rawJson);
      }
    } catch (err) {
      console.warn('Pestaña _DataBackup no encontrada o vacía:', err);
    }

    // 2. Read 'Transacciones' rows
    let sheetTransactions: any[] = [];
    try {
      const txRes = await sheets.spreadsheets.values.get({
        spreadsheetId: targetId,
        range: 'Transacciones!A2:Z1000',
      });
      const rows: string[][] = txRes.data.values || [];

      sheetTransactions = rows
        .filter((row) => row && row.length >= 3 && row[0] && row[0].trim() !== '')
        .map((row) => {
          const id = row[0].trim();
          const fecha = row[1] || new Date().toISOString().split('T')[0];
          const tipo_operacion = (row[2] || '').toUpperCase().includes('INGRESO') ? 'INGRESO' : 'GASTO';
          const monto_total = parseCleanAmount(row[3]);
          const rawMetodo = (row[4] || 'EFECTIVO').toUpperCase().trim();
          const metodo_pago = rawMetodo.includes('CREDITO')
            ? 'CREDITO'
            : rawMetodo.includes('DEBITO')
            ? 'DEBITO'
            : 'EFECTIVO';

          const cuotas = parseInt(row[5] || '1', 10) || 1;
          const monto_cuota_mensual =
            parseCleanAmount(row[6]) || (cuotas > 0 ? monto_total / cuotas : monto_total);
          const alerta_ahorro_comprometido =
            (row[7] || '').toUpperCase().includes('SÍ') || (row[7] || '').toUpperCase().includes('SI');
          const dinero_libre_restante = parseCleanAmount(row[8]);
          const detailStr = row[9] || '';
          const mensaje_usuario = row[10] || 'Transacción sincronizada desde Google Sheets.';

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

          const rawTipoGasto = (row[11] || '').toString().trim().toUpperCase();
          const rawFrecuencia = (row[12] || '').toString().trim().toUpperCase();
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
    } catch (sheetErr) {
      console.warn('Error leyendo pestaña Transacciones:', sheetErr);
    }

    // 3. Merge backup metadata with physical sheet rows
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
          ...(stx.es_gasto_fijo !== undefined ? { es_gasto_fijo: stx.es_gasto_fijo } : {}),
          ...(stx.frecuencia_recurrencia !== undefined ? { frecuencia_recurrencia: stx.frecuencia_recurrencia } : {}),
        });
      } else {
        map.set(stx.id, stx);
      }
    });

    const mergedTransactions = Array.from(map.values());

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
