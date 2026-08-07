import { TransactionRecord, BudgetSummary, BudgetConfig } from '../types';

export interface GoogleDriveSyncResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  syncedAt: string;
}

export interface ImportedDriveData {
  transactions: TransactionRecord[];
  config?: Partial<BudgetConfig>;
  categoryBudgets?: Record<string, number>;
}

/**
  * Searches for an existing Google Sheet by name in Google Drive, or creates a new one.
  */
export async function getOrCreateFinancialSpreadsheet(
  accessToken: string,
  title: string = 'Control Financiero Personal'
): Promise<{ id: string; url: string; isNew: boolean }> {
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
      isNew: false,
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
      {
        properties: {
          title: '_DataBackup',
          hidden: true,
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
    isNew: true,
  };
}

/**
 * Ensures a specific sheet/tab exists in the Google Sheet.
 */
async function ensureBackupSheetExists(accessToken: string, spreadsheetId: string): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: '_DataBackup',
                hidden: true,
              },
            },
          },
        ],
      }),
    });
  } catch {
    // Sheet might already exist
  }
}

/**
 * Reads existing transactions and state from Google Sheets.
 * Attempts to read lossless _DataBackup JSON first, and falls back to parsing rows from 'Transacciones'.
 */
export async function readDataFromGoogleSheets(
  accessToken: string,
  spreadsheetId: string
): Promise<ImportedDriveData | null> {
  // 1. Try reading _DataBackup tab
  try {
    const backupUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_DataBackup!A1`;
    const backupRes = await fetch(backupUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (backupRes.ok) {
      const backupData = await backupRes.json();
      const rawJson = backupData.values?.[0]?.[0];
      if (rawJson) {
        const parsed = JSON.parse(rawJson);
        if (parsed.transactions && Array.isArray(parsed.transactions) && parsed.transactions.length > 0) {
          return {
            transactions: parsed.transactions,
            config: parsed.config,
            categoryBudgets: parsed.categoryBudgets,
          };
        }
      }
    }
  } catch (err) {
    console.warn('No se pudo leer _DataBackup tab, intentando parsear filas de Transacciones:', err);
  }

  // 2. Fallback: Parse rows from 'Transacciones' sheet
  try {
    const txUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transacciones!A2:Z1000`;
    const txRes = await fetch(txUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!txRes.ok) return null;

    const data = await txRes.json();
    const rows: string[][] = data.values || [];
    if (rows.length === 0) return null;

    const transactions: TransactionRecord[] = rows
      .filter((row) => row && row.length >= 4 && row[0])
      .map((row) => {
        const id = row[0] || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const fecha = row[1] || new Date().toISOString().substring(0, 10);
        const tipo_operacion = (row[2] || '').toUpperCase().includes('INGRESO') ? 'INGRESO' : 'GASTO';
        const monto_total = parseFloat((row[3] || '0').replace(/[^0-9.-]/g, '')) || 0;
        const rawMetodo = (row[4] || 'EFECTIVO').toUpperCase().trim();
        const metodo_pago: 'EFECTIVO' | 'DEBITO' | 'CREDITO' =
          rawMetodo.includes('CREDITO') ? 'CREDITO' :
          rawMetodo.includes('DEBITO') ? 'DEBITO' : 'EFECTIVO';

        const cuotas = parseInt(row[5] || '1', 10) || 1;
        const monto_cuota_mensual = parseFloat((row[6] || '0').replace(/[^0-9.-]/g, '')) || (cuotas > 0 ? monto_total / cuotas : monto_total);
        const alerta_ahorro_comprometido = (row[7] || '').toUpperCase().includes('SÍ') || (row[7] || '').toUpperCase().includes('SI');
        const dinero_libre_restante = parseFloat((row[8] || '0').replace(/[^0-9.-]/g, '')) || 0;
        const detailStr = row[9] || '';
        const mensaje_usuario = row[10] || 'Transacción recuperada de Google Drive.';

        // Parse items from detail string
        let items = [{ concepto: detailStr || 'Operación', monto: monto_total, categoria_principal: 'Alimentación y Dieta', subcategoria: 'General' }];
        if (detailStr && detailStr.includes(' | ')) {
          const splitParts = detailStr.split(' | ');
          items = splitParts.map((p) => {
            const match = p.match(/^(.*?)\s*\((.*?):\s*S\/\.\s*([\d.]+)\)$/);
            if (match) {
              return {
                concepto: match[1].trim() || 'Ítem',
                categoria_principal: match[2].trim() || 'Alimentación y Dieta',
                subcategoria: 'General',
                monto: parseFloat(match[3]) || 0,
              };
            }
            return { concepto: p.trim(), monto: monto_total / splitParts.length, categoria_principal: 'Alimentación y Dieta', subcategoria: 'General' };
          });
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
          frecuencia_recurrencia: 'PUNTUAL',
        };
      });

    return transactions.length > 0 ? { transactions } : null;
  } catch (err) {
    console.error('Error al parsear transacciones de Google Sheets:', err);
    return null;
  }
}

/**
 * Syncs transaction history and financial health summary into the Google Sheet.
 */
export async function syncDataToGoogleSheets(
  accessToken: string,
  spreadsheetId: string,
  transactions: TransactionRecord[],
  summary: BudgetSummary,
  monedaSimbolo: string,
  extraBackupData?: { config?: BudgetConfig; categoryBudgets?: Record<string, number> }
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

  // Save lossless JSON backup in _DataBackup tab
  try {
    await ensureBackupSheetExists(accessToken, spreadsheetId);
    const backupJson = JSON.stringify({
      transactions,
      summary,
      config: extraBackupData?.config,
      categoryBudgets: extraBackupData?.categoryBudgets,
      updatedAt: new Date().toISOString(),
    });

    const backupUpdateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/_DataBackup!A1?valueInputOption=RAW`;
    await fetch(backupUpdateUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: '_DataBackup!A1',
        majorDimension: 'ROWS',
        values: [[backupJson]],
      }),
    });
  } catch (backupErr) {
    console.warn('Sincronización de respaldo _DataBackup:', backupErr);
  }

  return {
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    syncedAt: new Date().toLocaleTimeString('es-PE'),
  };
}

