import React, { useState, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { TransactionRecord, CATEGORIAS_BASE, BudgetSummary } from '../types';
import {
  PieChart as PieIcon,
  BarChart3,
  ShieldCheck,
  Calendar,
  Filter,
  Layers,
  ChevronRight,
  X,
  CreditCard,
  ShoppingBag,
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

export const FinancialAnalyticsChart: React.FC<FinancialAnalyticsChartProps> = ({
  transactions,
  summary,
  monedaSimbolo,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [includePending, setIncludePending] = useState<boolean>(false);

  // Extract all available months from transaction dates (YYYY-MM)
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    // Always include current month in list
    const todayMonth = new Date().toISOString().substring(0, 7);
    set.add(todayMonth);

    transactions.forEach((tx) => {
      if (tx.fecha && tx.fecha.length >= 7) {
        set.add(tx.fecha.substring(0, 7));
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
      // Month filter
      if (selectedMonth !== 'ALL' && !tx.fecha.startsWith(selectedMonth)) {
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
  const categoryTotals: { [catName: string]: number } = {};
  let totalExpensesInSelectedPeriod = 0;

  filteredTransactions.forEach((tx) => {
    if (tx.tipo_operacion === 'GASTO') {
      const isCreditInstallment = tx.metodo_pago === 'CREDITO' && tx.cuotas > 1;

      tx.items.forEach((item) => {
        const cat = item.categoria_principal || 'Otros';
        // For credit installments, count the monthly quota portion
        const itemAmount = isCreditInstallment
          ? (item.monto / (tx.monto_total || 1)) * tx.monto_cuota_mensual
          : item.monto;

        categoryTotals[cat] = (categoryTotals[cat] || 0) + itemAmount;
        totalExpensesInSelectedPeriod += itemAmount;
      });
    }
  });

  const pieData = Object.keys(categoryTotals)
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

  // Detailed breakdown of individual expense items inside the selected category
  const categoryDetailItems = useMemo(() => {
    if (!selectedCategory) return [];

    const itemsList: Array<{
      txId: string;
      fecha: string;
      titulo: string;
      concepto: string;
      subcategoria?: string;
      montoCalculado: number;
      montoTotalCompra: number;
      metodoPago: string;
      cuotas: number;
      montoCuotaMensual: number;
      estadoPago?: string;
      comercio?: string;
      esGastoFijo?: boolean;
    }> = [];

    filteredTransactions.forEach((tx) => {
      if (tx.tipo_operacion === 'GASTO') {
        const isCreditInstallment = tx.metodo_pago === 'CREDITO' && tx.cuotas > 1;

        tx.items.forEach((item) => {
          const cat = item.categoria_principal || 'Otros';
          if (cat.toLowerCase() === selectedCategory.toLowerCase()) {
            const itemAmount = isCreditInstallment
              ? (item.monto / (tx.monto_total || 1)) * tx.monto_cuota_mensual
              : item.monto;

            itemsList.push({
              txId: tx.id,
              fecha: tx.fecha,
              titulo: tx.titulo_resumen || item.concepto || 'Gasto',
              concepto: item.concepto,
              subcategoria: item.subcategoria,
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
      }
    });

    return itemsList.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [filteredTransactions, selectedCategory]);

  // Bar chart data comparing Income vs Savings vs Expenses vs Free Money
  const barData = [
    {
      name: 'Cobrado Banco',
      Monto: summary.ingresosCobradosTotal,
      fill: '#059669', // Emerald
    },
    {
      name: 'Ahorro (10%)',
      Monto: summary.metaAhorroMonto,
      fill: '#4F46E5', // Indigo
    },
    {
      name: 'Gastos Proyect.',
      Monto: summary.gastosTotalesProyectados,
      fill: summary.alertaAhorroComprometido ? '#E11D48' : '#D97706',
    },
    {
      name: 'Dinero Libre',
      Monto: Math.max(0, summary.dineroLibreDisponible),
      fill: '#0284C7', // Sky
    },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-sm shadow-sm p-6 mb-6">
      {/* Top Controls Header with Month Selection */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-sm flex items-center justify-center text-white shrink-0 shadow-xs">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-900">
              Análisis Visual y Categorías
            </h2>
            <p className="text-[11px] text-slate-500">
              Filtra por mes y haz clic en cualquier categoría para ver el desglose detallado de compras
            </p>
          </div>
        </div>

        {/* Filter Controls: Month Selector & Pending Commitment Toggle */}
        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          {/* Month Selector Dropdown */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-sm px-3 py-1.5 shadow-xs">
            <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-xs font-bold text-slate-700">Mes:</span>
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setSelectedCategory(null); // Reset category selection on month change
              }}
              className="bg-transparent text-xs font-bold text-indigo-900 outline-none cursor-pointer pr-1"
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
          <label className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-sm px-3 py-1.5 shadow-xs cursor-pointer hover:bg-slate-100 transition-colors">
            <input
              type="checkbox"
              checked={includePending}
              onChange={(e) => setIncludePending(e.target.checked)}
              className="w-3.5 h-3.5 text-indigo-600 rounded-xs border-slate-300 focus:ring-indigo-500 cursor-pointer"
            />
            <span className="text-xs font-medium text-slate-700">
              Incluir compromisos no pagados (pendientes)
            </span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Pie Chart: Expense Category Breakdown */}
        <div className="bg-slate-50 p-4 rounded-sm border border-slate-200 flex flex-col items-center relative">
          <div className="w-full flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <PieIcon className="w-4 h-4 text-indigo-600" />
              <span>Gastos por Categoría</span>
              <span className="text-[10px] font-normal text-slate-500 lowercase">
                ({selectedMonth === 'ALL' ? 'histórico' : formatMonthLabel(selectedMonth).replace('📅 ', '')})
              </span>
            </h3>

            {pieData.length > 0 && (
              <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-xs">
                Total: {monedaSimbolo} {totalExpensesInSelectedPeriod.toFixed(2)}
              </span>
            )}
          </div>

          {pieData.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs italic">
              No hay gastos registrados en este período para graficar.
            </div>
          ) : (
            <div className="w-full h-60 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
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

              <div className="text-[10px] text-slate-400 text-center -mt-2">
                💡 haz clic en un sector de la torta para filtrar sus gastos
              </div>
            </div>
          )}

          {/* Interactive Category Legend Badges */}
          <div className="flex flex-wrap gap-2 mt-3 justify-center w-full">
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
                  className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-xs border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-900 text-white border-indigo-950 shadow-sm ring-2 ring-indigo-400 font-bold'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span>{cat.name}</span>
                  <span className={`font-mono text-[11px] ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>
                    ({monedaSimbolo} {cat.value.toFixed(2)} — {percentage}%)
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bar Chart: Financial Balance Health */}
        <div className="bg-slate-50 p-4 rounded-sm border border-slate-200 flex flex-col items-center">
          <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-3 w-full text-left flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            Balance de Salud Financiera Global
          </h3>

          <div className="w-full h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                <XAxis dataKey="name" stroke="#64748B" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={10} tickLine={false} />
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
                <Bar dataKey="Monto" radius={[2, 2, 0, 0]}>
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="text-[11px] text-slate-500 text-center mt-2 font-medium">
            Ahorro reservado = 10% del ingreso mensual. El dinero libre disponible garantiza liquidez sin tocar tus ahorros.
          </div>
        </div>
      </div>

      {/* Category Expense Detail Breakdown Section */}
      {selectedCategory ? (
        <div className="bg-indigo-950 text-white rounded-sm p-5 border border-indigo-900 shadow-md animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-indigo-800/80 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-indigo-800 rounded-sm flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4 text-indigo-200" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold tracking-wide text-white">
                    Detalle de Gastos: <span className="text-amber-300 uppercase">{selectedCategory}</span>
                  </h3>
                  <span className="bg-indigo-800 text-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {categoryDetailItems.length} {categoryDetailItems.length === 1 ? 'registro' : 'registros'}
                  </span>
                </div>
                <p className="text-[11px] text-indigo-200/90 font-medium">
                  Desglose individual de compras y servicios correspondientes al período seleccionado ({formatMonthLabel(selectedMonth).replace('📅 ', '').replace('🗓️ ', '')})
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className="px-2.5 py-1 bg-indigo-800 hover:bg-indigo-700 text-indigo-100 text-xs font-bold rounded-xs flex items-center gap-1 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Ver todas las categorías</span>
            </button>
          </div>

          {categoryDetailItems.length === 0 ? (
            <div className="text-center py-6 text-indigo-300 text-xs italic">
              No existen ítems registrados en esta categoría para el período seleccionado.
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {categoryDetailItems.map((item, idx) => (
                <div
                  key={`${item.txId}-${idx}`}
                  className="bg-indigo-900/60 hover:bg-indigo-900/90 border border-indigo-800 rounded-xs p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 bg-indigo-950/80 rounded-xs border border-indigo-800 shrink-0 text-indigo-300">
                      {item.metodoPago === 'CREDITO' ? (
                        <CreditCard className="w-4 h-4" />
                      ) : (
                        <ShoppingBag className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-white truncate">{item.titulo}</span>
                        {item.comercio && (
                          <span className="bg-indigo-800/80 text-indigo-200 text-[10px] px-1.5 py-0.5 rounded-xs font-semibold">
                            🏬 {item.comercio}
                          </span>
                        )}
                        {item.esGastoFijo && (
                          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] px-1.5 py-0.5 rounded-xs font-bold">
                            📌 Gasto Fijo
                          </span>
                        )}
                        {item.estadoPago === 'PENDIENTE' && (
                          <span className="bg-orange-500/30 text-orange-200 border border-orange-500/50 text-[10px] px-1.5 py-0.5 rounded-xs font-bold">
                            ⏳ Pendiente de Pago
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-indigo-300 mt-0.5 flex items-center gap-3 flex-wrap">
                        <span>📅 {item.fecha}</span>
                        <span>•</span>
                        <span>Concepto: <strong className="text-white">{item.concepto}</strong></span>
                        {item.subcategoria && (
                          <>
                            <span>•</span>
                            <span className="text-indigo-400">{item.subcategoria}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 border-t md:border-t-0 border-indigo-800/60 pt-2 md:pt-0 flex md:flex-col items-center md:items-end justify-between">
                    <div className="font-mono font-bold text-sm text-amber-300">
                      - {monedaSimbolo} {item.montoCalculado.toFixed(2)}
                      {item.metodoPago === 'CREDITO' && item.cuotas > 1 && (
                        <span className="text-[10px] text-indigo-300 font-normal block md:inline md:ml-1">
                          (/ mes en {item.cuotas} cuotas)
                        </span>
                      )}
                    </div>
                    {item.metodoPago === 'CREDITO' && item.cuotas > 1 && (
                      <div className="text-[10px] text-indigo-400 font-mono">
                        Compra total: {monedaSimbolo} {item.montoTotalCompra.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 p-3 rounded-sm text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Filter className="w-4 h-4 text-indigo-500" />
          <span>
            Haz clic en cualquier categoría de la lista o sector del gráfico circular arriba para ver el listado detallado de sus gastos.
          </span>
        </div>
      )}
    </div>
  );
};


