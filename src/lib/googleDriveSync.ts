import { TransactionRecord, BudgetSummary } from '../types';

export interface GoogleDriveSyncResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  syncedAt: string;
}

async function handleApiError(res: Response, actionName: string): Promise<never> {
  const errText = await res.text();
  if (typeof window !== 'undefined' && (res.status === 401 || res.status === 403)) {
    localStorage.removeItem('asistente_financiero_google_token');
  }

  if (res.status === 401) {
    throw new Error('401 UNAUTHENTICATED: La sesión de Google ha expirado. Por favor reconecta tu cuenta haciendo clic en "Conectar con Google Drive".');
  }

  if (errText.includes('accessNotConfigured') || errText.includes('has not been used in project') || errText.includes('PERMISSION_DENIED')) {
    throw new Error(
      '403 API_DISABLED: La API de Google Drive / Sheets no está habilitada en el proyecto de Google Cloud o el token pertenece a un proyecto anterior.\n\n' +
      'Se ha limpiado el token guardado. Por favor, haz clic en "Conectar con Google Drive" para sincronizar nuevamente.'
    );
  }

  throw new Error(`Error en ${actionName}: ${errText}`);
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
    await handleApiError(searchRes, 'buscar archivo en Google Drive');
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
    await handleApiError(createRes, 'crear planilla en Google Sheets');
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
    await handleApiError(txRes, 'actualizar pestaña Transacciones');
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
    await handleApiError(sumRes, 'actualizar pestaña Resumen Presupuesto');
  }

  return {
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    syncedAt: new Date().toLocaleTimeString('es-PE'),
  };
}

/**
 * Reads transactions from the 'Transacciones' sheet in Google Sheets.
 */
export async function fetchTransactionsFromGoogleSheets(
  accessToken: string,
  spreadsheetId: string
): Promise<TransactionRecord[]> {
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transacciones!A2:K1000`;
  const res = await fetch(getUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    return [];
  }

  const data = await res.json();
  const rows: string[][] = data.values || [];
  const items: TransactionRecord[] = [];

  for (const row of rows) {
    if (!row || row.length < 2) continue;
    const [id, fecha, tipo, montoTotalStr, metodo, cuotasStr, cuotaMensualStr, alerta, dineroLibre, detalle, mensaje] = row;
    if (!id || !fecha) continue;

    const parseNum = (val: string) => {
      if (!val) return 0;
      const clean = val.replace(/[^0-9.,-]/g, '').replace(',', '.');
      return parseFloat(clean) || 0;
    };

    items.push({
      id: String(id),
      fecha: String(fecha),
      tipo_operacion: (tipo === 'INGRESO' ? 'INGRESO' : 'GASTO') as any,
      monto_total: parseNum(montoTotalStr),
      metodo_pago: (metodo as any) || 'DEBITO',
      cuotas: parseInt(cuotasStr || '1', 10) || 1,
      monto_cuota_mensual: parseNum(cuotaMensualStr),
      items: [
        {
          concepto: detalle || 'Sincronizado desde Google Sheets',
          monto: parseNum(montoTotalStr),
          categoria_principal: tipo === 'INGRESO' ? 'Ingresos' : 'Variables',
          subcategoria: 'Google Sheets',
        },
      ],
      alerta_ahorro_comprometido: alerta?.includes('SÍ') || false,
      dinero_libre_restante: parseNum(dineroLibre),
      mensaje_usuario: mensaje || 'Sincronizado desde Google Sheets',
      titulo_resumen: detalle || 'Transacción de Sheets',
      estado_pago: 'PAGADO',
    });
  }

  return items;
}

