/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import {
  TransactionRecord,
  TransactionItem,
  BudgetConfig,
  BudgetSummary,
} from './types';
import { HeaderBudgetSummary } from './components/HeaderBudgetSummary';
import { GoogleDriveSyncHeader } from './components/GoogleDriveSyncHeader';
import { TransactionInputSection } from './components/TransactionInputSection';
import { TransactionsList } from './components/TransactionsList';
import { FutureInstallmentsProjection } from './components/FutureInstallmentsProjection';
import { FinancialAnalyticsChart } from './components/FinancialAnalyticsChart';
import { BudgetSettingsModal } from './components/BudgetSettingsModal';
import { UpcomingDueDateReminderBanner } from './components/UpcomingDueDateReminderBanner';
import { CategoryBudgetsPage } from './components/CategoryBudgetsPage';
import {
  initAuth,
  googleSignIn,
  logoutGoogle,
  getStoredAuthData,
  getValidGoogleAccessToken,
  refreshGoogleTokenInteractive,
  requestGisTokenSilently,
} from './lib/googleAuth';
import {
  getLatestFixedExpenses,
  getRecurringConceptKey,
  areSameRecurringConcept,
  getTransactionDueDay,
  isUpcomingDueDateAlert,
  isSalaryIncomeTransaction,
  getActiveInstallmentForMonth,
  computeMonthCarryoverBalance,
  normalizeDateToISO,
} from './lib/financial';
import {
  getOrCreateFinancialSpreadsheet,
  syncDataToGoogleSheets,
  readDataFromGoogleSheets,
} from './lib/googleDriveSync';
import {
  Home,
  ListOrdered,
  CreditCard,
  PieChart as PieIcon,
  CheckCircle2,
  Calendar,
  X,
  ArrowRight,
  Clock,
  Sparkles,
  ChevronRight,
  Filter,
  Target,
  RefreshCw,
} from 'lucide-react';

const DEFAULT_CATEGORY_BUDGETS: Record<string, number> = {
  alimentacion: 500,
  gastos_hormiga: 100,
  vehiculo: 300,
  servicios_fijos: 1000,
  hogar_mantenimiento: 200,
  ocio_salidas: 300,
  credito_compromisos: 500,
};

const INITIAL_CONFIG: BudgetConfig = {
  ingresoMensual: 5000,
  porcentajeAhorroMeta: 10,
  monedaSimbolo: 'S/.',
};

const SAMPLE_TRANSACTIONS: TransactionRecord[] = [
  {
    id: 'tx-1',
    fecha: new Date().toISOString().split('T')[0],
    tipo_operacion: 'INGRESO',
    monto_total: 2500.0,
    metodo_pago: 'DEBITO',
    cuotas: 1,
    monto_cuota_mensual: 2500.0,
    items: [
      {
        concepto: 'Sueldo Parcial (Adelanto 50% Quincena)',
        monto: 2500.0,
        categoria_principal: 'Ingresos',
        subcategoria: 'Adelanto de sueldo quincenal',
      },
    ],
    alerta_ahorro_comprometido: false,
    dinero_libre_restante: 2000.0,
    mensaje_usuario:
      '¡Excelente! Se ha abonado un ingreso parcial de S/. 2,500.00 (50% de tu sueldo mensual). Tu saldo en cuenta y dinero libre se han actualizado.',
  },
  {
    id: 'tx-2',
    fecha: new Date().toISOString().split('T')[0],
    tipo_operacion: 'GASTO',
    monto_total: 1200.0,
    metodo_pago: 'DEBITO',
    cuotas: 1,
    monto_cuota_mensual: 1200.0,
    items: [
      {
        concepto: 'Alquiler de Departamento',
        monto: 1200.0,
        categoria_principal: 'Servicios y Gastos Fijos',
        subcategoria: 'Alquiler de departamento',
      },
    ],
    alerta_ahorro_comprometido: false,
    dinero_libre_restante: 800.0,
    mensaje_usuario:
      'Se registró el pago fijo de alquiler de S/. 1,200.00 retirado de tu cuenta bancaria.',
    es_gasto_fijo: true,
    frecuencia_recurrencia: 'MENSUAL',
  },
  {
    id: 'tx-3',
    fecha: new Date().toISOString().split('T')[0],
    tipo_operacion: 'GASTO',
    monto_total: 145.0,
    metodo_pago: 'DEBITO',
    cuotas: 1,
    monto_cuota_mensual: 145.0,
    items: [
      {
        concepto: 'Recibo de Luz (Enel)',
        monto: 145.0,
        categoria_principal: 'Servicios y Gastos Fijos',
        subcategoria: 'Luz / Electricidad',
      },
    ],
    alerta_ahorro_comprometido: false,
    dinero_libre_restante: 520.0,
    mensaje_usuario:
      'Compromiso de servicio de luz registrado como pendiente de pago para el día 12 del mes (próximo a vencer).',
    es_gasto_fijo: true,
    frecuencia_recurrencia: 'MENSUAL',
    estado_pago: 'PENDIENTE',
    dia_pago_mensual: 12,
    comercio: 'Enel',
    titulo_resumen: 'Recibo de Luz',
  },
  {
    id: 'tx-4',
    fecha: new Date().toISOString().split('T')[0],
    tipo_operacion: 'GASTO',
    monto_total: 900.0,
    metodo_pago: 'CREDITO',
    cuotas: 3,
    monto_cuota_mensual: 300.0,
    items: [
      {
        concepto: 'Laptop de trabajo diferida',
        monto: 900.0,
        categoria_principal: 'Crédito y Compromisos',
        subcategoria: 'Compras diferidas en cuotas',
      },
    ],
    alerta_ahorro_comprometido: false,
    dinero_libre_restante: 220.0,
    mensaje_usuario:
      'Se procesó tu compra diferida de S/. 900.00 a 3 cuotas. Para este mes se considera la primera cuota de S/. 300.00.',
    es_gasto_fijo: false,
    frecuencia_recurrencia: 'PUNTUAL',
  },
  {
    id: 'tx-5',
    fecha: new Date().toISOString().split('T')[0],
    tipo_operacion: 'GASTO',
    monto_total: 180.0,
    metodo_pago: 'EFECTIVO',
    cuotas: 1,
    monto_cuota_mensual: 180.0,
    items: [
      {
        concepto: 'Pechuga de pollo, claras y avena para dieta',
        monto: 180.0,
        categoria_principal: 'Alimentación y Dieta',
        subcategoria: 'Supermercado y Dieta estructurada',
      },
    ],
    alerta_ahorro_comprometido: false,
    dinero_libre_restante: 40.0,
    mensaje_usuario:
      'Compra de supermercado clasificada exitosamente en Alimentación y Dieta por S/. 180.00.',
    comercio: 'Plaza Vea',
    titulo_resumen: 'Plaza Vea',
    es_gasto_fijo: false,
    frecuencia_recurrencia: 'PUNTUAL',
  },
];

