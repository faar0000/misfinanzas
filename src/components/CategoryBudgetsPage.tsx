import React, { useState, useEffect } from 'react';
import {
  CategoryDefinition,
  CATEGORIAS_BASE,
  TransactionRecord,
} from '../types';
import { getNormalizedCategoryName, getNormalizedSubcategoryName } from '../lib/financial';
import {
  Target,
  PiggyBank,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Apple,
  Coffee,
  Car,
  Home,
  PartyPopper,
  CreditCard,
  Wrench,
  Sparkles,
  ArrowRightLeft,
  ArrowRight,
  Zap,
  History,
  Info,
  X,
  SlidersHorizontal,
  ShieldCheck,
  Undo2,
} from 'lucide-react';

export interface BudgetTransferRecord {
  id: string;
  fecha: string; // ISO string or YYYY-MM-DD
  origenId: string;
  origenNombre: string;
  destinoId: string;
  destinoNombre: string;
  monto: number;
  motivo?: string;
}

interface CategoryBudgetsPageProps {
  transactions: TransactionRecord[];
  categoryBudgets: Record<string, number>;
  onUpdateCategoryBudgets: (newBudgets: Record<string, number>) => void;
  monedaSimbolo: string;
}

// Icon mapping helper
const getCategoryIcon = (iconName: string) => {
  switch (iconName) {
    case 'Apple':
      return <Apple className="w-5 h-5" />;
    case 'Coffee':
      return <Coffee className="w-5 h-5" />;
    case 'Car':
      return <Car className="w-5 h-5" />;
    case 'Home':
      return <Home className="w-5 h-5" />;
    case 'PartyPopper':
      return <PartyPopper className="w-5 h-5" />;
    case 'CreditCard':
      return <CreditCard className="w-5 h-5" />;
    case 'Wrench':
      return <Wrench className="w-5 h-5" />;
    default:
      return <Target className="w-5 h-5" />;
  }
};

// Normalize category name to match CATEGORIAS_BASE IDs
export const normalizeCategoryToId = (
  catName?: string,
  subcatName?: string,
  extraText?: string,
  esGastoFijo?: boolean,
  metodoPago?: string
): string => {
  if (esGastoFijo) {
    return 'servicios_fijos';
  }

  if (metodoPago === 'CREDITO') {
    const resolvedName = getNormalizedCategoryName(catName, subcatName, '', extraText);
    if (resolvedName !== 'Alimentación y Dieta' && resolvedName !== 'Gastos Hormiga y Antojos') {
      return 'credito_compromisos';
    }
  }

  const normalizedName = getNormalizedCategoryName(catName, subcatName, '', extraText);

  switch (normalizedName) {
    case 'Alimentación y Dieta':
      return 'alimentacion';
    case 'Gastos Hormiga y Antojos':
      return 'gastos_hormiga';
    case 'Vehículo':
      return 'vehiculo';
    case 'Hogar y Mantenimiento':
      return 'hogar_mantenimiento';
    case 'Servicios y Gastos Fijos':
      return 'servicios_fijos';
    case 'Ocio y Salidas':
      return 'ocio_salidas';
    case 'Crédito y Compromisos':
      return 'credito_compromisos';
    default: {
      const cLower = (catName || '').toLowerCase();
      const sLower = (subcatName || '').toLowerCase();
      if (cLower.includes('vehic') || cLower.includes('auto') || sLower.includes('estacionamiento') || sLower.includes('cochera')) return 'vehiculo';
      if (cLower.includes('mueble') || cLower.includes('balanza') || cLower.includes('reparaci') || sLower.includes('mueble') || sLower.includes('balanza') || sLower.includes('reparaci')) return 'hogar_mantenimiento';
      if (cLower.includes('servicio') || cLower.includes('fijo') || cLower.includes('vivienda') || sLower.includes('alquiler') || sLower.includes('luz') || sLower.includes('agua')) return 'servicios_fijos';
      if (cLower.includes('ocio') || cLower.includes('salida')) return 'ocio_salidas';
      if (cLower.includes('credit') || cLower.includes('compromiso')) return 'credito_compromisos';
      if (cLower.includes('hormiga') || cLower.includes('antojo')) return 'gastos_hormiga';
      return 'alimentacion';
    }
  }
};

