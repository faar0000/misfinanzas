import React, { useState, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { TransactionRecord, CATEGORIAS_BASE, BudgetSummary } from '../types';
import {
  getNormalizedCategoryName,
  getNormalizedSubcategoryName,
  getFinancialTier,
  PyGPersonalTier,
  isSalaryIncomeTransaction,
  computeMonthCarryoverBalance,
  normalizeDateToISO,
} from '../lib/financial';
import {
  PieChart as PieIcon,
  BarChart3,
  Calendar,
  Filter,
  Layers,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FolderTree,
  Tag,
  X,
  CreditCard,
  ShoppingBag,
  TrendingUp,
  TrendingDown,
  Scale,
  DollarSign,
  Activity,
  Zap,
  CheckCircle2,
  HelpCircle,
  Info,
  Shield,
} from 'lucide-react';

interface FinancialAnalyticsChartProps {
  transactions: TransactionRecord[];
  summary: BudgetSummary;
  monedaSimbolo: string;
}

const MONTH_NAMES_ES: { [key: string]: string } = {
  '01': 'Enero',
  '02': 'Febrero',
  '03': 'Marzo',
  '04': 'Abril',
  '05': 'Mayo',
  '06': 'Junio',
  '07': 'Julio',
  '08': 'Agosto',
  '09': 'Setiembre',
  '10': 'Octubre',
  '11': 'Noviembre',
  '12': 'Diciembre',
};

const currentMonthKey = new Date().toISOString().substring(0, 7);

export const FinancialAnalyticsChart: React.FC<FinancialAnalyticsChartProps> = ({
  transactions,
  summary,
  monedaSimbolo,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [includePending, setIncludePending] = useState<boolean>(false);

  // Extract all available months from transaction dates (YYYY-MM)
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    // Always include current month in list
    const todayMonth = new Date().toISOString().substring(0, 7);
    set.add(todayMonth);

    transactions.forEach((tx) => {
      const isoDate = normalizeDateToISO(tx.fecha);
      if (isoDate && isoDate.length >= 7) {
        set.add(isoDate.substring(0, 7));
      }
    });

    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  const formatMonthLabel = (monthKey: string) => {
    if (monthKey === 'ALL') return '🗓️ Todos los Meses (Histórico)';
    const [year, m] = monthKey.split('-');
    const monthName = MONTH_NAMES_ES[m] || m;
    return `📅 ${monthName} ${year}`;
  };

  // Filter transactions according to month selection and payment status
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const isoDate = normalizeDateToISO(tx.fecha);
      // Month filter
      if (selectedMonth !== 'ALL' && !isoDate.startsWith(selectedMonth)) {
        return false;
      }
      // Pending commitment filter: by default (false), exclude unpaid pending commitments
      if (!includePending && tx.estado_pago === 'PENDIENTE') {
        return false;
      }
      return true;
    });
  }, [transactions, selectedMonth, includePending]);

  // Aggregate expenses by category for selected month
  const categoryTotals = useMemo(() => {
    const totals: { [catName: string]: number } = {};
    filteredTransactions.forEach((tx) => {
      if (tx.tipo_operacion === 'GASTO') {
        const isCreditInstallment = tx.metodo_pago === 'CREDITO' && tx.cuotas > 1;
        const txAmount = isCreditInstallment
          ? (tx.monto_cuota_mensual || 0)
          : (tx.monto_total || 0);

        if (tx.items && tx.items.length > 0) {
          const itemsSum = tx.items.reduce((s, i) => s + (i.monto || 0), 0);
          tx.items.forEach((item) => {
            const cat = getNormalizedCategoryName(
              item.categoria_principal,
              item.subcategoria,
              item.concepto,
              `${tx.titulo_resumen || ''} ${tx.comercio || ''}`
            );
            const itemAmount = itemsSum > 0 ? (item.monto / itemsSum) * txAmount : txAmount / tx.items.length;

            totals[cat] = (totals[cat] || 0) + itemAmount;
          });
        } else {
          const cat = getNormalizedCategoryName(
            '',
            '',
            tx.titulo_resumen || tx.comercio || '',
            ''
          );
          totals[cat] = (totals[cat] || 0) + txAmount;
        }
      }
    });
    return totals;
  }, [filteredTransactions]);

  const totalExpensesInSelectedPeriod = useMemo(() => {
    return Object.values(categoryTotals).reduce((sum: number, val: number) => sum + val, 0);
  }, [categoryTotals]);

  // Donut chart pieData: all categories (or top 10 if more than 10)
  const { pieData, groupedOtrosCategories } = useMemo(() => {
    const rawList = Object.keys(categoryTotals)
      .map((catName) => {
        const matched = CATEGORIAS_BASE.find(
          (c) => c.nombre.toLowerCase() === catName.toLowerCase()
        );
        return {
          name: catName,
          value: categoryTotals[catName],
          color: matched ? matched.color : '#64748B',
        };
      })
      .sort((a, b) => b.value - a.value);

    if (rawList.length <= 10) {
      return { pieData: rawList, groupedOtrosCategories: [] as string[] };
    }

    const topCategories = rawList.slice(0, 9);
    const minorCategories = rawList.slice(9);
    const otrosTotal = minorCategories.reduce((sum, item) => sum + item.value, 0);
    const groupedNames = minorCategories.map((c) => c.name);

    const finalPieData = [
      ...topCategories,
      {
        name: 'Otros',
        value: otrosTotal,
        color: '#94A3B8', // Slate neutral color for grouped "Otros"
      },
    ];

    return { pieData: finalPieData, groupedOtrosCategories: groupedNames };
  }, [categoryTotals]);

  // Detailed breakdown of individual expense items inside the selected category
  const categoryDetailItems = useMemo(() => {
    if (!selectedCategory) return [];

    const itemsList: Array<{
      txId: string;
      fecha: string;
      titulo: string;
      concepto: string;
      subcategoria: string;
      montoCalculado: number;
      montoTotalCompra: number;
      metodoPago: string;
      cuotas: number;
      montoCuotaMensual: number;
      estadoPago?: string;
      comercio?: string;
      esGastoFijo?: boolean;
    }> = [];

    const isOtrosSelected = selectedCategory.toLowerCase() === 'otros';
    const targetCatLower = selectedCategory.toLowerCase();

    filteredTransactions.forEach((tx) => {
      if (tx.tipo_operacion === 'GASTO') {
        const isCreditInstallment = tx.metodo_pago === 'CREDITO' && tx.cuotas > 1;

        if (tx.items && tx.items.length > 0) {
          const itemsSum = tx.items.reduce((s, i) => s + (i.monto || 0), 0);
          tx.items.forEach((item) => {
            const cat = getNormalizedCategoryName(
              item.categoria_principal,
              item.subcategoria,
              item.concepto,
              `${tx.titulo_resumen || ''} ${tx.comercio || ''}`
            );

            const matchesCategory = isOtrosSelected
              ? (groupedOtrosCategories.length > 0
                  ? groupedOtrosCategories.some((c) => c.toLowerCase() === cat.toLowerCase())
                  : cat.toLowerCase() === 'otros')
              : cat.toLowerCase() === targetCatLower;

            if (matchesCategory) {
              const subcat = getNormalizedSubcategoryName(
                cat,
                item.subcategoria,
                item.concepto,
                `${tx.titulo_resumen || ''} ${tx.comercio || ''} ${tx.mensaje_usuario || ''}`
              );

              const itemAmount = isCreditInstallment
                ? itemsSum > 0
                  ? (item.monto / itemsSum) * (tx.monto_cuota_mensual || tx.monto_total / tx.cuotas)
                  : (tx.monto_cuota_mensual || tx.monto_total / tx.cuotas) / tx.items.length
                : itemsSum > 0
                ? (item.monto / itemsSum) * (tx.monto_total || item.monto)
                : item.monto;

              itemsList.push({
                txId: tx.id,
                fecha: tx.fecha,
                titulo: tx.titulo_resumen || item.concepto || 'Gasto',
                concepto: item.concepto,
                subcategoria: subcat,
                montoCalculado: itemAmount,
                montoTotalCompra: tx.monto_total,
                metodoPago: tx.metodo_pago,
                cuotas: tx.cuotas,
                montoCuotaMensual: tx.monto_cuota_mensual,
                estadoPago: tx.estado_pago,
                comercio: tx.comercio,
                esGastoFijo: tx.es_gasto_fijo,
              });
            }
          });
        } else {
          const cat = getNormalizedCategoryName(
            '',
            '',
            tx.titulo_resumen || tx.comercio || '',
            ''
          );

          const matchesCategory = isOtrosSelected
            ? (groupedOtrosCategories.length > 0
                ? groupedOtrosCategories.some((c) => c.toLowerCase() === cat.toLowerCase())
                : cat.toLowerCase() === 'otros')
            : cat.toLowerCase() === targetCatLower;

          if (matchesCategory) {
            const subcat = getNormalizedSubcategoryName(
              cat,
              '',
              tx.titulo_resumen || tx.comercio || 'General',
              tx.mensaje_usuario || ''
            );

            const itemAmount = isCreditInstallment
              ? tx.monto_cuota_mensual || tx.monto_total / tx.cuotas
              : tx.monto_total || 0;

            itemsList.push({
              txId: tx.id,
              fecha: tx.fecha,
              titulo: tx.titulo_resumen || tx.comercio || 'Gasto',
              concepto: tx.titulo_resumen || tx.comercio || 'Gasto',
              subcategoria: subcat,
              montoCalculado: itemAmount,
              montoTotalCompra: tx.monto_total,
              metodoPago: tx.metodo_pago,
              cuotas: tx.cuotas,
              montoCuotaMensual: tx.monto_cuota_mensual,
              estadoPago: tx.estado_pago,
              comercio: tx.comercio,
              esGastoFijo: tx.es_gasto_fijo,
            });
          }
        }
      }
    });

    return itemsList.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [filteredTransactions, selectedCategory, groupedOtrosCategories]);

  // Group detailed expenses by unified subcategory
  const groupedCategoryDetailsBySubcat = useMemo(() => {
    if (!categoryDetailItems || categoryDetailItems.length === 0) return [];

    const totalCategorySpent = categoryDetailItems.reduce(
      (sum, item) => sum + (item.montoCalculado || 0),
      0
    );

    const groupMap: Record<
      string,
      {
        subcategoria: string;
        totalMonto: number;
        items: typeof categoryDetailItems;
      }
    > = {};

    categoryDetailItems.forEach((item) => {
      const sub = item.subcategoria || 'General';
      if (!groupMap[sub]) {
        groupMap[sub] = {
          subcategoria: sub,
          totalMonto: 0,
          items: [],
        };
      }
      groupMap[sub].totalMonto += item.montoCalculado;
      groupMap[sub].items.push(item);
    });

    return Object.values(groupMap)
      .map((group) => ({
        ...group,
        porcentaje: totalCategorySpent > 0 ? (group.totalMonto / totalCategorySpent) * 100 : 0,
        items: group.items.sort(
          (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
        ),
      }))
      .sort((a, b) => b.totalMonto - a.totalMonto);
  }, [categoryDetailItems]);

  // Calculate Standard Personal P&G (Estado de Resultados) and EBITDA Personal metrics
  const pygMetrics = useMemo(() => {
    let sueldoCobrado = 0;
    let extrasCobrados = 0;
    let subsistencia = 0; // Costos Fijos Estructurales (Existir)
    let operativoVariable = 0; // Costos Variables Operativos
    let discrecional = 0; // Estilo de Vida y Ocio
    let deudaPasivos = 0; // Servicio de Deuda / Reducción de Pasivos

    filteredTransactions.forEach((tx) => {
      if (tx.tipo_operacion === 'INGRESO' && tx.estado_pago !== 'PENDIENTE') {
        if (isSalaryIncomeTransaction(tx)) {
          sueldoCobrado += tx.monto_total;
        } else {
          extrasCobrados += tx.monto_total;
        }
      }
    });

    const baseSueldo = Math.max(summary.ingresoMensual, sueldoCobrado);
    const ingresosBrutos = baseSueldo + extrasCobrados;

    filteredTransactions.forEach((tx) => {
      if (tx.tipo_operacion === 'GASTO') {
        const isCreditInstallment = tx.metodo_pago === 'CREDITO' && tx.cuotas > 1;
        const txAmount = isCreditInstallment ? (tx.monto_cuota_mensual || 0) : (tx.monto_total || 0);

        if (tx.items && tx.items.length > 0) {
          const itemsSum = tx.items.reduce((s, i) => s + (i.monto || 0), 0);
          tx.items.forEach((item) => {
            const itemAmount = itemsSum > 0 ? (item.monto / itemsSum) * txAmount : txAmount / tx.items.length;
            const tier = getFinancialTier(
              item.categoria_principal,
              item.subcategoria,
              item.concepto,
              tx.metodo_pago,
              tx.cuotas,
              tx.es_gasto_fijo
            );

            if (tier === 'SUBSISTENCIA') subsistencia += itemAmount;
            else if (tier === 'OPERATIVO') operativoVariable += itemAmount;
            else if (tier === 'DISCRECIONAL') discrecional += itemAmount;
            else if (tier === 'DEUDA_PASIVO') deudaPasivos += itemAmount;
          });
        } else {
          const tier = getFinancialTier(
            '',
            '',
            tx.titulo_resumen || tx.comercio || '',
            tx.metodo_pago,
            tx.cuotas,
            tx.es_gasto_fijo
          );
          if (tier === 'SUBSISTENCIA') subsistencia += txAmount;
          else if (tier === 'OPERATIVO') operativoVariable += txAmount;
          else if (tier === 'DISCRECIONAL') discrecional += txAmount;
          else if (tier === 'DEUDA_PASIVO') deudaPasivos += txAmount;
        }
      }
    });

    const ebitdaPersonal = ingresosBrutos - subsistencia; // Margen Operativo Personal
    const coberturaSubsistencia = subsistencia > 0 ? ingresosBrutos / subsistencia : (ingresosBrutos > 0 ? 99 : 0);
    const resultadoOperativo = ebitdaPersonal - operativoVariable - discrecional;
    const flujoLibreMes = resultadoOperativo - deudaPasivos;

    // Calculate carryover rollover from prior months if a specific month is selected
    const carryover = selectedMonth !== 'ALL'
      ? computeMonthCarryoverBalance(transactions, selectedMonth, summary.ingresoMensual, 10).saldoInicialArrastrado
      : 0;

    const flujoLibreFinalConArrastre = flujoLibreMes + carryover;

    return {
      ingresosBrutos,
      subsistencia,
      ebitdaPersonal,
      coberturaSubsistencia,
      operativoVariable,
      discrecional,
      resultadoOperativo,
      deudaPasivos,
      flujoLibreMes,
      saldoInicialArrastrado: carryover,
      flujoLibreFinal: flujoLibreFinalConArrastre,
    };
  }, [filteredTransactions, transactions, selectedMonth, summary.ingresoMensual]);

  return (
    <div className="bg-white border border-slate-200 rounded-sm shadow-sm p-3.5 sm:p-6 mb-6">
      {/* Top Controls Header with Month Selection */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 sm:pb-4 border-b border-slate-200 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-indigo-600 rounded-sm flex items-center justify-center text-white shrink-0 shadow-xs">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-900">
              Análisis Visual y Categorías
            </h2>
            <p className="text-[10px] sm:text-[11px] text-slate-500">
              Filtra por mes y haz clic en categorías para ver el desglose detallado
            </p>
          </div>
        </div>

        {/* Filter Controls: Month Selector & Pending Commitment Toggle */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 self-start md:self-auto w-full md:w-auto">
          {/* Month Selector Dropdown */}
          <div className="flex-1 sm:flex-initial flex items-center gap-1.5 sm:gap-2 bg-slate-50 border border-slate-300 rounded-sm px-2.5 sm:px-3 py-1 sm:py-1.5 shadow-xs">
            <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 shrink-0" />
            <span className="text-[11px] sm:text-xs font-bold text-slate-700">Mes:</span>
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setSelectedCategory(null); // Reset category selection on month change
              }}
              className="bg-transparent text-[11px] sm:text-xs font-bold text-indigo-900 outline-none cursor-pointer pr-1 flex-1 sm:flex-initial"
            >
              <option value="ALL">🗓️ Todos los Meses (Histórico)</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
          </div>

          {/* Pending Commitments Toggle */}
          <label className="flex items-center gap-1.5 sm:gap-2 bg-slate-50 border border-slate-300 rounded-sm px-2.5 sm:px-3 py-1 sm:py-1.5 shadow-xs cursor-pointer hover:bg-slate-100 transition-colors text-[11px] sm:text-xs">
            <input
              type="checkbox"
              checked={includePending}
              onChange={(e) => setIncludePending(e.target.checked)}
              className="w-3.5 h-3.5 text-indigo-600 rounded-xs border-slate-300 focus:ring-indigo-500 cursor-pointer"
            />
            <span className="text-[11px] sm:text-xs font-medium text-slate-700">
              Incluir pendientes
            </span>
          </label>
        </div>
      </div>

      {/* ESTADO DE RESULTADOS (P&G) Y EBITDA PERSONAL MODULE */}
      <div className="mb-6 sm:mb-8 bg-slate-900 text-white rounded-md p-3.5 sm:p-5 border border-slate-800 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-3 sm:pb-4 border-b border-slate-800 gap-2.5 sm:gap-3 mb-3.5 sm:mb-5">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-emerald-500/20 border border-emerald-500/40 rounded-md flex items-center justify-center text-emerald-400 shrink-0">
              <Scale className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400">
                  Estado de Resultados (P&G) y EBITDA Personal
                </h3>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full font-bold">
                  Plan de Cuentas Estándar
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-300 font-medium mt-0.5">
                Clasifica la estructura financiera en: Subsistencia Estructural, Operativos Variables, Estilo de Vida y Amortización de Pasivos (Deuda).
              </p>
            </div>
          </div>

          {/* EBITDA Personal Highlight Box */}
          <div className="bg-slate-800/90 border border-slate-700 p-2.5 sm:p-3 rounded-md flex items-center justify-between sm:justify-start gap-3 sm:gap-4 shrink-0 self-stretch sm:self-auto">
            <div>
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                EBITDA / Margen
              </span>
              <div className="text-sm sm:text-base font-black font-mono text-emerald-400">
                {monedaSimbolo} {pygMetrics.ebitdaPersonal.toFixed(2)}
              </div>
            </div>
            <div className="border-l border-slate-700 pl-2.5 sm:pl-3">
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 block">Cobertura Base</span>
              <span className={`text-[10px] sm:text-xs font-black px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full inline-block mt-0.5 ${
                pygMetrics.coberturaSubsistencia >= 2
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : pygMetrics.coberturaSubsistencia >= 1
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}>
                ⚡ {pygMetrics.coberturaSubsistencia.toFixed(1)}x Cobertura
              </span>
            </div>
          </div>
        </div>

        {/* 4 Tier KPI Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-3.5 sm:mb-5">
          {/* Tier 1: Subsistencia */}
          <div className="bg-slate-800/80 border border-slate-700 p-2.5 sm:p-3.5 rounded-md relative group hover:border-indigo-500 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-indigo-300 truncate">
                1. Subsistencia
              </span>
              <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-400 shrink-0" />
            </div>
            <div className="text-sm sm:text-lg font-black font-mono text-indigo-200">
              {monedaSimbolo} {pygMetrics.subsistencia.toFixed(2)}
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 font-medium hidden sm:block">
              Alquiler, Servicios, Educación y Salud.
            </p>
          </div>

          {/* Tier 2: Variables Operativos */}
          <div className="bg-slate-800/80 border border-slate-700 p-2.5 sm:p-3.5 rounded-md relative group hover:border-sky-500 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-sky-300 truncate">
                2. Variables
              </span>
              <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-400 shrink-0" />
            </div>
            <div className="text-sm sm:text-lg font-black font-mono text-sky-200">
              {monedaSimbolo} {pygMetrics.operativoVariable.toFixed(2)}
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 font-medium hidden sm:block">
              Supermercado, Combustible, Mantenimiento.
            </p>
          </div>

          {/* Tier 3: Discrecional */}
          <div className="bg-slate-800/80 border border-slate-700 p-2.5 sm:p-3.5 rounded-md relative group hover:border-pink-500 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-pink-300 truncate">
                3. Discrecional
              </span>
              <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-pink-400 shrink-0" />
            </div>
            <div className="text-sm sm:text-lg font-black font-mono text-pink-200">
              {monedaSimbolo} {pygMetrics.discrecional.toFixed(2)}
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 font-medium hidden sm:block">
              Restaurantes, Antojos, Salidas y Ocio.
            </p>
          </div>

          {/* Tier 4: Servicio de Deuda / Reducción de Pasivos */}
          <div className="bg-slate-800/80 border border-slate-700 p-2.5 sm:p-3.5 rounded-md relative group hover:border-amber-500 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber-300 truncate">
                4. Pasivos/Deuda
              </span>
              <CreditCard className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
            </div>
            <div className="text-sm sm:text-lg font-black font-mono text-amber-200">
              {monedaSimbolo} {pygMetrics.deudaPasivos.toFixed(2)}
            </div>
            <p className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 font-medium hidden sm:block">
              Cuotas de tarjetas / préstamos.
            </p>
          </div>
        </div>

        {/* Structured P&G Waterfall Flow */}
        <div className="bg-slate-950/80 rounded-md border border-slate-800 p-2.5 sm:p-4 space-y-1 sm:space-y-2 font-mono text-[11px] sm:text-xs">
          <div className="flex items-center justify-between text-slate-300 pb-1.5 border-b border-slate-800 font-sans font-bold text-[10px] sm:text-xs">
            <span className="uppercase text-[9px] sm:text-[10px] tracking-wider text-slate-400">Estructura P&G</span>
            <span className="uppercase text-[9px] sm:text-[10px] tracking-wider text-slate-400">Monto</span>
          </div>

          {/* Line 1: Ingresos Brutos */}
          <div className="flex items-center justify-between text-emerald-400 font-bold py-0.5 sm:py-1">
            <span className="flex items-center gap-1.5 sm:gap-2 font-sans truncate mr-2">
              <span className="w-4 h-4 sm:w-5 sm:h-5 bg-emerald-950 border border-emerald-700 rounded-xs flex items-center justify-center text-[9px] sm:text-[10px] text-emerald-300 font-black shrink-0">+</span>
              <span className="truncate">Ingresos Brutos Totales</span>
            </span>
            <span className="shrink-0">{monedaSimbolo} {pygMetrics.ingresosBrutos.toFixed(2)}</span>
          </div>

          {/* Line 2: (-) Subsistencia */}
          <div className="flex items-center justify-between text-indigo-300 py-0.5 sm:py-1 pl-2 sm:pl-4">
            <span className="flex items-center gap-1.5 sm:gap-2 font-sans truncate mr-2">
              <span className="w-4 h-4 sm:w-5 sm:h-5 bg-indigo-950 border border-indigo-700 rounded-xs flex items-center justify-center text-[9px] sm:text-[10px] text-indigo-300 font-black shrink-0">-</span>
              <span className="truncate">Costos Fijos (Subsistencia)</span>
            </span>
            <span className="shrink-0">- {monedaSimbolo} {pygMetrics.subsistencia.toFixed(2)}</span>
          </div>

          {/* Line 3: EBITDA Personal */}
          <div className="flex items-center justify-between bg-emerald-950/40 border border-emerald-800/60 p-1.5 sm:p-2 rounded-xs text-emerald-300 font-black my-0.5 sm:my-1">
            <span className="flex items-center gap-1.5 sm:gap-2 font-sans truncate mr-2">
              <span className="w-4 h-4 sm:w-5 sm:h-5 bg-emerald-800 text-slate-950 rounded-xs flex items-center justify-center text-[9px] sm:text-[10px] font-black shrink-0">=</span>
              <span className="truncate">MARGEN OPERATIVO (EBITDA)</span>
            </span>
            <span className="text-xs sm:text-sm shrink-0">{monedaSimbolo} {pygMetrics.ebitdaPersonal.toFixed(2)}</span>
          </div>

          {/* Line 4: (-) Operativo Variable */}
          <div className="flex items-center justify-between text-sky-300 py-0.5 sm:py-1 pl-2 sm:pl-4">
            <span className="flex items-center gap-1.5 sm:gap-2 font-sans truncate mr-2">
              <span className="w-4 h-4 sm:w-5 sm:h-5 bg-sky-950 border border-sky-700 rounded-xs flex items-center justify-center text-[9px] sm:text-[10px] text-sky-300 font-black shrink-0">-</span>
              <span className="truncate">Costos Variables Operativos</span>
            </span>
            <span className="shrink-0">- {monedaSimbolo} {pygMetrics.operativoVariable.toFixed(2)}</span>
          </div>

          {/* Line 5: (-) Discrecional */}
          <div className="flex items-center justify-between text-pink-300 py-0.5 sm:py-1 pl-2 sm:pl-4">
            <span className="flex items-center gap-1.5 sm:gap-2 font-sans truncate mr-2">
              <span className="w-4 h-4 sm:w-5 sm:h-5 bg-pink-950 border border-pink-700 rounded-xs flex items-center justify-center text-[9px] sm:text-[10px] text-pink-300 font-black shrink-0">-</span>
              <span className="truncate">Gastos Discrecionales (Ocio)</span>
            </span>
            <span className="shrink-0">- {monedaSimbolo} {pygMetrics.discrecional.toFixed(2)}</span>
          </div>

          {/* Line 6: Resultado Operativo Neto */}
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-1.5 sm:p-2 rounded-xs text-slate-200 font-bold my-0.5 sm:my-1">
            <span className="flex items-center gap-1.5 sm:gap-2 font-sans truncate mr-2">
              <span className="w-4 h-4 sm:w-5 sm:h-5 bg-slate-800 text-slate-200 rounded-xs flex items-center justify-center text-[9px] sm:text-[10px] font-black shrink-0">=</span>
              <span className="truncate">RESULTADO OPERATIVO NETO</span>
            </span>
            <span className="shrink-0">{monedaSimbolo} {pygMetrics.resultadoOperativo.toFixed(2)}</span>
          </div>

          {/* Line 7: (-) Servicio de Deuda */}
          <div className="flex items-center justify-between text-amber-300 py-0.5 sm:py-1 pl-2 sm:pl-4">
            <span className="flex items-center gap-1.5 sm:gap-2 font-sans truncate mr-2">
              <span className="w-4 h-4 sm:w-5 sm:h-5 bg-amber-950 border border-amber-700 rounded-xs flex items-center justify-center text-[9px] sm:text-[10px] text-amber-300 font-black shrink-0">-</span>
              <span className="flex items-center gap-1 sm:gap-1.5 truncate">
                <span className="truncate">Amortización de Pasivos</span>
                <span className="text-[8px] sm:text-[9px] bg-amber-500/20 text-amber-200 border border-amber-500/40 px-1 py-0.2 rounded-xs font-sans shrink-0 hidden xs:inline">
                  ⚡ Pasivo
                </span>
              </span>
            </span>
            <span className="shrink-0">- {monedaSimbolo} {pygMetrics.deudaPasivos.toFixed(2)}</span>
          </div>

          {/* Line 8: Flujo Libre del Mes */}
          <div className="flex items-center justify-between text-indigo-200 py-0.5 sm:py-1 pl-2 sm:pl-4">
            <span className="flex items-center gap-1.5 sm:gap-2 font-sans truncate mr-2">
              <span className="w-4 h-4 sm:w-5 sm:h-5 bg-indigo-950 border border-indigo-700 rounded-xs flex items-center justify-center text-[9px] sm:text-[10px] text-indigo-300 font-black shrink-0">=</span>
              <span className="truncate">Flujo Neto Generado Este Mes</span>
            </span>
            <span className="shrink-0">{monedaSimbolo} {pygMetrics.flujoLibreMes.toFixed(2)}</span>
          </div>

          {/* Line 9: (+) Saldo Inicial Arrastrado del Mes Anterior (si aplica) */}
          {pygMetrics.saldoInicialArrastrado !== 0 && (
            <div className="flex items-center justify-between text-teal-300 py-0.5 sm:py-1 pl-2 sm:pl-4">
              <span className="flex items-center gap-1.5 sm:gap-2 font-sans truncate mr-2">
                <span className="w-4 h-4 sm:w-5 sm:h-5 bg-teal-950 border border-teal-700 rounded-xs flex items-center justify-center text-[9px] sm:text-[10px] text-teal-300 font-black shrink-0">+</span>
                <span className="truncate">Saldo Libre Arrastrado Mes Anterior</span>
              </span>
              <span className="shrink-0 font-bold">
                {pygMetrics.saldoInicialArrastrado > 0 ? `+ ${monedaSimbolo} ${pygMetrics.saldoInicialArrastrado.toFixed(2)}` : `- ${monedaSimbolo} ${Math.abs(pygMetrics.saldoInicialArrastrado).toFixed(2)}`}
              </span>
            </div>
          )}

          {/* Line 10: Dinero Libre Disponible Acumulado */}
          <div className="flex items-center justify-between bg-indigo-900/60 border border-indigo-700 p-2 sm:p-2.5 rounded-xs text-white font-black text-xs sm:text-sm my-0.5 sm:my-1">
            <span className="flex items-center gap-1.5 sm:gap-2 font-sans truncate mr-2">
              <span className="w-4 h-4 sm:w-5 sm:h-5 bg-indigo-500 text-slate-950 rounded-xs flex items-center justify-center text-[9px] sm:text-[10px] font-black shrink-0">=</span>
              <span className="truncate">DINERO LIBRE TOTAL DISPONIBLE</span>
            </span>
            <span className="text-amber-300 font-mono shrink-0">{monedaSimbolo} {pygMetrics.flujoLibreFinal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Pie Chart: Expense Category Breakdown */}
      <div className="w-full bg-slate-50 p-3.5 sm:p-5 rounded-sm border border-slate-200 flex flex-col justify-between relative mb-4 sm:mb-6">
        <div className="w-full flex items-center justify-between mb-2.5 sm:mb-3 pb-2 border-b border-slate-200">
          <h3 className="text-[10px] sm:text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <PieIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
            <span>Gastos por Categoría</span>
            <span className="text-[9px] sm:text-[10px] font-normal text-slate-500 lowercase hidden xs:inline">
              ({selectedMonth === 'ALL' ? 'histórico' : formatMonthLabel(selectedMonth).replace('📅 ', '')})
            </span>
          </h3>

          {pieData.length > 0 && (
            <span className="text-[11px] sm:text-xs font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 sm:px-2.5 py-0.5 rounded-xs">
              Total: {monedaSimbolo} {totalExpensesInSelectedPeriod.toFixed(2)}
            </span>
          )}
        </div>

        {pieData.length === 0 ? (
          <div className="text-center py-8 sm:py-12 text-slate-400 text-xs italic">
            No hay gastos registrados en este período para graficar.
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4 sm:gap-6 w-full h-full min-h-[280px] sm:min-h-[320px]">
            {/* Left side: Donut Chart (Enlarged) */}
            <div className="w-full lg:w-[48%] h-60 sm:h-80 relative flex flex-col items-center justify-center shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    cursor="pointer"
                    onClick={(entry) => {
                      if (entry && entry.name) {
                        setSelectedCategory((prev) => (prev === entry.name ? null : entry.name));
                      }
                    }}
                  >
                    {pieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        stroke={selectedCategory === entry.name ? '#1E1B4B' : '#FFFFFF'}
                        strokeWidth={selectedCategory === entry.name ? 3 : 1}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [
                      `${monedaSimbolo} ${Number(value).toFixed(2)}`,
                      'Monto',
                    ]}
                    contentStyle={{
                      backgroundColor: '#1E293B',
                      borderColor: '#334155',
                      borderRadius: '2px',
                      color: '#F8FAFC',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="text-[10px] text-slate-400 text-center -mt-1 font-medium">
                💡 Toca un sector para filtrar
              </div>
            </div>

            {/* Right side: Legend */}
            <div className="w-full lg:w-[52%] flex flex-col justify-start space-y-1 sm:space-y-1.5 max-h-64 sm:max-h-80 overflow-y-auto pr-1 sm:pr-2 border-t lg:border-t-0 lg:border-l border-slate-200 pt-3 lg:pt-0 lg:pl-6">
              {pieData.map((cat, i) => {
                const isSelected = selectedCategory === cat.name;
                const percentage = totalExpensesInSelectedPeriod > 0
                  ? ((cat.value / totalExpensesInSelectedPeriod) * 100).toFixed(1)
                  : '0';

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedCategory((prev) => (prev === cat.name ? null : cat.name))}
                    className={`w-full flex items-center justify-between text-left text-xs px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xs border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-900 text-white border-indigo-950 shadow-xs ring-2 ring-indigo-400 font-bold'
                        : 'bg-white hover:bg-indigo-50/70 text-slate-700 border-slate-200 hover:border-indigo-300'
                    }`}
                    title={cat.name === 'Otros' && groupedOtrosCategories.length > 0 ? `Categorías agrupadas: ${groupedOtrosCategories.join(', ')}` : cat.name}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2 flex-1">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: cat.color }} />
                      <span className="font-semibold text-[11px] sm:text-xs leading-tight truncate" title={cat.name}>
                        {cat.name}
                      </span>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-1.5 sm:gap-2 font-mono text-[10px] sm:text-[11px] ml-auto">
                      <span className={isSelected ? 'text-amber-300 font-bold' : 'text-slate-900 font-bold'}>
                        {monedaSimbolo} {cat.value.toFixed(2)}
                      </span>
                      <span className={`text-[9px] sm:text-[10px] ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>
                        ({percentage}%)
                      </span>
                    </div>
                  </button>
                );
              })}

              {groupedOtrosCategories.length > 0 && (
                <div className="text-[9px] sm:text-[10px] text-slate-500 font-medium px-1 pt-1 italic">
                  * 'Otros' agrupa {groupedOtrosCategories.length} categorías menores ({groupedOtrosCategories.slice(0, 3).join(', ')}{groupedOtrosCategories.length > 3 ? '...' : ''}).
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Category Expense Detail Breakdown Section */}
      {selectedCategory ? (
        <div className="bg-indigo-950 text-white rounded-sm p-3.5 sm:p-5 border border-indigo-900 shadow-md animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-indigo-800/80 mb-3 sm:mb-4 gap-2.5">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-indigo-800 rounded-sm flex items-center justify-center shrink-0">
                <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-200" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-extrabold tracking-wide text-white">
                    Detalle: <span className="text-amber-300 uppercase">{selectedCategory}</span>
                  </h3>
                  <span className="bg-indigo-800 text-indigo-200 text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full">
                    {categoryDetailItems.length} {categoryDetailItems.length === 1 ? 'registro' : 'registros'}
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-indigo-200/90 font-medium">
                  Desglose del período ({formatMonthLabel(selectedMonth).replace('📅 ', '').replace('🗓️ ', '')})
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className="self-start sm:self-auto px-2.5 py-1 bg-indigo-800 hover:bg-indigo-700 text-indigo-100 text-[11px] sm:text-xs font-bold rounded-xs flex items-center gap-1 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Ver todas</span>
            </button>
          </div>

          {groupedCategoryDetailsBySubcat.length === 0 ? (
            <div className="text-center py-6 text-indigo-300 text-xs italic">
              No existen ítems registrados en esta categoría para el período seleccionado.
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4 max-h-[520px] overflow-y-auto pr-1">
              {groupedCategoryDetailsBySubcat.map((group, groupIdx) => (
                <div
                  key={`${group.subcategoria}-${groupIdx}`}
                  className="bg-indigo-900/40 border border-indigo-800/80 rounded-sm overflow-hidden"
                >
                  {/* Subcategory Group Header */}
                  <div className="bg-indigo-900/90 px-2.5 sm:px-3.5 py-2 sm:py-2.5 border-b border-indigo-800 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                      <Tag className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
                      <span className="font-bold text-[11px] sm:text-xs text-white tracking-wide truncate">
                        {group.subcategoria}
                      </span>
                      <span className="bg-indigo-950/80 text-indigo-200 text-[9px] sm:text-[10px] font-mono font-medium px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full border border-indigo-800/80">
                        {group.items.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 ml-auto shrink-0 font-mono">
                      <span className="text-[11px] sm:text-xs font-extrabold text-amber-300">
                        {monedaSimbolo} {group.totalMonto.toFixed(2)}
                      </span>
                      <span className="bg-indigo-950/90 text-indigo-300 text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 sm:py-0.5 rounded-xs border border-indigo-800/60">
                        {group.porcentaje.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Individual items within this subcategory */}
                  <div className="p-1.5 sm:p-2 space-y-1 sm:space-y-1.5 divide-y divide-indigo-900/40">
                    {group.items.map((item, idx) => (
                      <div
                        key={`${item.txId}-${idx}`}
                        className="p-2 sm:p-2.5 rounded-xs hover:bg-indigo-900/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2.5"
                      >
                        <div className="flex items-start gap-2 sm:gap-2.5 min-w-0">
                          <div className="p-1 sm:p-1.5 bg-indigo-950/80 rounded-xs border border-indigo-800 shrink-0 text-indigo-300 mt-0.5">
                            {item.metodoPago === 'CREDITO' ? (
                              <CreditCard className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
                            ) : (
                              <ShoppingBag className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-300" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                              <span className="font-bold text-[11px] sm:text-xs text-white truncate">
                                {item.titulo}
                              </span>
                              {item.comercio && (
                                <span className="bg-indigo-950/90 text-indigo-200 text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-xs font-semibold border border-indigo-800/60">
                                  🏬 {item.comercio}
                                </span>
                              )}
                              {item.esGastoFijo && (
                                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-xs font-bold">
                                  📌 Fijo
                                </span>
                              )}
                              {item.estadoPago === 'PENDIENTE' && (
                                <span className="bg-orange-500/30 text-orange-200 border border-orange-500/50 text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-xs font-bold">
                                  ⏳ Pendiente
                                </span>
                              )}
                            </div>

                            <div className="text-[10px] sm:text-[11px] text-indigo-300 mt-0.5 flex items-center gap-1.5 sm:gap-2.5 flex-wrap">
                              <span>📅 {item.fecha}</span>
                              <span>•</span>
                              <span className="truncate">
                                <strong className="text-white">{item.concepto}</strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 border-t sm:border-t-0 border-indigo-800/60 pt-1 sm:pt-0 flex sm:flex-col items-center sm:items-end justify-between">
                          <div className="font-mono font-bold text-xs sm:text-sm text-amber-300">
                            - {monedaSimbolo} {item.montoCalculado.toFixed(2)}
                            {item.metodoPago === 'CREDITO' && item.cuotas > 1 && (
                              <span className="text-[9px] sm:text-[10px] text-indigo-300 font-normal block sm:inline sm:ml-1">
                                ({item.cuotas}c)
                              </span>
                            )}
                          </div>
                          {item.metodoPago === 'CREDITO' && item.cuotas > 1 && (
                            <div className="text-[9px] sm:text-[10px] text-indigo-400 font-mono">
                              Total: {monedaSimbolo} {item.montoTotalCompra.toFixed(2)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 p-2.5 sm:p-3 rounded-sm text-center text-[11px] sm:text-xs text-slate-500 flex items-center justify-center gap-1.5 sm:gap-2">
          <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500" />
          <span>
            Toca una categoría o sector del gráfico para ver el detalle de compras.
          </span>
        </div>
      )}
    </div>
  );
};