const sanitizeTransactions = (txs: TransactionRecord[]): TransactionRecord[] => {
  if (!Array.isArray(txs)) return [];
  const seenIds = new Set<string>();

  const rawList = txs.map((tx, idx) => {
    // Guarantee every transaction has a distinct, valid ID (handles duplicates from Sheets or imports)
    let uniqueId = tx.id && typeof tx.id === 'string' && tx.id.trim() !== '' ? tx.id.trim() : `tx-${Date.now()}-${idx}`;
    if (seenIds.has(uniqueId)) {
      uniqueId = `${uniqueId}-dup-${idx}`;
    }
    seenIds.add(uniqueId);

    // 1. Strictly normalize date into ISO format (YYYY-MM-DD)
    const normalizedFecha = normalizeDateToISO(tx.fecha);

    const titleAndConcept = (
      (tx.titulo_resumen || '') +
      ' ' +
      (tx.items?.[0]?.concepto || '') +
      ' ' +
      (tx.items?.[0]?.subcategoria || '')
    ).toLowerCase();

    const fullText = (
      (tx.titulo_resumen || '') +
      ' ' +
      (tx.comercio || '') +
      ' ' +
      (tx.items || []).map((i) => `${i.concepto} ${i.subcategoria || ''} ${i.categoria_principal || ''}`).join(' ')
    ).toLowerCase();

    // 2. CRITICAL PURGE: Detect food, groceries, vegetables, dining, plants, home decor, clothing, tools
    // These must NEVER be recurring fixed expenses under any circumstance.
    const isVariableOrCasualItem =
      fullText.includes('camote') ||
      fullText.includes('papa') ||
      fullText.includes('verdura') ||
      fullText.includes('fruta') ||
      fullText.includes('carne') ||
      fullText.includes('pollo') ||
      fullText.includes('comida') ||
      fullText.includes('almuerzo') ||
      fullText.includes('cena') ||
      fullText.includes('menu') ||
      fullText.includes('menú') ||
      fullText.includes('supermercado') ||
      fullText.includes('mercado') ||
      fullText.includes('abarrotes') ||
      fullText.includes('víveres') ||
      fullText.includes('viveres') ||
      fullText.includes('planta') ||
      fullText.includes('maceta') ||
      fullText.includes('decoracion') ||
      fullText.includes('decoración') ||
      fullText.includes('mueble') ||
      fullText.includes('ferreteria') ||
      fullText.includes('ferretería') ||
      fullText.includes('herramienta') ||
      fullText.includes('ropa') ||
      fullText.includes('zapatilla') ||
      fullText.includes('gasolina') ||
      fullText.includes('combustible');

    // 2. STRICT USER / EXPLICIT SETTING: If explicitly marked as one-time / punctual or NOT fixed, preserve it strictly!
    if (tx.es_gasto_fijo === false || tx.frecuencia_recurrencia === 'PUNTUAL') {
      return {
        ...tx,
        id: uniqueId,
        fecha: normalizedFecha,
        es_gasto_fijo: false,
        frecuencia_recurrencia: 'PUNTUAL' as const,
        dia_pago_mensual: undefined,
      };
    }

    // 3. STRICT USER / EXPLICIT SETTING: If explicitly marked as fixed recurring monthly
    if (tx.es_gasto_fijo === true || tx.frecuencia_recurrencia === 'MENSUAL') {
      return {
        ...tx,
        id: uniqueId,
        fecha: normalizedFecha,
        es_gasto_fijo: true,
        frecuencia_recurrencia: 'MENSUAL' as const,
        dia_pago_mensual: tx.dia_pago_mensual || getTransactionDueDay({ ...tx, fecha: normalizedFecha }),
      };
    }

    // 4. Default keyword heuristics for new unclassified transactions
    if (isVariableOrCasualItem) {
      return {
        ...tx,
        id: uniqueId,
        fecha: normalizedFecha,
        es_gasto_fijo: false,
        frecuencia_recurrencia: 'PUNTUAL' as const,
        dia_pago_mensual: undefined,
      };
    }

    // Recognize genuine recurring fixed utility contracts (gym, rent, electricity, water, internet, gas, etc.)
    const isGym =
      titleAndConcept.includes('gym') ||
      titleAndConcept.includes('gimnas') ||
      titleAndConcept.includes('giman') ||
      titleAndConcept.includes('smartfit') ||
      titleAndConcept.includes('smart fit') ||
      titleAndConcept.includes('smart-fit') ||
      titleAndConcept.includes('fitness') ||
      titleAndConcept.includes('bodytech') ||
      titleAndConcept.includes('planet fitness') ||
      titleAndConcept.includes('golds gym') ||
      titleAndConcept.includes("gold's gym") ||
      titleAndConcept.includes('crossfit') ||
      titleAndConcept.includes('calistenia') ||
      titleAndConcept.includes('entrenamiento') ||
      (titleAndConcept.includes('membres') &&
        !titleAndConcept.includes('costco') &&
        !titleAndConcept.includes('sam'));

    const isFixedContract =
      isGym ||
      /\balquiler\b/i.test(titleAndConcept) ||
      /\brenta\b/i.test(titleAndConcept) ||
      (/\bdepartamento\b/i.test(titleAndConcept) && !titleAndConcept.includes('planta')) ||
      /\bdepa\b/i.test(titleAndConcept) ||
      titleAndConcept.includes('internet') ||
      titleAndConcept.includes('calidda') ||
      titleAndConcept.includes('cálidda') ||
      titleAndConcept.includes('servicio de gas') ||
      titleAndConcept.includes('recibo de gas') ||
      titleAndConcept.includes('balon de gas') ||
      titleAndConcept.includes('balón de gas') ||
      (/\bgas\b/i.test(titleAndConcept) && !titleAndConcept.includes('gasto') && !titleAndConcept.includes('gastron') && !titleAndConcept.includes('gasfitero')) ||
      /\bluz\b/i.test(titleAndConcept) ||
      /\bagua\b/i.test(titleAndConcept) ||
      titleAndConcept.includes('sedapal') ||
      titleAndConcept.includes('enel') ||
      titleAndConcept.includes('luz del sur') ||
      titleAndConcept.includes('netflix') ||
      titleAndConcept.includes('spotify') ||
      titleAndConcept.includes('paramount') ||
      titleAndConcept.includes('icloud') ||
      titleAndConcept.includes('prime') ||
      titleAndConcept.includes('disney') ||
      titleAndConcept.includes('hbo') ||
      /\bmax\b/i.test(titleAndConcept) ||
      titleAndConcept.includes('colegio') ||
      titleAndConcept.includes('escuela') ||
      titleAndConcept.includes('universidad') ||
      titleAndConcept.includes('pension') ||
      titleAndConcept.includes('pensión') ||
      titleAndConcept.includes('seguro') ||
      titleAndConcept.includes('arbitrios') ||
      titleAndConcept.includes('cochera') ||
      titleAndConcept.includes('estacionamiento');

    if (tx.tipo_operacion === 'GASTO' && isFixedContract && (tx.cuotas <= 1 || !tx.cuotas)) {
      return {
        ...tx,
        id: uniqueId,
        fecha: normalizedFecha,
        es_gasto_fijo: true,
        frecuencia_recurrencia: 'MENSUAL' as const,
        dia_pago_mensual: getTransactionDueDay({ ...tx, fecha: normalizedFecha }),
      };
    }

    return {
      ...tx,
      id: uniqueId,
      fecha: normalizedFecha,
      es_gasto_fijo: false,
      frecuencia_recurrencia: 'PUNTUAL' as const,
    };
  });

  // 5. Reconcile recurring commitments: if a recurring concept was paid in a month,
  // reconcile any pending placeholder for that same concept in that same month so it shows as paid
  const paidRecurringConceptsByMonth = new Set<string>();
  rawList.forEach((tx) => {
    if (tx.tipo_operacion === 'GASTO' && tx.estado_pago !== 'PENDIENTE') {
      const monthKey = normalizeDateToISO(tx.fecha).slice(0, 7);
      const conceptKey = getRecurringConceptKey(tx);
      if (conceptKey) {
        paidRecurringConceptsByMonth.add(`${monthKey}::${conceptKey}`);
      }
    }
  });

  const reconciledList = rawList.map((tx) => {
    if (tx.tipo_operacion === 'GASTO' && tx.estado_pago === 'PENDIENTE') {
      const monthKey = normalizeDateToISO(tx.fecha).slice(0, 7);
      const conceptKey = getRecurringConceptKey(tx);
      if (conceptKey && paidRecurringConceptsByMonth.has(`${monthKey}::${conceptKey}`)) {
        return {
          ...tx,
          estado_pago: 'PAGADO' as const,
          dia_pago_mensual: getTransactionDueDay(tx),
        };
      }
    }
    return tx;
  });

  return reconciledList;
};

const sortTransactionsByDateDesc = (txs: TransactionRecord[]): TransactionRecord[] => {
  const sanitized = sanitizeTransactions(txs);
  return [...sanitized].sort((a, b) => {
    const dateComp = (b.fecha || '').localeCompare(a.fecha || '');
    if (dateComp !== 0) return dateComp;
    return (b.id || '').localeCompare(a.id || '');
  });
};