export const CategoryBudgetsPage: React.FC<CategoryBudgetsPageProps> = ({
  transactions,
  categoryBudgets,
  onUpdateCategoryBudgets,
  monedaSimbolo,
}) => {
  const [editingBudgets, setEditingBudgets] = useState<Record<string, string>>({});
  const [isEditingAll, setIsEditingAll] = useState(false);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

  // Transfer Modal & State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferSourceId, setTransferSourceId] = useState<string>('vehiculo');
  const [transferTargetId, setTransferTargetId] = useState<string>('ocio_salidas');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferNote, setTransferNote] = useState<string>('');

  // History of Transfers (persisted in localStorage)
  const [transferHistory, setTransferHistory] = useState<BudgetTransferRecord[]>(() => {
    try {
      const saved = localStorage.getItem('asistente_financiero_budget_transfers');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [showHistory, setShowHistory] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('asistente_financiero_budget_transfers', JSON.stringify(transferHistory));
    } catch (e) {
      console.error('Error saving transfer history', e);
    }
  }, [transferHistory]);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Current month string YYYY-MM
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const currentMonthName = new Date().toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  });

  // Calculate current month executed spending per category & subcategory
  const currentMonthExpenses = transactions.filter(
    (t) =>
      t.tipo_operacion === 'GASTO' &&
      t.fecha.startsWith(currentMonthStr) &&
      t.estado_pago !== 'PENDIENTE'
  );

  const spentPerCategory: Record<string, number> = {};
  const spentPerSubcategory: Record<string, Record<string, number>> = {};

  CATEGORIAS_BASE.forEach((cat) => {
    spentPerCategory[cat.id] = 0;
    spentPerSubcategory[cat.id] = {};
  });

  currentMonthExpenses.forEach((tx) => {
    let txMonthlyAmount = tx.monto_total || 0;
    if (tx.metodo_pago === 'CREDITO' && tx.cuotas > 1) {
      txMonthlyAmount = tx.monto_cuota_mensual || tx.monto_total / tx.cuotas;
    }

    if (tx.items && tx.items.length > 0) {
      const itemsDeclaredTotal = tx.items.reduce((sum, item) => sum + (item.monto || 0), 0);

      tx.items.forEach((item) => {
        let itemAmount = 0;
        if (itemsDeclaredTotal > 0 && item.monto) {
          itemAmount = (item.monto / itemsDeclaredTotal) * txMonthlyAmount;
        } else {
          itemAmount = txMonthlyAmount / tx.items.length;
        }

        const catId = normalizeCategoryToId(
          item.categoria_principal,
          item.subcategoria,
          `${tx.titulo_resumen || ''} ${tx.comercio || ''} ${tx.mensaje_usuario || ''}`,
          tx.es_gasto_fijo,
          tx.metodo_pago
        );

        spentPerCategory[catId] = (spentPerCategory[catId] || 0) + itemAmount;

        const subcatName = getNormalizedSubcategoryName(
          catId,
          item.subcategoria,
          item.concepto,
          `${tx.titulo_resumen || ''} ${tx.comercio || ''} ${tx.mensaje_usuario || ''}`
        );

        if (!spentPerSubcategory[catId]) {
          spentPerSubcategory[catId] = {};
        }
        spentPerSubcategory[catId][subcatName] =
          (spentPerSubcategory[catId][subcatName] || 0) + itemAmount;
      });
    } else {
      const catId = normalizeCategoryToId(
        '',
        '',
        `${tx.titulo_resumen || ''} ${tx.comercio || ''} ${tx.mensaje_usuario || ''}`,
        tx.es_gasto_fijo,
        tx.metodo_pago
      );

      spentPerCategory[catId] = (spentPerCategory[catId] || 0) + txMonthlyAmount;

      const subcatName = getNormalizedSubcategoryName(
        catId,
        '',
        tx.titulo_resumen || tx.comercio || 'General',
        tx.mensaje_usuario || ''
      );

      if (!spentPerSubcategory[catId]) {
        spentPerSubcategory[catId] = {};
      }
      spentPerSubcategory[catId][subcatName] =
        (spentPerSubcategory[catId][subcatName] || 0) + txMonthlyAmount;
    }
  });

  // Calculate Totals
  const totalPresupuesto = CATEGORIAS_BASE.reduce(
    (sum, cat) => sum + (categoryBudgets[cat.id] || 0),
    0
  );

  const totalGastado = Object.values(spentPerCategory).reduce((sum, val) => sum + val, 0);

  const totalDisponible = Math.max(0, totalPresupuesto - totalGastado);

  const porcentajeGlobalUso =
    totalPresupuesto > 0 ? Math.min(100, (totalGastado / totalPresupuesto) * 100) : 0;

  // Analysis of Surpluses & Deficits per Category
  const categoryAnalysis = CATEGORIAS_BASE.map((cat) => {
    const budget = categoryBudgets[cat.id] || 0;
    const spent = spentPerCategory[cat.id] || 0;
    const remaining = budget - spent;
    const isDeficit = remaining < 0;
    const isSurplus = remaining > 0;
    return {
      id: cat.id,
      nombre: cat.nombre,
      color: cat.color,
      budget,
      spent,
      remaining,
      isDeficit,
      isSurplus,
    };
  });

  const categoriesWithSurplus = categoryAnalysis.filter((c) => c.isSurplus && c.remaining >= 1);
  const categoriesWithDeficit = categoryAnalysis.filter((c) => c.isDeficit);

  const totalSurplusAvailable = categoriesWithSurplus.reduce((sum, c) => sum + c.remaining, 0);
  const totalDeficitNeeded = categoriesWithDeficit.reduce(
    (sum, c) => sum + Math.abs(c.remaining),
    0
  );

  // Open Transfer Modal for a specific source
  const openTransferForSource = (sourceCatId: string) => {
    setTransferSourceId(sourceCatId);

    // Pick a default target category different from source
    const targetCandidates = CATEGORIAS_BASE.filter((c) => c.id !== sourceCatId);
    // Prefer a category in deficit if any exist, otherwise first other candidate
    const preferredTarget = categoriesWithDeficit.find((c) => c.id !== sourceCatId) || targetCandidates[0];
    
    setTransferTargetId(preferredTarget ? preferredTarget.id : 'ahorro_protegido');

    // Pre-fill amount with the available remaining surplus
    const sourceObj = categoryAnalysis.find((c) => c.id === sourceCatId);
    if (sourceObj && sourceObj.remaining > 0) {
      setTransferAmount(sourceObj.remaining.toFixed(2));
    } else {
      setTransferAmount('');
    }

    setTransferNote('');
    setIsTransferModalOpen(true);
  };

  // Execute a Manual Transfer between categories or to savings
  const handleExecuteTransfer = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const amountNum = parseFloat(transferAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Por favor ingrese un monto válido mayor a 0.');
      return;
    }

    const sourceObj = categoryAnalysis.find((c) => c.id === transferSourceId);
    if (!sourceObj) return;

    if (amountNum > sourceObj.remaining + 0.01) {
      if (
        !confirm(
          `El monto S/. ${amountNum.toFixed(2)} excede el saldo sobrante actual de ${
            sourceObj.nombre
          } (S/. ${sourceObj.remaining.toFixed(
            2
          )}). ¿Deseas ajustar el presupuesto de todas formas?`
        )
      ) {
        return;
      }
    }

    const updatedBudgets = { ...categoryBudgets };

    // Reduce source budget
    updatedBudgets[transferSourceId] = Math.max(0, (updatedBudgets[transferSourceId] || 0) - amountNum);

    let targetName = 'Protección de Ahorro';
    if (transferTargetId !== 'ahorro_protegido') {
      const targetObj = CATEGORIAS_BASE.find((c) => c.id === transferTargetId);
      if (targetObj) {
        targetName = targetObj.nombre;
        updatedBudgets[transferTargetId] = (updatedBudgets[transferTargetId] || 0) + amountNum;
      }
    }

    // Apply new budgets
    onUpdateCategoryBudgets(updatedBudgets);

    // Record in history
    const newRecord: BudgetTransferRecord = {
      id: `tr-${Date.now()}`,
      fecha: new Date().toISOString(),
      origenId: transferSourceId,
      origenNombre: sourceObj.nombre,
      destinoId: transferTargetId,
      destinoNombre: targetName,
      monto: amountNum,
      motivo: transferNote.trim() || undefined,
    };

    setTransferHistory((prev) => [newRecord, ...prev]);
    setIsTransferModalOpen(false);

    showNotification(
      `Reasignado con éxito: ${monedaSimbolo} ${amountNum.toFixed(2)} de ${sourceObj.nombre} ➔ ${targetName}`
    );
  };

  // Auto-Balance Deficits from Surpluses
  const handleAutoBalanceDeficits = () => {
    if (categoriesWithDeficit.length === 0) {
      alert('No hay categorías con exceso de gasto para reequilibrar.');
      return;
    }

    if (categoriesWithSurplus.length === 0) {
      alert('No hay otras categorías con saldo disponible para cubrir los excesos.');
      return;
    }

    let updatedBudgets = { ...categoryBudgets };
    let totalCovered = 0;
    const newRecords: BudgetTransferRecord[] = [];

    // Clone surplus pools
    let surplusPools = categoriesWithSurplus.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      available: c.remaining,
    }));

    categoriesWithDeficit.forEach((deficitCat) => {
      let needed = Math.abs(deficitCat.remaining);

      for (let i = 0; i < surplusPools.length && needed > 0.01; i++) {
        const pool = surplusPools[i];
        if (pool.available <= 0.01) continue;

        const take = Math.min(needed, pool.available);

        updatedBudgets[pool.id] = (updatedBudgets[pool.id] || 0) - take;
        updatedBudgets[deficitCat.id] = (updatedBudgets[deficitCat.id] || 0) + take;

        pool.available -= take;
        needed -= take;
        totalCovered += take;

        newRecords.push({
          id: `tr-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          fecha: new Date().toISOString(),
          origenId: pool.id,
          origenNombre: pool.nombre,
          destinoId: deficitCat.id,
          destinoNombre: deficitCat.nombre,
          monto: take,
          motivo: 'Reequilibrio automático de excedentes',
        });
      }
    });

    onUpdateCategoryBudgets(updatedBudgets);
    setTransferHistory((prev) => [...newRecords, ...prev]);

    showNotification(
      `Reequilibrio automático completado: ${monedaSimbolo} ${totalCovered.toFixed(
        2
      )} reasignados para cubrir déficit.`
    );
  };

  // Move All Unused Surpluses to Savings
  const handleSweepSurplusToSavings = () => {
    if (categoriesWithSurplus.length === 0) {
      alert('No hay remanentes en ninguna categoría para mover a ahorro.');
      return;
    }

    if (
      !confirm(
        `¿Deseas ajustar los presupuestos de las categorías con sobrante para consolidar ${monedaSimbolo} ${totalSurplusAvailable.toFixed(
          2
        )} en Ahorro?`
      )
    ) {
      return;
    }

    let updatedBudgets = { ...categoryBudgets };
    const newRecords: BudgetTransferRecord[] = [];

    categoriesWithSurplus.forEach((cat) => {
      const surplus = cat.remaining;
      if (surplus > 0) {
        updatedBudgets[cat.id] = Math.max(0, (updatedBudgets[cat.id] || 0) - surplus);

        newRecords.push({
          id: `tr-sweep-${Date.now()}-${cat.id}`,
          fecha: new Date().toISOString(),
          origenId: cat.id,
          origenNombre: cat.nombre,
          destinoId: 'ahorro_protegido',
          destinoNombre: 'Protección de Ahorro',
          monto: surplus,
          motivo: 'Consolidación de remanentes del mes hacia Ahorro',
        });
      }
    });

    onUpdateCategoryBudgets(updatedBudgets);
    setTransferHistory((prev) => [...newRecords, ...prev]);

    showNotification(
      `Consolidación hacia Ahorro exitosa: ${monedaSimbolo} ${totalSurplusAvailable.toFixed(
        2
      )} protegidos.`
    );
  };

  // Undo a transfer from history
  const handleUndoTransfer = (record: BudgetTransferRecord) => {
    let updatedBudgets = { ...categoryBudgets };

    // Restore source
    updatedBudgets[record.origenId] = (updatedBudgets[record.origenId] || 0) + record.monto;

    // Deduct from target if target was a budget category
    if (record.destinoId !== 'ahorro_protegido') {
      updatedBudgets[record.destinoId] = Math.max(
        0,
        (updatedBudgets[record.destinoId] || 0) - record.monto
      );
    }

    onUpdateCategoryBudgets(updatedBudgets);
    setTransferHistory((prev) => prev.filter((r) => r.id !== record.id));

    showNotification(`Transferencia revertida: ${monedaSimbolo} ${record.monto.toFixed(2)} reseteados.`);
  };

  // Input Handlers for Global Edit Mode
  const handleInputChange = (catId: string, val: string) => {
    setEditingBudgets((prev) => ({ ...prev, [catId]: val }));
  };

  const handleSaveAllBudgets = () => {
    const updated: Record<string, number> = { ...categoryBudgets };
    CATEGORIAS_BASE.forEach((cat) => {
      if (editingBudgets[cat.id] !== undefined) {
        const parsed = parseFloat(editingBudgets[cat.id]);
        updated[cat.id] = isNaN(parsed) || parsed < 0 ? 0 : parsed;
      }
    });
    onUpdateCategoryBudgets(updated);
    setIsEditingAll(false);
    showNotification('Límites presupuestales guardados correctamente.');
  };

  const handleResetDefaultBudgets = () => {
    const defaults: Record<string, number> = {
      alimentacion: 500,
      gastos_hormiga: 100,
      vehiculo: 300,
      servicios_fijos: 1200,
      ocio_salidas: 300,
      credito_compromisos: 500,
    };
    onUpdateCategoryBudgets(defaults);
    const editingDefaults: Record<string, string> = {};
    Object.keys(defaults).forEach((k) => {
      editingDefaults[k] = defaults[k].toString();
    });
    setEditingBudgets(editingDefaults);
    showNotification('Presupuestos restablecidos a los valores por defecto.');
  };

  const startEditing = () => {
    const currentMap: Record<string, string> = {};
    CATEGORIAS_BASE.forEach((cat) => {
      currentMap[cat.id] = (categoryBudgets[cat.id] || 0).toString();
    });
    setEditingBudgets(currentMap);
    setIsEditingAll(true);
  };

  return (
    <div className="space-y-5 animate-fadeIn relative">
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-md shadow-xl border border-slate-700 flex items-center gap-3 text-xs animate-bounce">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* HEADER BANNER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded-xs">
                <Target className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Presupuestos por Categoría
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 capitalize">
              Control de metas de gasto mensual •{' '}
              <span className="font-semibold">{currentMonthName}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isEditingAll ? (
              <>
                <button
                  onClick={() => openTransferForSource(categoriesWithSurplus[0]?.id || 'vehiculo')}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  title="Mover remanente sobrante entre categorías"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Reasignar Remanente</span>
                </button>
                <button
                  onClick={startEditing}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Ajustar Limites</span>
                </button>
                <button
                  onClick={handleResetDefaultBudgets}
                  className="px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-md text-xs font-medium flex items-center gap-1 transition-all cursor-pointer"
                  title="Restablecer sugeridos"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Restablecer</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveAllBudgets}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar Cambios</span>
                </button>
                <button
                  onClick={() => setIsEditingAll(false)}
                  className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-md text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* METRICS SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-md">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-0.5">
              Presupuesto Total
            </span>
            <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tracking-tight">
              {monedaSimbolo} {totalPresupuesto.toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block truncate">
              Límites asignados en {CATEGORIAS_BASE.length} categorías
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-md">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-0.5">
              Gastado al Momento
            </span>
            <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tracking-tight">
              {monedaSimbolo} {totalGastado.toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 block truncate">
              {porcentajeGlobalUso.toFixed(1)}% del presupuesto global usado
            </span>
          </div>

          <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-md">
            <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block mb-0.5">
              Remanente Global Libre
            </span>
            <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400 font-mono tracking-tight">
              {monedaSimbolo} {totalDisponible.toFixed(2)}
            </div>
            <span className="text-[10px] text-emerald-800 dark:text-emerald-400 mt-0.5 block truncate">
              Sobrante acumulado disponible
            </span>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="mt-3 pt-2">
          <div className="flex justify-between text-xs font-semibold mb-1">
            <span className="text-slate-700 dark:text-slate-300 text-[11px]">
              Avance General de Consumo
            </span>
            <span className="font-mono text-slate-800 dark:text-slate-200 text-[11px]">
              {totalGastado.toFixed(2)} / {totalPresupuesto.toFixed(2)} ({porcentajeGlobalUso.toFixed(0)}%)
            </span>
          </div>
          <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                porcentajeGlobalUso > 100
                  ? 'bg-rose-500'
                  : porcentajeGlobalUso > 80
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, porcentajeGlobalUso)}%` }}
            />
          </div>
        </div>
      </div>

      {/* DYNAMIC SHARED BUDGET POOL / QUICK ACTIONS BANNER */}
      {categoriesWithDeficit.length > 0 && (
        <div className="p-3.5 bg-slate-900/95 dark:bg-slate-900/95 border-2 border-amber-500 rounded-md text-amber-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md animate-fadeIn">
          <div className="flex items-start gap-2.5">
            <div className="p-2 bg-amber-500/20 border border-amber-500/40 rounded-md text-amber-400 shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <span>Atención: Exceso de presupuesto en {categoriesWithDeficit.length} {categoriesWithDeficit.length === 1 ? 'categoría' : 'categorías'}</span>
              </h3>
              <p className="text-xs text-slate-200 mt-0.5 leading-snug">
                El gasto acumulado ha superado el límite en un total de <strong className="text-amber-300 font-mono font-bold">{monedaSimbolo} {totalDeficitNeeded.toFixed(2)}</strong>. Puedes compensar este exceso usando los sobrantes disponibles.
              </p>
            </div>
          </div>
          {categoriesWithSurplus.length > 0 && (
            <button
              onClick={handleAutoBalanceDeficits}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs shrink-0 self-start sm:self-auto"
              title="Cubre automáticamente el sobrecosto usando el sobrante de otras categorías"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Reequilibrar Excesos</span>
            </button>
          )}
        </div>
      )}

      <div className="p-3.5 bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-md shadow-sm border border-indigo-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="p-2 bg-indigo-800/80 rounded-md text-amber-300 shrink-0 mt-0.5">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-200 flex items-center gap-1.5">
              Gestión Dinámica & Compartida de Remanentes
            </h3>
            <p className="text-xs text-slate-300 mt-0.5 leading-snug">
              {categoriesWithSurplus.length > 0 ? (
                <>
                  Tienes <strong className="text-emerald-300">{monedaSimbolo} {totalSurplusAvailable.toFixed(2)}</strong> de saldo sobrante disponible para reasignar a otras categorías o guardar en Ahorro.
                </>
              ) : (
                'Los presupuestos ajustados permiten mover excedentes dinámicamente según tus prioridades.'
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto shrink-0">
          {categoriesWithDeficit.length > 0 && categoriesWithSurplus.length > 0 && (
            <button
              onClick={handleAutoBalanceDeficits}
              className="flex-1 sm:flex-initial px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Cubre automáticamente el sobrecosto de categorías excedidas usando el sobrante de otras"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Reequilibrar Excesos</span>
            </button>
          )}

          {categoriesWithSurplus.length > 0 && (
            <button
              onClick={handleSweepSurplusToSavings}
              className="flex-1 sm:flex-initial px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Envía todos los sobrantes acumulados hacia la meta de Ahorro"
            >
              <PiggyBank className="w-3.5 h-3.5 text-emerald-400" />
              <span>Enviar Sobrantes a Ahorro</span>
            </button>
          )}
        </div>
      </div>

      {/* CATEGORY CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {CATEGORIAS_BASE.map((cat) => {
          const budget = categoryBudgets[cat.id] || 0;
          const spent = spentPerCategory[cat.id] || 0;
          const remaining = budget - spent;
          const pct = budget > 0 ? (spent / budget) * 100 : 0;
          const isOverBudget = spent > budget && budget > 0;
          const isSurplus = remaining > 0;
          const subcatsSpent = spentPerSubcategory[cat.id] || {};
          const isExpanded = expandedCategoryId === cat.id;

          // Dynamic colors & badges based on proximity to limit
          let statusColorClass = 'text-emerald-600 dark:text-emerald-400';
          let barBgClass = 'bg-emerald-500 shadow-xs shadow-emerald-500/20';
          let badgeText = '🟢 Bajo control';
          let badgeClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';

          if (isOverBudget) {
            statusColorClass = 'text-rose-600 dark:text-rose-400 font-bold';
            barBgClass = 'bg-rose-600 shadow-xs shadow-rose-600/30';
            badgeText = `🔴 Excedido por ${monedaSimbolo} ${(spent - budget).toFixed(2)}`;
            badgeClass = 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800 font-bold';
          } else if (pct >= 85) {
            statusColorClass = 'text-orange-600 dark:text-orange-400 font-bold';
            barBgClass = 'bg-orange-500 shadow-xs shadow-orange-500/20';
            badgeText = '🟠 Límite cercano';
            badgeClass = 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300 border border-orange-200 dark:border-orange-800 font-semibold';
          } else if (pct >= 60) {
            statusColorClass = 'text-amber-600 dark:text-amber-400';
            barBgClass = 'bg-amber-500 shadow-xs shadow-amber-500/20';
            badgeText = '🟡 Atención';
            badgeClass = 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
          }

          return (
            <div
              key={cat.id}
              className={`bg-white dark:bg-slate-900 border rounded-md p-3.5 sm:p-4 shadow-2xs transition-all flex flex-col justify-between ${
                isOverBudget
                  ? 'border-rose-300 dark:border-rose-800'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div>
                {/* Card Header */}
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-md flex items-center justify-center text-white shrink-0 shadow-2xs"
                      style={{ backgroundColor: cat.color }}
                    >
                      {getCategoryIcon(cat.iconoNombre)}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {cat.nombre}
                      </h3>
                      <span className={`inline-block text-[10px] px-2 py-0.5 rounded-xs font-medium mt-0.5 ${badgeClass}`}>
                        {badgeText}
                      </span>
                    </div>
                  </div>

                  {/* Inline budget value or input */}
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                      Presupuesto
                    </span>
                    {isEditingAll ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs font-mono font-bold text-slate-500">
                          {monedaSimbolo}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={
                            editingBudgets[cat.id] !== undefined
                              ? editingBudgets[cat.id]
                              : budget
                          }
                          onChange={(e) => handleInputChange(cat.id, e.target.value)}
                          className="w-20 sm:w-24 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-xs font-mono font-bold text-right text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                        />
                      </div>
                    ) : (
                      <div className="text-sm font-extrabold font-mono text-slate-900 dark:text-slate-100">
                        {monedaSimbolo} {budget.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Visual Progress Bar Section */}
                <div className="space-y-1.5 my-3 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-md border border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Gastado:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {monedaSimbolo} {spent.toFixed(2)}
                      </span>
                      <span className="text-slate-400">/</span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {monedaSimbolo} {budget.toFixed(2)}
                      </span>
                    </div>
                    <span className={`font-mono text-xs font-extrabold ${statusColorClass}`}>
                      {pct.toFixed(0)}%
                    </span>
                  </div>

                  {/* Progress track & fill */}
                  <div className="relative w-full h-2.5 bg-slate-200/80 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${barBgClass}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>

                {/* Disponible / Restante Box with Quick Reassign Action */}
                <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 rounded-md text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 text-[11px] block">
                      {isOverBudget ? 'Monto Excedido:' : 'Saldo Sobrante:'}
                    </span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        isOverBudget
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {isOverBudget
                        ? `- ${monedaSimbolo} ${(spent - budget).toFixed(2)}`
                        : `${monedaSimbolo} ${remaining.toFixed(2)}`}
                    </span>
                  </div>

                  {/* Button to Reassign Surplus if available */}
                  {isSurplus && remaining >= 1 && (
                    <button
                      type="button"
                      onClick={() => openTransferForSource(cat.id)}
                      className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      title={`Reasignar ${monedaSimbolo} ${remaining.toFixed(2)} a otra categoría`}
                    >
                      <ArrowRightLeft className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      <span>Mover Remanente</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Subcategories Breakdown Toggle */}
              <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setExpandedCategoryId(isExpanded ? null : cat.id)}
                  className="w-full text-left text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-between cursor-pointer py-0.5"
                >
                  <span>
                    Subcategorías ({Object.keys(subcatsSpent).length} registradas este mes)
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                {isExpanded && (
                  <div className="mt-2 space-y-1 pl-1 animate-fadeIn">
                    {Object.keys(subcatsSpent).length === 0 ? (
                      <p className="text-[11px] italic text-slate-400 dark:text-slate-500 py-1">
                        Sin consumos registrados en este mes.
                      </p>
                    ) : (
                      Object.entries(subcatsSpent)
                        .sort(([, amountA], [, amountB]) => amountB - amountA)
                        .map(([subcat, amount]) => (
                        <div
                          key={subcat}
                          className="flex items-center justify-between text-xs py-1 px-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 rounded-xs"
                        >
                          <span className="text-slate-700 dark:text-slate-300 font-medium truncate">
                            {subcat}
                          </span>
                          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 shrink-0 ml-2">
                            {monedaSimbolo} {amount.toFixed(2)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* REALLOCATION HISTORY AUDIT TRAIL */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 hover:text-indigo-600 cursor-pointer"
          >
            <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Historial de Reasignaciones y Movimientos de Remanentes</span>
            <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] rounded-full font-mono">
              {transferHistory.length}
            </span>
          </button>

          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            {showHistory ? 'Ocultar' : 'Ver detalle'}
          </button>
        </div>

        {showHistory && (
          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2 animate-fadeIn">
            {transferHistory.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 italic py-2">
                Aún no has realizado reasignaciones de remanentes entre categorías este mes.
              </p>
            ) : (
              transferHistory.map((record) => (
                <div
                  key={record.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-md gap-2 text-xs"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {record.origenNombre}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {record.destinoNombre}
                    </span>
                    {record.motivo && (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                        ({record.motivo})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 justify-between sm:justify-end">
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                      {monedaSimbolo} {record.monto.toFixed(2)}
                    </span>
                    <button
                      onClick={() => handleUndoTransfer(record)}
                      className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                      title="Revertir este movimiento de presupuesto"
                    >
                      <Undo2 className="w-3 h-3" />
                      <span>Deshacer</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* MANUAL REALLOCATION MODAL */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-md w-full p-5 shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-md">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  Reasignar Remanente de Presupuesto
                </h3>
              </div>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="mt-4 space-y-4">
              {/* Source Category */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Categoría Origen (con remanente)
                </label>
                <select
                  value={transferSourceId}
                  onChange={(e) => {
                    setTransferSourceId(e.target.value);
                    const sourceObj = categoryAnalysis.find((c) => c.id === e.target.value);
                    if (sourceObj && sourceObj.remaining > 0) {
                      setTransferAmount(sourceObj.remaining.toFixed(2));
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-xs font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  {CATEGORIAS_BASE.map((cat) => {
                    const analysis = categoryAnalysis.find((c) => c.id === cat.id);
                    const rem = analysis ? analysis.remaining : 0;
                    return (
                      <option key={cat.id} value={cat.id}>
                        {cat.nombre} (Sobrante: {monedaSimbolo} {rem.toFixed(2)})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Amount to Transfer */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Monto a Mover
                  </label>
                  {/* Quick percentage buttons */}
                  <div className="flex gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => {
                        const sourceObj = categoryAnalysis.find((c) => c.id === transferSourceId);
                        if (sourceObj) setTransferAmount((sourceObj.remaining * 0.5).toFixed(2));
                      }}
                      className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 text-slate-700 dark:text-slate-300 rounded-xs font-semibold cursor-pointer"
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const sourceObj = categoryAnalysis.find((c) => c.id === transferSourceId);
                        if (sourceObj) setTransferAmount(sourceObj.remaining.toFixed(2));
                      }}
                      className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-950 hover:bg-indigo-200 text-indigo-700 dark:text-indigo-300 rounded-xs font-semibold cursor-pointer"
                    >
                      100%
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-mono font-bold text-slate-400">
                    {monedaSimbolo}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    required
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-sm font-mono font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Destination Category */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Categoría Destino
                </label>
                <select
                  value={transferTargetId}
                  onChange={(e) => setTransferTargetId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-xs font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  <option value="ahorro_protegido">
                    🛡️ Protección de Ahorro (10% Meta Intocable)
                  </option>
                  {CATEGORIAS_BASE.filter((c) => c.id !== transferSourceId).map((cat) => {
                    const analysis = categoryAnalysis.find((c) => c.id === cat.id);
                    const isDef = analysis && analysis.isDeficit;
                    return (
                      <option key={cat.id} value={cat.id}>
                        {cat.nombre} {isDef ? '(⚠️ Excedida)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Note / Reason */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Nota / Motivo (opcional)
                </label>
                <input
                  type="text"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="Ej: Ahorré en combustible y paso la diferencia a Ocio"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-md text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Confirmar Reasignación</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FOOTER TIP BANNER */}
      <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/80 rounded-md flex items-start gap-3 text-xs">
        <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-emerald-950 dark:text-emerald-200 mb-0.5">
            Presupuestos Dinámicos & Inteligencia Financiera
          </h4>
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            Los remanentes no gastados en categorías con menor consumo (como <strong>Vehículo</strong>) pueden reasignarse dinámicamente a otras con mayor actividad (como <strong>Ocio</strong>) o consolidarse en tu <strong>Protección de Ahorro</strong>.
          </p>
        </div>
      </div>
    </div>
  );
};

