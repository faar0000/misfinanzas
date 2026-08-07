import { TransactionRecord, BudgetSummary } from '../types';

export interface GoogleDriveSyncResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  syncedAt: string;
}

/**
 * Searches for an existing Google Sheet by name in Google Drive, or creates a new one.
 */
export async function getOrCreateFinancialSpreadsheet(
  accessToken: string,
  title: string = 'Control Financiero Personal'
): Promise<{ id: string; url: string }> {
  // 1. Search in Drive
  const query = encodeURIComponent(`name = '${title}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`);
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)`;

  const searchRes = await fetch(searchUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!searchRes.ok) {
    const errText = await searchRes.text();
    if (searchRes.status === 401) {
      throw new Error('401 UNAUTHENTICATED: La sesión de Google ha expirado. Por favor reconecta tu cuenta.');
    }
    throw new Error(`Error buscando archivo en Google Drive: ${errText}`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    const existingFile = searchData.files[0];
    return {
      id: existingFile.id,
      url: existingFile.webViewLink || `https://docs.google.com/spreadsheets/d/${existingFile.id}`,
    };
  }

  // 2. Create new Google Sheet if not found
  const createUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
  const createBody = {
    properties: {
      title,
    },
    sheets: [
      {
        properties: {
          title: 'Transacciones',
        },
      },
      {
        properties: {
          title: 'Resumen Presupuesto',
        },
      },
    ],
  };

  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createBody),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    if (createRes.status === 401) {
      throw new Error('401 UNAUTHENTICATED: La sesión de Google ha expirado. Por favor reconecta tu cuenta.');
    }
    throw new Error(`Error creando planilla en Google Sheets: ${errText}`);
  }

  const newSheetData = await createRes.json();
  return {
    id: newSheetData.spreadsheetId,
    url: newSheetData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${newSheetData.spreadsheetId}`,
  };
}

/**
 * Syncs transaction history and financial health summary into the Google Sheet.
 */
export async function syncDataToGoogleSheets(
  accessToken: string,
  spreadsheetId: string,
  transactions: TransactionRecord[],
  summary: BudgetSummary,
  monedaSimbolo: string
): Promise<GoogleDriveSyncResult> {
  // Header and rows for 'Transacciones' sheet
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
  ];

  const transactionRows = transactions.map((tx) => [
    tx.id,
    tx.fecha,
    tx.tipo_operacion,
    `${monedaSimbolo} ${tx.monto_total.toFixed(2)}`,
    tx.metodo_pago,
    tx.cuotas,
    `${monedaSimbolo} ${tx.monto_cuota_mensual.toFixed(2)}`,
    tx.alerta_ahorro_comprometido ? 'SÍ - RIESGO' : 'NO - NORMAL',
    `${monedaSimbolo} ${tx.dinero_libre_restante.toFixed(2)}`,
    tx.items.map((i) => `${i.concepto} (${i.categoria_principal}: ${monedaSimbolo}${i.monto.toFixed(2)})`).join(' | '),
    tx.mensaje_usuario,
  ]);

  const transaccionesValues = [headers, ...transactionRows];

  // Update 'Transacciones' sheet
  const txUpdateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transacciones!A1?valueInputOption=USER_ENTERED`;
  const txRes = await fetch(txUpdateUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range: 'Transacciones!A1',
      majorDimension: 'ROWS',
      values: transaccionesValues,
    }),
  });

  if (!txRes.ok) {
    const errText = await txRes.text();
    if (txRes.status === 401) {
      throw new Error('401 UNAUTHENTICATED: La sesión de Google ha expirado. Por favor reconecta tu cuenta.');
    }
    throw new Error(`Error actualizando pestaña Transacciones: ${errText}`);
  }

  // Summary sheet rows
  const summaryValues = [
    ['REPORTE DE CONTROL FINANCIERO PERSONAL', ''],
    ['Última Sincronización', new Date().toLocaleString('es-PE')],
    ['', ''],
    ['Métrica Presupuestal', 'Monto'],
    ['Ingreso Mensual Base', `${monedaSimbolo} ${summary.ingresoMensual.toFixed(2)}`],
    ['Ingresos Reales Recibidos en Banco', `${monedaSimbolo} ${summary.ingresosCobradosTotal.toFixed(2)}`],
    ['Sueldo / Ingreso Pendiente por Cobrar', `${monedaSimbolo} ${summary.montoPendienteCobrar.toFixed(2)}`],
    ['Meta Protegida de Ahorro (10%)', `${monedaSimbolo} ${summary.metaAhorroMonto.toFixed(2)}`],
    ['Gastos Totales Registrados', `${monedaSimbolo} ${summary.gastosTotalesProyectados.toFixed(2)}`],
    ['Saldo Real en Cuenta Bancaria', `${monedaSimbolo} ${summary.saldoBancoReal.toFixed(2)}`],
    ['Dinero Libre Disponible', `${monedaSimbolo} ${summary.dineroLibreDisponible.toFixed(2)}`],
    ['Estado Ahorro Protegido', summary.alertaAhorroComprometido ? '⚠️ ALERTA: AHORRO COMPROMETIDO' : '✅ SEGURO: AHORRO PROTEGIDO'],
  ];

  const sumUpdateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Resumen Presupuesto'!A1?valueInputOption=USER_ENTERED`;
  const sumRes = await fetch(sumUpdateUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range: "'Resumen Presupuesto'!A1",
      majorDimension: 'ROWS',
      values: summaryValues,
    }),
  });

  if (!sumRes.ok) {
    const errText = await sumRes.text();
    if (sumRes.status === 401) {
      throw new Error('401 UNAUTHENTICATED: La sesión de Google ha expirado. Por favor reconecta tu cuenta.');
    }
    throw new Error(`Error actualizando pestaña Resumen Presupuesto: ${errText}`);
  }

  return {
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    syncedAt: new Date().toLocaleTimeString('es-PE'),
  };
}