export default function App() {
  // Load initial states from localStorage if present
  const [config, setConfig] = useState<BudgetConfig>(() => {
    const saved = localStorage.getItem('asistente_financiero_config');
    return saved ? JSON.parse(saved) : INITIAL_CONFIG;
  });

  const [transactions, setTransactions] = useState<TransactionRecord[]>(() => {
    const saved = localStorage.getItem('asistente_financiero_txs');
    const rawList = saved ? JSON.parse(saved) : SAMPLE_TRANSACTIONS;
    return sortTransactionsByDateDesc(rawList);
  });

  const [lastTransaction, setLastTransaction] = useState<TransactionRecord | null>(
    SAMPLE_TRANSACTIONS[SAMPLE_TRANSACTIONS.length - 1] || null
  );

  const [successNotification, setSuccessNotification] = useState<{
    titulo: string;
    mensaje: string;
    monto: number;
    tipo: 'INGRESO' | 'GASTO';
    esGastoFijo?: boolean;
    estadoPago?: 'PAGADO' | 'PENDIENTE';
    diaPago?: number;
    processedBy?: 'gemini_ai' | 'fallback_heuristic';
    modelUsed?: string;
    fallbackReason?: string;
    driveSynced?: boolean;
  } | null>(null);

  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [healthStatus, setHealthStatus] = useState<{
    status: string;
    hasApiKey: boolean;
    environment: string;
    time: string;
  } | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const checkHealthEndpoint = async () => {
    setIsCheckingHealth(true);
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealthStatus(data);
    } catch (err) {
      setHealthStatus({
        status: 'error',
        hasApiKey: false,
        environment: 'Desconocido (No se pudo conectar a /api/health)',
        time: new Date().toISOString(),
      });
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'inicio' | 'presupuestos' | 'historial' | 'proyeccion' | 'graficos'>('inicio');

  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('asistente_financiero_category_budgets');
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORY_BUDGETS;
  });

  useEffect(() => {
    localStorage.setItem('asistente_financiero_category_budgets', JSON.stringify(categoryBudgets));
  }, [categoryBudgets]);

  // Google Drive & Sheets Integration State - Persist user account across days!
  const [googleUser, setGoogleUser] = useState<User | any | null>(() => {
    const stored = getStoredAuthData();
    return stored.user || null;
  });
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    const stored = getStoredAuthData();
    return stored.token || null;
  });
  const [isDriveSyncing, setIsDriveSyncing] = useState(false);
  const [lastDriveSyncedAt, setLastDriveSyncedAt] = useState<string | null>(() => {
    return localStorage.getItem('asistente_financiero_last_sync');
  });
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(() => {
    return localStorage.getItem('asistente_financiero_sheet_url');
  });
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => {
    return localStorage.getItem('asistente_financiero_sheet_id');
  });
  const [tokenNeedsRefresh, setTokenNeedsRefresh] = useState<boolean>(false);

  // Automatic saving tracking refs to ensure seamless background sync on each record
  const isInitialMountRef = useRef(true);
  const skipNextAutoSyncRef = useRef(false);
  const autoSyncDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncingRef = useRef(false);
  const pendingSyncTxsRef = useRef<TransactionRecord[] | null>(null);

  // Initialize Auth state: keep user account connected across days
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        if (token) setAccessToken(token);
      },
      () => {
        // Only called when the user deliberately logs out
        setGoogleUser(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setAccessToken(res.accessToken);

        // Check if existing file has transactions in Google Drive
        const fileInfo = await getOrCreateFinancialSpreadsheet(res.accessToken, 'Control Financiero Personal');
        setSpreadsheetId(fileInfo.id);
        setSpreadsheetUrl(fileInfo.url);
        localStorage.setItem('asistente_financiero_sheet_id', fileInfo.id);
        localStorage.setItem('asistente_financiero_sheet_url', fileInfo.url);

        if (!fileInfo.isNew) {
          // Spreadsheet existed! Attempt to load data from Drive first
          const driveData = await readDataFromGoogleSheets(res.accessToken, fileInfo.id);
          if (driveData && driveData.transactions && driveData.transactions.length > 0) {
            skipNextAutoSyncRef.current = true;
            const sorted = sortTransactionsByDateDesc(driveData.transactions);
            setTransactions(sorted);
            localStorage.setItem('asistente_financiero_txs', JSON.stringify(sorted));

            if (driveData.config) setConfig((prev) => ({ ...prev, ...driveData.config }));
            if (driveData.categoryBudgets) setCategoryBudgets(driveData.categoryBudgets);

            const nowFormatted = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            setLastDriveSyncedAt(nowFormatted);
            localStorage.setItem('asistente_financiero_last_sync', nowFormatted);
            setTokenNeedsRefresh(false);

            alert(`✅ ¡Google Drive conectado! Se recuperaron ${sorted.length} transacciones sincronizadas previamente.`);
            return;
          }
        }

        setTokenNeedsRefresh(false);
        // If new or empty sheet, push local transactions to Drive
        triggerDriveSync(res.accessToken, transactions);
      }
    } catch (err: any) {
      console.warn('Inicio de sesión de Google cancelado o fallido:', err);
      const errMsg = String(err?.message || err?.code || err || '');
      if (
        !errMsg.includes('popup-closed-by-user') &&
        !errMsg.includes('cancelled-popup-request') &&
        !errMsg.includes('Database is closing')
      ) {
        alert(`⚠️ No se pudo conectar con Google: ${errMsg}\n\nSi estás en un navegador privado o iframe, intenta permitir ventanas emergentes o volver a hacer clic en Conectar.`);
      }
    }
  };

  const handleImportFromDrive = async (tokenToUse?: string | null) => {
    const confirmLoad = window.confirm(
      '⚠️ ATENCIÓN: Cargar datos desde Google Drive restaurará la última copia de respaldo guardada en la nube y reemplazará tus registros locales actuales.\n\n' +
      '¿Deseas continuar?\n\n' +
      '💡 Importante: Si has registrado o editado compras recientemente, te recomendamos hacer clic en "Cancelar" y presionar primero "Guardar" para actualizar tu respaldo en la nube.'
    );
    if (!confirmLoad) return;

    let activeToken = tokenToUse || (await getValidGoogleAccessToken()) || accessToken;
    if (!activeToken && googleUser) {
      activeToken = await refreshGoogleTokenInteractive(googleUser.email);
      if (activeToken) setAccessToken(activeToken);
    }
    if (!activeToken) {
      await handleGoogleLogin();
      return;
    }
    setTokenNeedsRefresh(false);

    setIsDriveSyncing(true);
    try {
      const fileInfo = await getOrCreateFinancialSpreadsheet(activeToken, 'Control Financiero Personal');
      if (fileInfo.id) {
        setSpreadsheetId(fileInfo.id);
        setSpreadsheetUrl(fileInfo.url);
        localStorage.setItem('asistente_financiero_sheet_id', fileInfo.id);
        localStorage.setItem('asistente_financiero_sheet_url', fileInfo.url);
      }

      const importedData = await readDataFromGoogleSheets(activeToken, fileInfo.id || spreadsheetId || '');
      if (importedData && importedData.transactions && importedData.transactions.length > 0) {
        skipNextAutoSyncRef.current = true;
        const sorted = sortTransactionsByDateDesc(importedData.transactions);
        setTransactions(sorted);
        localStorage.setItem('asistente_financiero_txs', JSON.stringify(sorted));

        if (importedData.config) {
          setConfig((prev) => ({ ...prev, ...importedData.config }));
        }
        if (importedData.categoryBudgets) {
          setCategoryBudgets(importedData.categoryBudgets);
        }

        const nowFormatted = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastDriveSyncedAt(nowFormatted);
        localStorage.setItem('asistente_financiero_last_sync', nowFormatted);

        alert(`✅ Carga exitosa: Se importaron ${sorted.length} transacciones desde tu Google Drive.`);
      } else {
        alert('ℹ️ No se encontraron transacciones guardadas en tu planilla de Google Drive.');
      }
    } catch (err: any) {
      console.error('Error al importar desde Google Drive:', err);
      const errMsg = String(err?.message || err || '');
      if (errMsg.includes('401') || errMsg.includes('UNAUTHENTICATED')) {
        const freshToken = await refreshGoogleTokenInteractive(googleUser?.email);
        if (freshToken) {
          setAccessToken(freshToken);
          handleImportFromDrive(freshToken);
          return;
        }
      }
      alert(`Ocurrió un error al cargar datos desde Google Drive: ${err?.message || 'Error de conexión'}`);
    } finally {
      setIsDriveSyncing(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logoutGoogle();
    setGoogleUser(null);
    setAccessToken(null);
    setSpreadsheetUrl(null);
    setSpreadsheetId(null);
    setLastDriveSyncedAt(null);
    localStorage.removeItem('asistente_financiero_sheet_url');
    localStorage.removeItem('asistente_financiero_sheet_id');
    localStorage.removeItem('asistente_financiero_last_sync');
  };

  const triggerDriveSync = async (
    tokenToUse?: string | null,
    currentTxs?: TransactionRecord[],
    isManual: boolean = false
  ) => {
    const txsToSync = currentTxs || transactions;

    // Queue synchronization if a sync is already running in the background
    if (isSyncingRef.current) {
      pendingSyncTxsRef.current = txsToSync;
      return;
    }

    let activeToken = tokenToUse || (await getValidGoogleAccessToken()) || accessToken;

    if (!activeToken && googleUser) {
      if (isManual) {
        activeToken = await refreshGoogleTokenInteractive(googleUser.email);
        if (activeToken) setAccessToken(activeToken);
      }
    }

    if (!activeToken) {
      if (isManual) {
        await handleGoogleLogin();
      } else {
        setTokenNeedsRefresh(true);
      }
      return;
    }

    isSyncingRef.current = true;
    setIsDriveSyncing(true);
    try {
      let sheetId = spreadsheetId || localStorage.getItem('asistente_financiero_sheet_id') || '';
      let sheetUrl = spreadsheetUrl || localStorage.getItem('asistente_financiero_sheet_url');

      const syncRes = await syncDataToGoogleSheets(
        activeToken,
        sheetId,
        txsToSync,
        budgetSummary,
        config.monedaSimbolo,
        { config, categoryBudgets }
      );

      if (syncRes.spreadsheetId && syncRes.spreadsheetId !== sheetId) {
        setSpreadsheetId(syncRes.spreadsheetId);
        setSpreadsheetUrl(syncRes.spreadsheetUrl);
        localStorage.setItem('asistente_financiero_sheet_id', syncRes.spreadsheetId);
        localStorage.setItem('asistente_financiero_sheet_url', syncRes.spreadsheetUrl);
      }

      const nowFormatted = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastDriveSyncedAt(nowFormatted);
      localStorage.setItem('asistente_financiero_last_sync', nowFormatted);
      setTokenNeedsRefresh(false);

      if (isManual) {
        alert(`✅ Sincronización exitosa con Google Drive a las ${nowFormatted}`);
      }
    } catch (err: any) {
      console.warn('Sincronización con Google Drive:', err?.message || err);
      const msg = String(err?.message || err || '');
      const isAuthError = msg.includes('401') || msg.includes('UNAUTHENTICATED') || msg.includes('authentication credentials');

      if (isAuthError) {
        setTokenNeedsRefresh(true);
        if (isManual) {
          alert('Tu sesión de Google expiró. Se abrirá la ventana para renovarla.');
          await handleGoogleLogin();
        }
      } else if (isManual) {
        alert(`Ocurrió un problema al sincronizar con Google Drive: ${err?.message || 'Error de conexión'}`);
      }
    } finally {
      isSyncingRef.current = false;
      setIsDriveSyncing(false);

      // If pending transactions were queued while busy, trigger next sync
      if (pendingSyncTxsRef.current) {
        const queuedTxs = pendingSyncTxsRef.current;
        pendingSyncTxsRef.current = null;
        triggerDriveSync(null, queuedTxs, false);
      }
    }
  };

  // Save to localStorage on changes
  useEffect(() => {
    localStorage.setItem('asistente_financiero_config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem('asistente_financiero_txs', JSON.stringify(transactions));
  }, [transactions]);

  // Compute live budget summary based on actual cash flows and last paid month value for recurring services
  let ingresosCobradosTotal = 0;
  let ingresosSueldoCobrados = 0;
  let ingresosAdicionalesCobrados = 0;
  let cuotasCredito = 0;
  let cuotasCreditoPendientes = 0;
  let gastosVariables = 0;
  let gastosEjecutadosReal = 0;
  let gastosPendientesTotal = 0;

  const currentMonthStr = new Date().toISOString().slice(0, 7);

  // Compute fixed expenses baseline using the exact value of the last paid month for variable services
  const latestFixedExpensesList = getLatestFixedExpenses(transactions);
  const currentDayNum = new Date().getDate();
  const pendingFixedExpensesCount = latestFixedExpensesList.filter(
    (t) => t.estado_pago === 'PENDIENTE' && isUpcomingDueDateAlert(t, currentDayNum)
  ).length;
  const fixedExpensesIdSet = new Set(latestFixedExpensesList.map((t) => t.id));
  const gastosFijos = latestFixedExpensesList.reduce(
    (sum, t) => sum + (t.monto_total || 0),
    0
  );

  transactions.forEach((tx) => {
    const isoFecha = normalizeDateToISO(tx.fecha);
    const isCurrentMonth = !tx.fecha || isoFecha.startsWith(currentMonthStr);

    if (tx.tipo_operacion === 'INGRESO') {
      if (isCurrentMonth) {
        ingresosCobradosTotal += tx.monto_total;
        if (isSalaryIncomeTransaction(tx)) {
          ingresosSueldoCobrados += tx.monto_total;
        } else {
          ingresosAdicionalesCobrados += tx.monto_total;
        }
      }
    } else if (tx.tipo_operacion === 'GASTO') {
      const esPendiente = tx.estado_pago === 'PENDIENTE';
      const isCreditInstallment =
        tx.metodo_pago === 'CREDITO' && (tx.cuotas > 1 || (tx.cuota_actual && tx.cuota_actual > 1));

      if (isCreditInstallment) {
        const activeInst = getActiveInstallmentForMonth(tx, new Date());
        if (activeInst) {
          cuotasCredito += activeInst.montoCuota;
          if (isCurrentMonth && !esPendiente) {
            gastosEjecutadosReal += activeInst.montoCuota;
          } else {
            gastosPendientesTotal += activeInst.montoCuota;
            cuotasCreditoPendientes += activeInst.montoCuota;
          }
        }
      } else {
        // Variable non-fixed expense (e.g. supermarket, dining out)
        if (isCurrentMonth && !fixedExpensesIdSet.has(tx.id)) {
          gastosVariables += tx.monto_total;
        }

        if (esPendiente) {
          gastosPendientesTotal += tx.monto_total;
        } else if (isCurrentMonth) {
          gastosEjecutadosReal += tx.monto_total;
        }
      }
    }
  });

  // Calculate fixed expenses paid in the current month to avoid double counting
  const gastosFijosPagadosEsteMes = transactions
    .filter(
      (t) =>
        t.tipo_operacion === 'GASTO' &&
        (t.es_gasto_fijo || fixedExpensesIdSet.has(t.id)) &&
        t.estado_pago !== 'PENDIENTE' &&
        normalizeDateToISO(t.fecha).startsWith(currentMonthStr)
    )
    .reduce((sum, t) => sum + t.monto_total, 0);

  // Unpaid/remaining fixed expenses for this month
  const gastosFijosPendientesDelMes = Math.max(0, gastosFijos - gastosFijosPagadosEsteMes);

  // Base salary remaining to be collected (does NOT decrease when additional extra incomes are received)
  const montoPendienteCobrar = Math.max(0, config.ingresoMensual - ingresosSueldoCobrados);

  // Total projected income for this month: Base expected salary + all extra/additional incomes
  const ingresoBaseEfectivo = Math.max(config.ingresoMensual, ingresosSueldoCobrados);
  const ingresoTotalProyectadoMes = ingresoBaseEfectivo + ingresosAdicionalesCobrados;

  // Effective income baseline for 10% protected savings (covers base salary + extra incomes)
  const metaAhorroMonto = (ingresoTotalProyectadoMes * config.porcentajeAhorroMeta) / 100;

  // Projected total = Gastos al momento (gastosEjecutadosReal) + Compromisos pendientes de pago por vencer este mes
  // Eliminates duplication: already paid fixed expenses are only counted once in gastosEjecutadosReal.
  const compromisosPendientesFinDeMes = Math.max(
    gastosPendientesTotal,
    gastosFijosPendientesDelMes + cuotasCreditoPendientes
  );
  const gastosTotalesProyectados = gastosEjecutadosReal + compromisosPendientesFinDeMes;
  // Historical rollover free money (saldo inicial arrastrado) from all previous closed months
  const { saldoInicialArrastrado } = computeMonthCarryoverBalance(
    transactions,
    currentMonthStr,
    config.ingresoMensual,
    config.porcentajeAhorroMeta
  );

  // Actual money in bank account = total income minus actual executed payments
  const saldoBancoReal = ingresosCobradosTotal - gastosEjecutadosReal;
  // Free money generated strictly within the current month
  const dineroLibreMesActual = saldoBancoReal - metaAhorroMonto;
  // Total available free money including rollover from previous months
  const dineroLibreDisponible = dineroLibreMesActual + saldoInicialArrastrado;
  const alertaAhorroComprometido = dineroLibreDisponible < 0;

  const porcentajeCobrado = Math.min(
    100,
    Math.round((ingresosCobradosTotal / Math.max(1, ingresoTotalProyectadoMes)) * 100)
  );

  const budgetSummary: BudgetSummary = {
    ingresoMensual: config.ingresoMensual,
    ingresosSueldoCobrados,
    ingresosAdicionalesCobrados,
    ingresosCobradosTotal,
    ingresoTotalProyectadoMes,
    montoPendienteCobrar,
    porcentajeCobrado,
    metaAhorroMonto,
    gastosTotalesProyectados,
    gastosEjecutadosReal,
    gastosPendientesTotal,
    gastosFijos,
    cuotasCredito,
    cuotasCreditoPendientes,
    gastosVariables,
    saldoBancoReal,
    dineroLibreDisponible,
    saldoInicialMesAnterior: saldoInicialArrastrado,
    dineroLibreMesActual,
    alertaAhorroComprometido,
  };

  // Guardado automático continuo tras cada registro, modificación o eliminación
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    if (skipNextAutoSyncRef.current) {
      skipNextAutoSyncRef.current = false;
      return;
    }

    const hasDriveConnection = Boolean(
      googleUser ||
      accessToken ||
      spreadsheetId ||
      localStorage.getItem('asistente_financiero_sheet_id') ||
      localStorage.getItem('asistente_financiero_google_token')
    );

    if (!hasDriveConnection) return;

    if (autoSyncDebounceTimerRef.current) {
      clearTimeout(autoSyncDebounceTimerRef.current);
    }

    autoSyncDebounceTimerRef.current = setTimeout(() => {
      triggerDriveSync(null, transactions, false);
    }, 600);

    return () => {
      if (autoSyncDebounceTimerRef.current) {
        clearTimeout(autoSyncDebounceTimerRef.current);
      }
    };
  }, [transactions, config, categoryBudgets]);

  // Handle Process Financial Operation with Gemini API
  const handleProcessFinancial = async (params: {
    inputMode: 'text' | 'voice' | 'image';
    textPrompt?: string;
    audioBase64?: string;
    audioMimeType?: string;
    imageBase64?: string;
    imageMimeType?: string;
  }) => {
    setIsProcessing(true);
    try {
      // Optimize prompt sent to Gemini API to clearly distinguish between punctual and fixed expenses
      const classificationInstruction = `\n\n[INSTRUCCIÓN CRÍTICA DE CLASIFICACIÓN DE GASTO FIJO VS PUNTUAL:
Diferencia de manera estricta entre gastos puntuales y gastos fijos. No categorices automáticamente un gasto como 'fijo' basándote únicamente en nombres o palabras similares:
- GASTO PUNTUAL O CASUAL (es_gasto_fijo: false, frecuencia_recurrencia: "PUNTUAL"): Incluye compras de gasolina o combustible, reparaciones de lavadoras o electrodomésticos, arreglos mecánicos, repuestos, compras de comida, víveres o salidas. JAMÁS los clasifiques como gastos fijos.
- GASTO FIJO MENSUAL (es_gasto_fijo: true, frecuencia_recurrencia: "MENSUAL"): Reservado ÚNICAMENTE para contratos o servicios periódicos obligatorios que vencen un día fijo todos los meses (alquiler de vivienda, recibo de luz, recibo de agua, internet, plan celular mensual, pensiones de colegio o suscripciones digitales).]`;

      const enhancedPrompt = params.textPrompt
        ? `${params.textPrompt.trim()}${classificationInstruction}`
        : params.textPrompt;

      const response = await fetch('/api/process-financial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...params,
          textPrompt: enhancedPrompt,
          currentBudget: {
            ingresoMensual: config.ingresoMensual,
            ingresosCobrados: ingresosCobradosTotal,
            gastosFijos,
            gastosVariables,
            cuotasCredito,
          },
        }),
      });

      const resData = await response.json();

      if (!resData.success || !resData.data) {
        throw new Error(resData.error || 'Respuesta inválida del servidor AI');
      }

      const parsedData = resData.data;

      const todayStr = new Date().toISOString().split('T')[0];
      const currentYear = new Date().getFullYear();

      // Ensure date is normalized and reasonable (preserve month and day if AI returned an outdated year)
      let validFecha = normalizeDateToISO(parsedData.fecha);
      const dateParts = validFecha.split('-');
      const yearInParsed = parseInt(dateParts[0], 10);
      const promptText = params.textPrompt || '';
      const userExplicitlyRequestedPastYear = promptText.includes(yearInParsed.toString());
      if (isNaN(yearInParsed) || (yearInParsed < currentYear && !userExplicitlyRequestedPastYear)) {
        if (dateParts.length === 3 && dateParts[1] && dateParts[2]) {
          validFecha = `${currentYear}-${dateParts[1]}-${dateParts[2]}`;
        } else {
          validFecha = todayStr;
        }
      }

      const cuotasTotal = parsedData.cuotas || 1;
      const cuotaActual = parsedData.cuota_actual || 1;
      const cuotasRestantes = parsedData.cuotas_restantes ?? Math.max(0, cuotasTotal - cuotaActual);

      let entidad = parsedData.entidad_financiera;
      if (!entidad && (parsedData.metodo_pago === 'CREDITO' || cuotasTotal > 1)) {
        entidad = 'Tarjeta de Crédito';
      }

      let isGastoFijo = parsedData.es_gasto_fijo;
      const itemsList = parsedData.items || [];
      const userPromptLower = (params.textPrompt || '').toLowerCase();
      const allText = (
        userPromptLower +
        ' ' +
        (parsedData.titulo_resumen || '') +
        ' ' +
        itemsList.map((i: any) => `${i.concepto} ${i.subcategoria || ''} ${i.categoria_principal || ''}`).join(' ')
      ).toLowerCase();

      const isCasualExpense =
        allText.includes('gasolina') ||
        allText.includes('combustible') ||
        allText.includes('grifo') ||
        allText.includes('diésel') ||
        allText.includes('diesel') ||
        allText.includes('peaje') ||
        allText.includes('reparacion') ||
        allText.includes('reparación') ||
        allText.includes('arregla') ||
        allText.includes('arreglo') ||
        allText.includes('mecanico') ||
        allText.includes('mecánico') ||
        allText.includes('repuesto') ||
        allText.includes('lavadora') ||
        allText.includes('electrodomestico') ||
        allText.includes('electrodoméstico') ||
        allText.includes('gasfitero') ||
        allText.includes('camote') ||
        allText.includes('papa') ||
        allText.includes('verdura') ||
        allText.includes('fruta') ||
        allText.includes('carne') ||
        allText.includes('pollo') ||
        allText.includes('comida') ||
        allText.includes('almuerzo') ||
        allText.includes('cena') ||
        allText.includes('menu') ||
        allText.includes('menú') ||
        allText.includes('planta') ||
        allText.includes('maceta') ||
        allText.includes('decoracion') ||
        allText.includes('decoración') ||
        allText.includes('mueble') ||
        allText.includes('ferreteria') ||
        allText.includes('ferretería') ||
        allText.includes('herramienta') ||
        allText.includes('ropa') ||
        allText.includes('zapatilla');

      const isCleaningOrGrocery =
        allText.includes('limpieza') ||
        allText.includes('aseo') ||
        allText.includes('detergente') ||
        allText.includes('desinfectante') ||
        allText.includes('jabón') ||
        allText.includes('jabon') ||
        allText.includes('shampoo') ||
        allText.includes('champu') ||
        allText.includes('suavizante') ||
        allText.includes('papel higienico') ||
        allText.includes('supermercado') ||
        allText.includes('abarrotes') ||
        allText.includes('víveres') ||
        allText.includes('viveres');

      const hasFixedKeywords =
        !isCleaningOrGrocery &&
        !isCasualExpense &&
        (allText.includes('alquiler') ||
          (/\bdepartamento\b/i.test(allText) && !allText.includes('planta')) ||
          /\bdepa\b/i.test(allText) ||
          allText.includes('cochera mensual') ||
          allText.includes('mantenimiento de edificio') ||
          allText.includes('mantenimiento del edificio') ||
          allText.includes('mantenimiento de condominio') ||
          allText.includes('recibo de luz') ||
          allText.includes('recibo de agua') ||
          allText.includes('internet') ||
          allText.includes('gas natural') ||
          allText.includes('calidda') ||
          allText.includes('plan movil') ||
          allText.includes('plan celular') ||
          allText.includes('suscripc') ||
          allText.includes('colegio') ||
          allText.includes('pension') ||
          allText.includes('pensión') ||
          allText.includes('gym') ||
          allText.includes('gimnasio') ||
          allText.includes('seguro') ||
          allText.includes('arbitrios') ||
          allText.includes('netflix') ||
          allText.includes('spotify') ||
          allText.includes('icloud') ||
          allText.includes('prime') ||
          allText.includes('disney') ||
          allText.includes('hbo') ||
          allText.includes('paramount') ||
          allText.includes('youtube') ||
          /\bmax\b/i.test(allText) ||
          allText.includes('apple') ||
          allText.includes('cada mes') ||
          allText.includes('de cada mes'));

      if (isCasualExpense || isCleaningOrGrocery) {
        isGastoFijo = false;
      } else if (hasFixedKeywords) {
        isGastoFijo = true;
      } else {
        isGastoFijo = Boolean(parsedData.es_gasto_fijo);
      }

      // Determine payment status (PENDIENTE vs PAGADO)
      let estadoPago: 'PAGADO' | 'PENDIENTE' = parsedData.estado_pago || 'PAGADO';
      let diaPago: number | undefined = isGastoFijo ? parsedData.dia_pago_mensual : undefined;

      const userText = (params.textPrompt || '').toLowerCase();
      const isFutureCommitmentText =
        !isCasualExpense &&
        !isCleaningOrGrocery &&
        (allText.includes('tengo que pagar') ||
          allText.includes('debo pagar') ||
          allText.includes('vence el') ||
          allText.includes('de cada mes') ||
          allText.includes('cada mes') ||
          allText.includes('todos los meses') ||
          allText.includes('pago recurrente') ||
          allText.includes('gasto fijo'));

      if (isFutureCommitmentText) {
        estadoPago = 'PENDIENTE';
        isGastoFijo = true;

        const textToMatch = userText || allText;
        const matchDay =
          textToMatch.match(/(\d{1,2})\s*de\s*cada\s*mes/i) ||
          textToMatch.match(/(?:vence|paga|día|dia)\s*(\d{1,2})/i);

        if (matchDay && matchDay[1]) {
          const parsedDay = parseInt(matchDay[1], 10);
          if (parsedDay >= 1 && parsedDay <= 31) {
            diaPago = parsedDay;
          }
        }
        if (!diaPago) {
          const dayFromDate = parseInt(validFecha.split('-')[2], 10);
          diaPago = !isNaN(dayFromDate) && dayFromDate >= 1 && dayFromDate <= 31 ? dayFromDate : 1;
        }
      }

      if (isGastoFijo && !diaPago) {
        const dayFromDate = parseInt(validFecha.split('-')[2], 10);
        diaPago = !isNaN(dayFromDate) && dayFromDate >= 1 && dayFromDate <= 31 ? dayFromDate : 1;
      }

      // Build complete TransactionRecord
      const newRecord: TransactionRecord = {
        id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        fecha: validFecha,
        tipo_operacion: parsedData.tipo_operacion || 'GASTO',
        monto_total: parsedData.monto_total || 0,
        metodo_pago: (cuotasTotal > 1 || cuotaActual > 1 || parsedData.metodo_pago === 'CREDITO') ? 'CREDITO' : (parsedData.metodo_pago || 'EFECTIVO'),
        cuotas: cuotasTotal,
        cuota_actual: cuotaActual,
        cuotas_restantes: cuotasRestantes,
        monto_cuota_mensual: parsedData.monto_cuota_mensual || parsedData.monto_total || 0,
        items: parsedData.items || [],
        alerta_ahorro_comprometido: parsedData.alerta_ahorro_comprometido || false,
        dinero_libre_restante: parsedData.dinero_libre_restante || 0,
        mensaje_usuario: parsedData.mensaje_usuario || 'Transacción registrada correctamente.',
        comercio: parsedData.comercio,
        titulo_resumen: parsedData.titulo_resumen,
        entidad_financiera: entidad,
        es_gasto_fijo: isGastoFijo,
        frecuencia_recurrencia: isGastoFijo ? 'MENSUAL' : 'PUNTUAL',
        estado_pago: estadoPago,
        dia_pago_mensual: diaPago,
      };

      const updatedTxs = sortTransactionsByDateDesc([newRecord, ...transactions]);
      setTransactions(updatedTxs);
      setLastTransaction(newRecord);

      // Check if Drive is connected for automatic cloud backup
      const isDriveUser = Boolean(
        googleUser ||
        accessToken ||
        spreadsheetId ||
        localStorage.getItem('asistente_financiero_sheet_id') ||
        localStorage.getItem('asistente_financiero_google_token')
      );

      // Trigger clean success message notification banner
      setSuccessNotification({
        titulo: newRecord.titulo_resumen || newRecord.comercio || (newRecord.items[0]?.concepto) || 'Registro procesado',
        mensaje: newRecord.mensaje_usuario || 'Registrado correctamente.',
        monto: newRecord.monto_total,
        tipo: newRecord.tipo_operacion,
        esGastoFijo: newRecord.es_gasto_fijo,
        estadoPago: newRecord.estado_pago,
        diaPago: newRecord.dia_pago_mensual,
        processedBy: parsedData.processedBy,
        modelUsed: parsedData.modelUsed,
        fallbackReason: parsedData.fallbackReason,
        driveSynced: isDriveUser,
      });

      // Auto-sync immediately to Google Drive after each new registration
      if (isDriveUser) {
        triggerDriveSync(accessToken, updatedTxs, false);
      }
    } catch (err: any) {
      console.error('Error procesando transacción:', err);
      const msg = err?.message || '';
      if (msg.includes('503') || msg.includes('high demand') || msg.includes('UNAVAILABLE')) {
        alert('El servicio de IA está experimentando alta demanda momentánea. Por favor intenta procesar nuevamente en unos segundos.');
      } else {
        alert(`Error al procesar: ${msg || 'Error de conexión'}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteTransaction = (id: string) => {
    // Delete ONLY the single targeted item by index, preventing accidental bulk removal if two records share an ID
    const targetIndex = transactions.findIndex((t) => t.id === id);
    if (targetIndex === -1) return;
    const updated = [
      ...transactions.slice(0, targetIndex),
      ...transactions.slice(targetIndex + 1),
    ];
    setTransactions(updated);
    if (lastTransaction?.id === id) {
      setLastTransaction(null);
    }
    const hasDriveConnection = Boolean(
      googleUser ||
      accessToken ||
      spreadsheetId ||
      localStorage.getItem('asistente_financiero_sheet_id') ||
      localStorage.getItem('asistente_financiero_google_token')
    );
    if (hasDriveConnection) {
      triggerDriveSync(accessToken, updated, false);
    }
  };

  const handleUpdateTransaction = (id: string, updatedFields: Partial<TransactionRecord>) => {
    const existing = transactions.find((t) => t.id === id);
    let updated: TransactionRecord[];

    if (!existing && updatedFields.estado_pago === 'PAGADO') {
      // If updating a virtual recurring item for the current month that was derived from a previous month
      const todayISO = new Date().toISOString().split('T')[0];
      const defaultItem: TransactionItem = {
        concepto: updatedFields.titulo_resumen || 'Pago de Gasto Fijo',
        monto: updatedFields.monto_total || 0,
        categoria_principal: 'Servicios y Gastos Fijos',
        subcategoria: 'Servicios Básicos',
      };
      const newPaidTx: TransactionRecord = {
        id: `tx-fixed-paid-${Date.now()}`,
        fecha: todayISO,
        tipo_operacion: 'GASTO',
        monto_total: updatedFields.monto_total || 0,
        metodo_pago: updatedFields.metodo_pago || 'DEBITO',
        cuotas: 1,
        monto_cuota_mensual: updatedFields.monto_total || 0,
        items: updatedFields.items && updatedFields.items.length > 0 ? updatedFields.items : [defaultItem],
        alerta_ahorro_comprometido: false,
        dinero_libre_restante: 0,
        mensaje_usuario: 'Pago de servicio recurrente mensual registrado.',
        titulo_resumen: updatedFields.titulo_resumen,
        comercio: updatedFields.comercio,
        entidad_financiera: updatedFields.entidad_financiera,
        es_gasto_fijo: true,
        frecuencia_recurrencia: 'MENSUAL',
        estado_pago: 'PAGADO',
        dia_pago_mensual: updatedFields.dia_pago_mensual,
      };
      updated = sortTransactionsByDateDesc([newPaidTx, ...transactions]);
    } else {
      const currentMonthKey = new Date().toISOString().slice(0, 7);
      const isExistingInCurrentMonth = existing && normalizeDateToISO(existing.fecha).startsWith(currentMonthKey);

      // If marking as PAGADO an existing previous month transaction, create a current month payment entry
      if (existing && updatedFields.estado_pago === 'PAGADO' && !isExistingInCurrentMonth) {
        const todayISO = new Date().toISOString().split('T')[0];
        const newPaidTx: TransactionRecord = {
          ...existing,
          id: `tx-fixed-paid-${Date.now()}`,
          fecha: todayISO,
          estado_pago: 'PAGADO',
          ...updatedFields,
        };
        updated = sortTransactionsByDateDesc([newPaidTx, ...transactions]);
      } else {
        updated = sortTransactionsByDateDesc(
          transactions.map((t) => (t.id === id ? { ...t, ...updatedFields } : t))
        );
      }
    }

    setTransactions(updated);
    if (lastTransaction?.id === id) {
      setLastTransaction((prev) => (prev ? { ...prev, ...updatedFields } : null));
    }
    const token = accessToken || localStorage.getItem('asistente_financiero_google_token');
    if (token) {
      triggerDriveSync(token, updated);
    }
  };

  const handleCancelFixedExpense = (tx: TransactionRecord) => {
    // Strictly target only the single clicked transaction by ID, avoiding bulk cancellation
    const updated = sortTransactionsByDateDesc(
      transactions
        .filter((t) => {
          // If it is the exact targeted pending commitment, delete it
          if (t.id === tx.id && t.estado_pago === 'PENDIENTE') {
            return false;
          }
          return true;
        })
        .map((t) => {
          if (t.id === tx.id) {
            return {
              ...t,
              es_gasto_fijo: false,
              frecuencia_recurrencia: 'PUNTUAL' as const,
              dia_pago_mensual: undefined,
            };
          }
          return t;
        })
    );
    setTransactions(updated);

    const title = tx.titulo_resumen || tx.items[0]?.concepto || 'Gasto Fijo';
    setSuccessNotification({
      titulo: `Gasto Fijo / Suscripción Cancelado: ${title}`,
      mensaje: 'Compromiso eliminado correctamente de tus gastos fijos y proyecciones presupuestarias.',
      monto: tx.monto_total,
      tipo: 'GASTO',
      esGastoFijo: false,
    });

    const token = accessToken || localStorage.getItem('asistente_financiero_google_token');
    if (token) {
      triggerDriveSync(token, updated);
    }
  };

  const handleResetSampleData = () => {
    skipNextAutoSyncRef.current = true;
    const sortedSample = sortTransactionsByDateDesc(SAMPLE_TRANSACTIONS);
    setTransactions(sortedSample);
    setLastTransaction(sortedSample[0] || null);
    setConfig(INITIAL_CONFIG);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans pb-16 antialiased">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 md:pt-6">
        {/* Navigation Bar Header */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-1.5 mb-3 shadow-2xs">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap pb-1 sm:pb-0 scrollbar-none">
            <button
              onClick={() => setActiveTab('inicio')}
              className={`py-2 px-3 sm:px-3.5 rounded-md flex items-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'inicio'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Home className="w-4 h-4 shrink-0" />
              <span>Inicio / Registrar</span>
            </button>

            <button
              onClick={() => setActiveTab('historial')}
              className={`py-2 px-3 sm:px-3.5 rounded-md flex items-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'historial'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <ListOrdered className="w-4 h-4 shrink-0" />
              <span>Historial de Operaciones</span>
              <span className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
                {transactions.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('proyeccion')}
              className={`py-2 px-3 sm:px-3.5 rounded-md flex items-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'proyeccion'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <CreditCard className="w-4 h-4 shrink-0" />
              <span>Proyección de Caja</span>
            </button>

            <button
              onClick={() => setActiveTab('presupuestos')}
              className={`py-2 px-3 sm:px-3.5 rounded-md flex items-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'presupuestos'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Target className="w-4 h-4 text-emerald-100 shrink-0" />
              <span>Presupuestos</span>
            </button>

            <button
              onClick={() => setActiveTab('graficos')}
              className={`py-2 px-3 sm:px-3.5 rounded-md flex items-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'graficos'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <PieIcon className="w-4 h-4 shrink-0" />
              <span>Gráficos y Analítica</span>
            </button>

            <button
              onClick={() => {
                checkHealthEndpoint();
                setShowDiagnostics(true);
              }}
              className="py-2 px-3 rounded-md flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 sm:ml-auto border border-slate-200 dark:border-slate-800"
              title="Verificar estado de conexión con Gemini IA y configuración de Vercel"
            >
              <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>Estado IA / Vercel</span>
            </button>
          </div>
        </div>

        {/* Global Google Drive Database Sync Banner (Single Compact Unified Control) */}
        <div className="mb-5">
          <GoogleDriveSyncHeader
            user={googleUser}
            isSyncing={isDriveSyncing}
            lastSyncedAt={lastDriveSyncedAt}
            spreadsheetUrl={spreadsheetUrl}
            tokenNeedsRefresh={tokenNeedsRefresh}
            onLogin={handleGoogleLogin}
            onLogout={handleGoogleLogout}
            onManualSync={() => triggerDriveSync(null, undefined, true)}
            onImportDrive={() => handleImportFromDrive()}
            onReconnect={handleGoogleLogin}
          />
        </div>

        {/* PAGE 1: INICIO (PANTALLA INICIAL) */}
        {activeTab === 'inicio' && (
          <div className="space-y-6">
            {/* Main Budget Health Summary Header with top navbar alert symbol */}
            <HeaderBudgetSummary
              summary={budgetSummary}
              monedaSimbolo={config.monedaSimbolo}
              pendingAlertsCount={pendingFixedExpensesCount}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onNavigateToProyeccion={() => setActiveTab('proyeccion')}
            />

            {/* Box Principal para Registrar Operaciones (Texto, Voz, OCR Boleta) */}
            <TransactionInputSection
              onProcess={handleProcessFinancial}
              isProcessing={isProcessing}
              monedaSimbolo={config.monedaSimbolo}
            />

            {/* Success Confirmation Message Banner */}
            {successNotification && (
              <div
                className={`p-4 rounded-sm flex items-start justify-between shadow-xs animate-fadeIn ${
                  successNotification.estadoPago === 'PENDIENTE'
                    ? 'bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 mt-0.5 ${
                      successNotification.estadoPago === 'PENDIENTE'
                        ? 'bg-amber-600 text-white'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {successNotification.estadoPago === 'PENDIENTE' ? (
                      <Calendar className="w-5 h-5" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4
                        className={`font-bold text-xs uppercase tracking-wider ${
                          successNotification.estadoPago === 'PENDIENTE'
                            ? 'text-amber-900 dark:text-amber-200'
                            : 'text-emerald-900 dark:text-emerald-200'
                        }`}
                      >
                        {successNotification.estadoPago === 'PENDIENTE'
                          ? '¡Compromiso Fijo Programado Registrado (Pendiente de Pago)!'
                          : '¡Registro Procesado e Ingresado Satisfactoriamente!'}
                      </h4>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-xs ${
                          successNotification.estadoPago === 'PENDIENTE'
                            ? 'bg-amber-200 dark:bg-amber-800 text-amber-950 dark:text-amber-100'
                            : 'bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100'
                        }`}
                      >
                        {successNotification.estadoPago === 'PENDIENTE'
                          ? `PENDIENTE (PAGA EL DÍA ${successNotification.diaPago || 1})`
                          : successNotification.tipo === 'INGRESO'
                          ? 'INGRESO'
                          : successNotification.esGastoFijo
                          ? 'GASTO FIJO MENSUAL'
                          : 'COMPRA ÚNICA'}
                      </span>

                      {/* AI Processing Engine Status Badge */}
                      {successNotification.processedBy === 'gemini_ai' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-xs bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-800 flex items-center gap-1">
                          🤖 IA Gemini ({successNotification.modelUsed || 'gemini-3.7-flash'})
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            checkHealthEndpoint();
                            setShowDiagnostics(true);
                          }}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-xs bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 hover:bg-amber-200 dark:hover:bg-amber-900 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Procesado con reglas básicas de respaldo. Haz clic para diagnosticar tu Vercel GEMINI_API_KEY."
                        >
                          ⚡ Modo Respaldo (Sin IA) — <u>Diagnosticar Vercel</u>
                        </button>
                      )}

                      {/* Drive Auto-Save Status Badge */}
                      {successNotification.driveSynced && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-xs bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                          ☁️ Autoguardado en Drive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-800 dark:text-slate-200 mt-1 font-bold">
                      {successNotification.titulo} — {config.monedaSimbolo} {successNotification.monto.toFixed(2)}
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                      {successNotification.mensaje}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSuccessNotification(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-sm transition-colors cursor-pointer"
                  title="Cerrar notificación"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Summary Preview: Last 4 Transactions & Projections Shortcut */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Recent Activity Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm p-4 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    <span>Últimas Operaciones</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('historial')}
                    className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Ver Historial ({transactions.length})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2">
                  {transactions.slice(0, 4).map((tx) => (
                    <div
                      key={tx.id}
                      className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xs border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="truncate max-w-[200px]">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {tx.titulo_resumen || tx.items[0]?.concepto || 'Sin título'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {tx.fecha} • {tx.metodo_pago}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`font-mono font-bold ${
                            tx.tipo_operacion === 'INGRESO'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {tx.tipo_operacion === 'INGRESO' ? '+' : '-'} {config.monedaSimbolo}{' '}
                          {tx.monto_total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Projection & Cards Summary */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm p-4 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-indigo-600" />
                      <span>Cuotas y Compromisos del Mes</span>
                    </h3>
                    <button
                      onClick={() => setActiveTab('proyeccion')}
                      className="text-xs font-bold text-indigo-700 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Ver Proyección</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xs border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300">Gastos Fijos Recurrentes (Último mes)</span>
                      <span className="font-mono font-bold text-indigo-900 dark:text-indigo-200">
                        {config.monedaSimbolo} {budgetSummary.gastosFijos.toFixed(2)}
                      </span>
                    </div>

                    <div className="p-2.5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xs border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300">Cuotas de Tarjeta del Mes</span>
                      <span className="font-mono font-bold text-indigo-900 dark:text-indigo-200">
                        {config.monedaSimbolo} {budgetSummary.cuotasCredito.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('proyeccion')}
                  className="mt-3 w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xs text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Explorar Cuotas por Entidad y Proyección a 6 Meses</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PAGE 2: HISTORIAL DE OPERACIONES */}
        {activeTab === 'historial' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-sm border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                  <ListOrdered className="w-4 h-4 text-emerald-600" />
                  <span>Historial General de Operaciones</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Filtra, busca, edita o exporta todas las transacciones registradas.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('inicio')}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xs transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>+ Registrar Nueva</span>
              </button>
            </div>

            <TransactionsList
              transactions={transactions}
              onDeleteTransaction={handleDeleteTransaction}
              onUpdateTransaction={handleUpdateTransaction}
              monedaSimbolo={config.monedaSimbolo}
            />
          </div>
        )}

        {/* PAGE 3: PROYECCIÓN DE CAJA Y CUOTAS */}
        {activeTab === 'proyeccion' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-sm border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-indigo-600" />
                  <span>Proyección de Cuotas y Compromisos Futuros</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Visualiza tus gastos fijos recurrentes y el detalle mensual de cuotas por tarjeta de crédito.
                </p>
              </div>
            </div>

            <FutureInstallmentsProjection
              transactions={transactions}
              monedaSimbolo={config.monedaSimbolo}
              ingresoMensual={config.ingresoMensual}
              onUpdateTransaction={handleUpdateTransaction}
              onCancelFixedExpense={handleCancelFixedExpense}
              onNavigateToInicio={() => setActiveTab('inicio')}
            />
          </div>
        )}

        {/* PAGE 4: PRESUPUESTOS POR CATEGORÍA */}
        {activeTab === 'presupuestos' && (
          <CategoryBudgetsPage
            transactions={transactions}
            categoryBudgets={categoryBudgets}
            onUpdateCategoryBudgets={(newBudgets) => setCategoryBudgets(newBudgets)}
            monedaSimbolo={config.monedaSimbolo}
          />
        )}

        {/* PAGE 4: GRÁFICOS Y ANALÍTICA */}
        {activeTab === 'graficos' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-sm border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                  <PieIcon className="w-4 h-4 text-emerald-600" />
                  <span>Análisis y Gráficos Financieros</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Desglose por categoría de gastos y evaluación de hábitos financieros.
                </p>
              </div>
            </div>

            <FinancialAnalyticsChart
              transactions={transactions}
              summary={budgetSummary}
              monedaSimbolo={config.monedaSimbolo}
            />
          </div>
        )}

        {/* Vercel & AI Diagnostics Modal */}
        {showDiagnostics && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-lg w-full p-6 shadow-xl relative">
              <button
                onClick={() => setShowDiagnostics(false)}
                className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-sm cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Diagnóstico de Conexión IA & Vercel
                </h3>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                Verifica si tu aplicación desplegada en Vercel está procesando transacciones con <strong>Gemini AI</strong> o si está recurriendo al motor heurístico de respaldo.
              </p>

              {/* Live Health Status Box */}
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-md p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    Estado de Conexión Servidor (/api/health)
                  </span>
                  <button
                    onClick={checkHealthEndpoint}
                    disabled={isCheckingHealth}
                    className="text-[11px] font-semibold text-emerald-600 hover:underline cursor-pointer"
                  >
                    {isCheckingHealth ? 'Probando...' : 'Re-comprobar'}
                  </button>
                </div>

                {healthStatus ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Endpoint /api/health:</span>
                      <span className="font-mono font-bold text-emerald-600">
                        {healthStatus.status === 'ok' ? '✅ Activo (200 OK)' : '❌ Error de Conexión'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Variable GEMINI_API_KEY:</span>
                      <span className={`font-mono font-bold ${healthStatus.hasApiKey ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {healthStatus.hasApiKey ? '✅ Configurada y Detectada' : '❌ NO Detectada (Falta en Vercel)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Entorno de Servidor:</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">
                        {healthStatus.environment || 'Serverless / Express'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">Cargando prueba de diagnóstico...</p>
                )}
              </div>

              {/* Actionable instructions if GEMINI_API_KEY is missing */}
              {healthStatus && !healthStatus.hasApiKey && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-md p-4 mb-4 text-xs">
                  <h4 className="font-bold text-amber-900 dark:text-amber-200 mb-1 flex items-center gap-1.5">
                    ⚠️ ¿Cómo activar el procesamiento real con Gemini IA en Vercel?
                  </h4>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-700 dark:text-slate-300 mt-2">
                    <li>Entra a tu panel de control en <strong>vercel.com</strong> y abre tu proyecto.</li>
                    <li>Ve a la pestaña <strong>Settings</strong> &rarr; <strong>Environment Variables</strong>.</li>
                    <li>
                      Añade una nueva variable:
                      <div className="my-1.5 p-2 rounded-xs bg-amber-100/80 dark:bg-amber-900/40 text-[11px] font-mono border border-amber-300/50">
                        <div>Key: <strong className="text-emerald-700 dark:text-emerald-300">GEMINI_API_KEY</strong></div>
                        <div>Value: <span className="text-slate-600 dark:text-slate-400">tu_api_key_de_google_ai_studio</span></div>
                      </div>
                    </li>
                    <li>Haz clic en <strong>Save</strong>.</li>
                    <li>En Vercel, ve a <strong>Deployments</strong> &rarr; <strong>Redeploy</strong> para aplicar los cambios.</li>
                  </ol>
                </div>
              )}

              {healthStatus && healthStatus.hasApiKey && (
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-md p-3 mb-4 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>¡Todo configurado correctamente! Vercel ejecutará <strong>Gemini AI (gemini-3.7-flash)</strong> para analizar texto, voz y OCR de boletas.</span>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => setShowDiagnostics(false)}
                  className="px-4 py-2 bg-slate-800 text-white rounded-md text-xs font-bold hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Entendido / Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Settings Modal */}
        <BudgetSettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          config={config}
          onSaveConfig={(newConfig) => setConfig(newConfig)}
          onResetSampleData={handleResetSampleData}
        />
      </div>
    </div>
  );
}
