import {
  getAuthenticatedClients,
  findOrCreateSpreadsheet,
  ensureBackupTabExists,
} from './sheets-helper.js';

export async function handleGuardar(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
  }

  try {
    const { oauth2Client, drive, sheets } = getAuthenticatedClients(req, res);

    const {
      spreadsheetId: providedSpreadsheetId,
      transactions = [],
      summary = {},
      monedaSimbolo = 'S/.',
      extraBackupData = {},
    } = req.body || {};

    // 1. Locate or create the spreadsheet in user's Drive
    let targetId = providedSpreadsheetId;
    let targetUrl = targetId ? `https://docs.google.com/spreadsheets/d/${targetId}` : '';

    if (!targetId) {
      const sheetInfo = await findOrCreateSpreadsheet(drive, sheets);
      targetId = sheetInfo.id;
      targetUrl = sheetInfo.url;
    }

    // 2. Prepare headers & rows for 'Transacciones' sheet
    const headers = [
      'ID',
      'Fecha',
      'Tipo',
      'Monto Total',
      'Método Pago',
      'Cuotas',
      'Cuota Mensual',
      'Alerta Ahorro',
      'Dinero Libre Restante',
      'Detalle / Conceptos',
      'Mensaje Asistente',
      'Tipo Gasto (Fijo / Único)',
      'Frecuencia Recurrencia',
    ];

    const transactionRows = (transactions || []).map((tx: any) => [
      tx.id || '',
      tx.fecha || '',
      tx.tipo_operacion || '',
      `${monedaSimbolo} ${(Number(tx.monto_total) || 0).toFixed(2)}`,
      tx.metodo_pago || 'EFECTIVO',
      tx.cuotas || 1,
      `${monedaSimbolo} ${(Number(tx.monto_cuota_mensual) || Number(tx.monto_total) || 0).toFixed(2)}`,
      tx.alerta_ahorro_comprometido ? 'SÍ - RIESGO' : 'NO - NORMAL',
      `${monedaSimbolo} ${(Number(tx.dinero_libre_restante) || 0).toFixed(2)}`,
      Array.isArray(tx.items)
        ? tx.items
            .map(
              (i: any) =>
                `${i.concepto || 'Ítem'} (${i.categoria_principal || 'General'}: ${monedaSimbolo}${(Number(i.monto) || 0).toFixed(2)})`
            )
            .join(' | ')
        : '',
      tx.mensaje_usuario || '',
      tx.es_gasto_fijo ? 'GASTO FIJO' : 'COMPRA ÚNICA',
      tx.frecuencia_recurrencia || (tx.es_gasto_fijo ? 'MENSUAL' : 'PUNTUAL'),
    ]);

    const transaccionesValues = [headers, ...transactionRows];

    // 3. Clear existing transactions rows to remove stale deleted rows
    try {
      await sheets.spreadsheets.values.clear({
        spreadsheetId: targetId,
        range: 'Transacciones!A1:Z',
      });
    } catch {
      // Non-blocking if sheet was empty
    }

    // 4. Update 'Transacciones'
    await sheets.spreadsheets.values.update({
      spreadsheetId: targetId,
      range: 'Transacciones!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: transaccionesValues,
      },
    });

    // 5. Update 'Resumen Presupuesto'
    const summaryValues = [
      ['REPORTE DE CONTROL FINANCIERO PERSONAL', ''],
      ['Última Sincronización', new Date().toLocaleString('es-PE')],
      ['', ''],
      ['Métrica Presupuestal', 'Monto'],
      ['Ingreso Mensual Base', `${monedaSimbolo} ${(Number(summary.ingresoMensual) || 0).toFixed(2)}`],
      ['Ingresos Reales Recibidos en Banco', `${monedaSimbolo} ${(Number(summary.ingresosCobradosTotal) || 0).toFixed(2)}`],
      ['Sueldo / Ingreso Pendiente por Cobrar', `${monedaSimbolo} ${(Number(summary.montoPendienteCobrar) || 0).toFixed(2)}`],
      ['Meta Protegida de Ahorro (10%)', `${monedaSimbolo} ${(Number(summary.metaAhorroMonto) || 0).toFixed(2)}`],
      ['Gastos Totales Registrados', `${monedaSimbolo} ${(Number(summary.gastosTotalesProyectados) || 0).toFixed(2)}`],
      ['Saldo Real en Cuenta Bancaria', `${monedaSimbolo} ${(Number(summary.saldoBancoReal) || 0).toFixed(2)}`],
      ['Dinero Libre Disponible', `${monedaSimbolo} ${(Number(summary.dineroLibreDisponible) || 0).toFixed(2)}`],
      [
        'Estado Ahorro Protegido',
        summary.alertaAhorroComprometido ? '⚠️ ALERTA: AHORRO COMPROMETIDO' : '✅ SEGURO: AHORRO PROTEGIDO',
      ],
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: targetId,
      range: "'Resumen Presupuesto'!A1",
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: summaryValues,
      },
    });

    // 6. Save lossless JSON in _DataBackup
    try {
      await ensureBackupTabExists(sheets, targetId);
      const backupJson = JSON.stringify({
        transactions,
        summary,
        config: extraBackupData?.config,
        categoryBudgets: extraBackupData?.categoryBudgets,
        updatedAt: new Date().toISOString(),
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId: targetId,
        range: '_DataBackup!A1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[backupJson]],
        },
      });
    } catch (backupErr) {
      console.warn('Error guardando en _DataBackup:', backupErr);
    }

    return res.json({
      success: true,
      spreadsheetId: targetId,
      spreadsheetUrl: targetUrl || `https://docs.google.com/spreadsheets/d/${targetId}`,
      syncedAt: new Date().toLocaleTimeString('es-PE'),
    });
  } catch (err: any) {
    const isAuthErr =
      err?.code === '401_UNAUTHENTICATED' ||
      err?.statusCode === 401 ||
      err?.message?.includes('401_UNAUTHENTICATED') ||
      err?.code === 401;

    if (!isAuthErr) {
      console.error('Error en /api/finanzas/guardar:', err);
    }
    return res.status(isAuthErr ? 401 : 500).json({
      success: false,
      code: isAuthErr ? '401_UNAUTHENTICATED' : 'INTERNAL_ERROR',
      error: err?.message || 'Error guardando en Google Drive',
    });
  }
}

export default async function handler(req: any, res: any) {
  return handleGuardar(req, res);
}
