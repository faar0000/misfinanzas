import React, { useState } from 'react';
import {
  Trash2,
  Search,
  CreditCard,
  Banknote,
  Tag,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronDown,
  ChevronUp,
  Store,
  RotateCw,
  ShoppingBag,
  Clock,
  CheckCircle2,
  SlidersHorizontal,
  Info,
  Check,
} from 'lucide-react';
import { TransactionRecord } from '../types';
import { normalizeDateToISO } from '../lib/financial';

interface TransactionsListProps {
  transactions: TransactionRecord[];
  onDeleteTransaction: (id: string) => void;
  onUpdateTransaction?: (id: string, updatedFields: Partial<TransactionRecord>) => void;
  monedaSimbolo: string;
}

// Helper to format date header (e.g., "Hoy, 18 de Agosto", "Ayer, 17 de Agosto", "Lunes, 10 de Agosto")
const formatDateGroupHeader = (dateStr: string): { title: string; relative?: string } => {
  if (!dateStr) return { title: 'Sin fecha' };

  const normalized = normalizeDateToISO(dateStr);
  const parts = normalized.split('-');
  if (parts.length !== 3) return { title: dateStr };

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return { title: dateStr };
  }

  const txDate = new Date(year, month, day);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const diffTime = todayStart.getTime() - txDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const dayNames = [
    'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'
  ];

  const formattedMonth = monthNames[month] || '';
  const dayOfWeek = dayNames[txDate.getDay()] || '';

  if (diffDays === 0) {
    return {
      title: `Hoy, ${day} de ${formattedMonth}`,
      relative: 'Hoy',
    };
  } else if (diffDays === 1) {
    return {
      title: `Ayer, ${day} de ${formattedMonth}`,
      relative: 'Ayer',
    };
  } else if (diffDays === -1) {
    return {
      title: `Mañana, ${day} de ${formattedMonth}`,
      relative: 'Mañana',
    };
  } else if (year === today.getFullYear()) {
    return {
      title: `${dayOfWeek}, ${day} de ${formattedMonth}`,
    };
  } else {
    return {
      title: `${dayOfWeek}, ${day} de ${formattedMonth} de ${year}`,
    };
  }
};

export const TransactionsList: React.FC<TransactionsListProps> = ({
  transactions,
  onDeleteTransaction,
  onUpdateTransaction,
  monedaSimbolo,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getDisplayTitle = (tx: TransactionRecord) => {
    // 1. Explicit title if provided
    if (tx.titulo_resumen && tx.titulo_resumen.trim().length > 0) {
      if (tx.items.length > 1 && !tx.titulo_resumen.toLowerCase().includes('ítem') && !tx.titulo_resumen.toLowerCase().includes('item')) {
        return `${tx.titulo_resumen} (${tx.items.length} ítems)`;
      }
      return tx.titulo_resumen;
    }

    // 2. Store / Comercio detected
    if (tx.comercio && tx.comercio.trim().length > 0) {
      if (tx.items.length > 1) {
        return `${tx.comercio} (${tx.items.length} ítems)`;
      }
      return tx.comercio;
    }

    // 3. Fallback summary for multiple items without store name
    if (tx.items && tx.items.length > 1) {
      const categories = tx.items.map((i) => i.categoria_principal);
      if (categories.some((c) => c.toLowerCase().includes('aliment') || c.toLowerCase().includes('dieta'))) {
        return `Víveres y supermercado (${tx.items.length} ítems)`;
      }
      if (categories.some((c) => c.toLowerCase().includes('tecnolog') || c.toLowerCase().includes('crédito'))) {
        return `Productos de tecnología (${tx.items.length} ítems)`;
      }
      return `Compra desglosada (${tx.items.length} ítems)`;
    }

    // 4. Single item concept
    return tx.items[0]?.concepto || 'Transacción';
  };

  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch =
      t.mensaje_usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.comercio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.titulo_resumen?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.items.some((i) => i.concepto.toLowerCase().includes(searchTerm.toLowerCase()));

    // Exclude pending commitments from general transaction history unless explicitly selected
    if (filterType !== 'PENDIENTE' && filterType !== 'TODOS') {
      if (t.estado_pago === 'PENDIENTE') return false;
    }

    let matchesType = true;
    if (filterType === 'GASTO') {
      matchesType = t.tipo_operacion === 'GASTO';
    } else if (filterType === 'INGRESO') {
      matchesType = t.tipo_operacion === 'INGRESO';
    } else if (filterType === 'GASTO_FIJO') {
      matchesType = t.tipo_operacion === 'GASTO' && (t.es_gasto_fijo === true || t.items.some((i) => i.categoria_principal === 'Servicios y Gastos Fijos'));
    } else if (filterType === 'GASTO_PUNTUAL') {
      matchesType = t.tipo_operacion === 'GASTO' && t.es_gasto_fijo !== true && !t.items.some((i) => i.categoria_principal === 'Servicios y Gastos Fijos');
    } else if (filterType === 'PENDIENTE') {
      matchesType = t.estado_pago === 'PENDIENTE';
    }

    return matchesSearch && matchesType;
  });

  // Sort transactions by date descending (most recent to oldest)
  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    const dateA = normalizeDateToISO(a.fecha);
    const dateB = normalizeDateToISO(b.fecha);
    const dateComparison = dateB.localeCompare(dateA);
    if (dateComparison !== 0) {
      return dateComparison;
    }
    return (b.id || '').localeCompare(a.id || '');
  });

  // Group transactions by date
  const groupedTransactions: { date: string; items: TransactionRecord[] }[] = [];
  sortedTransactions.forEach((tx) => {
    const dateKey = normalizeDateToISO(tx.fecha);
    const lastGroup = groupedTransactions[groupedTransactions.length - 1];
    if (lastGroup && lastGroup.date === dateKey) {
      lastGroup.items.push(tx);
    } else {
      groupedTransactions.push({ date: dateKey, items: [tx] });
    }
  });

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const executedCount = transactions.filter((t) => t.estado_pago !== 'PENDIENTE').length;
  const pendingCount = transactions.filter((t) => t.estado_pago === 'PENDIENTE').length;

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-sm flex flex-col mb-6 overflow-hidden">
      <div className="p-3.5 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-800">
            Historial de Operaciones
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {filterType === 'ALL'
              ? `${executedCount} movimientos ejecutados • Orden cronológico`
              : filterType === 'PENDIENTE'
              ? `${pendingCount} compromisos pendientes de pago`
              : `${filteredTransactions.length} registros mostrados`}
          </p>
        </div>

        {/* Filters & Search */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 sm:flex-initial sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-sm outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="flex-1 sm:flex-initial px-2 py-1.5 bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-sm outline-none font-medium cursor-pointer"
          >
            <option value="ALL">Ejecutados ({executedCount})</option>
            <option value="GASTO">Gastos</option>
            <option value="INGRESO">Ingresos</option>
            <option value="GASTO_FIJO">Gastos Fijos</option>
            <option value="GASTO_PUNTUAL">Compras Únicas</option>
            <option value="PENDIENTE">Pendientes ({pendingCount})</option>
            <option value="TODOS">Todos ({transactions.length})</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {groupedTransactions.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-xs italic">
          No se encontraron registros que coincidan con la búsqueda.
        </div>
      ) : (
        <div className="divide-y divide-slate-200">
          {groupedTransactions.map((group) => {
            const { title, relative } = formatDateGroupHeader(group.date);

            return (
              <div key={group.date} className="bg-white">
                {/* Encabezado de Fecha del Grupo */}
                <div className="px-3.5 sm:px-5 py-1.5 sm:py-2 bg-slate-50/95 border-y border-slate-200/80 flex items-center justify-between sticky top-0 z-10">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-800 tracking-tight">{title}</span>
                    {relative && (
                      <span
                        className={`text-[9px] sm:text-[10px] font-extrabold px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                          relative === 'Hoy'
                            ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {relative}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-medium ml-1">
                      ({group.items.length})
                    </span>
                  </div>
                </div>

                {/* Lista de transacciones en este día */}
                <div className="divide-y divide-slate-100">
                  {group.items.map((tx) => {
                    const isExpanded = expandedId === tx.id;
                    const mainCategory = tx.items[0]?.categoria_principal || 'General';
                    const mainSubcategory = tx.items[0]?.subcategoria || '';

                    return (
                      <div
                        key={tx.id}
                        className={`transition-colors ${
                          tx.alerta_ahorro_comprometido ? 'bg-rose-50/30' : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* Compact Transaction Row */}
                        <div
                          onClick={() => toggleExpand(tx.id)}
                          className="px-3 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between cursor-pointer gap-2.5"
                        >
                          {/* Left: Icon + Title & Metadata */}
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div
                              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-sm flex items-center justify-center shrink-0 font-bold text-xs ${
                                tx.tipo_operacion === 'INGRESO'
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                  : tx.metodo_pago === 'CREDITO'
                                  ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {tx.tipo_operacion === 'INGRESO' ? (
                                <ArrowDownLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              ) : tx.metodo_pago === 'CREDITO' ? (
                                <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              ) : (
                                <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              {/* Title */}
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                                  {getDisplayTitle(tx)}
                                </span>
                              </div>

                              {/* Compact Meta Tags Row */}
                              <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap mt-0.5">
                                {tx.comercio ? (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-emerald-50 text-emerald-700 text-[9px] sm:text-[10px] font-semibold rounded-xs border border-emerald-200 truncate max-w-[120px]">
                                    <Store className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                    <span className="truncate">{tx.comercio}</span>
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[9px] sm:text-[10px] font-medium rounded-xs border border-slate-200 truncate max-w-[120px]">
                                    {mainSubcategory && mainSubcategory !== 'General' ? mainSubcategory : mainCategory}
                                  </span>
                                )}

                                {/* Payment Method Tag */}
                                <span
                                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[9px] sm:text-[10px] font-medium rounded-xs border ${
                                    tx.metodo_pago === 'CREDITO'
                                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                      : tx.metodo_pago === 'DEBITO'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : 'bg-slate-100 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  {tx.metodo_pago === 'CREDITO'
                                    ? tx.entidad_financiera && tx.entidad_financiera !== 'Tarjeta de Crédito'
                                      ? `Crédito (${tx.entidad_financiera})`
                                      : 'Crédito'
                                    : tx.metodo_pago === 'DEBITO'
                                    ? tx.entidad_financiera && tx.entidad_financiera !== 'Tarjeta de Débito'
                                      ? `Débito (${tx.entidad_financiera})`
                                      : 'Débito'
                                    : 'Efectivo'}
                                </span>

                                {/* Recurring / Fixed indicator */}
                                {tx.es_gasto_fijo && (
                                  <span className="px-1 py-0.2 bg-purple-50 text-purple-700 text-[9px] font-bold rounded-xs border border-purple-200">
                                    Fijo
                                  </span>
                                )}

                                {/* Pending indicator */}
                                {tx.estado_pago === 'PENDIENTE' && (
                                  <span className="px-1 py-0.2 bg-amber-50 text-amber-800 text-[9px] font-bold rounded-xs border border-amber-300">
                                    Pendiente
                                  </span>
                                )}

                                {/* Installments info */}
                                {tx.cuotas > 1 && (
                                  <span className="px-1 py-0.2 bg-indigo-50 text-indigo-800 text-[9px] font-bold rounded-xs border border-indigo-200">
                                    {tx.cuota_actual || 1}/{tx.cuotas}c
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right: Amount & Expand Arrow */}
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              {tx.metodo_pago === 'CREDITO' && tx.cuotas > 1 ? (
                                <>
                                  <div className="font-mono font-bold text-xs sm:text-sm text-indigo-700 whitespace-nowrap">
                                    - {monedaSimbolo} {tx.monto_cuota_mensual.toFixed(2)}
                                  </div>
                                  <div className="text-[9px] font-mono text-slate-400 whitespace-nowrap">
                                    {tx.cuotas} cuotas
                                  </div>
                                </>
                              ) : (
                                <div
                                  className={`font-mono font-bold text-xs sm:text-sm whitespace-nowrap ${
                                    tx.tipo_operacion === 'INGRESO'
                                      ? 'text-emerald-600'
                                      : 'text-slate-900'
                                  }`}
                                >
                                  {tx.tipo_operacion === 'INGRESO' ? '+' : '-'} {monedaSimbolo}{' '}
                                  {tx.monto_total.toFixed(2)}
                                </div>
                              )}
                            </div>

                            <div className="text-slate-400 p-0.5">
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Details Panel */}
                        {isExpanded && (
                          <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50 text-xs space-y-3">
                            {/* Quick Action Badges Bar */}
                            <div className="flex flex-wrap items-center gap-1.5 pb-1">
                              {/* Payment Switch Button */}
                              {tx.tipo_operacion === 'GASTO' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const nextMetodo = tx.metodo_pago === 'EFECTIVO' ? 'DEBITO' : tx.metodo_pago === 'DEBITO' ? 'CREDITO' : 'EFECTIVO';
                                    onUpdateTransaction?.(tx.id, {
                                      metodo_pago: nextMetodo,
                                      cuotas: 1,
                                      cuota_actual: 1,
                                      cuotas_restantes: 0,
                                      monto_cuota_mensual: tx.monto_total,
                                      entidad_financiera: nextMetodo === 'CREDITO' ? (tx.entidad_financiera || 'Tarjeta de Crédito') : undefined,
                                    });
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-bold rounded-xs border border-slate-200 transition-colors cursor-pointer"
                                  title="Cambiar método de pago"
                                >
                                  <CreditCard className="w-3 h-3 text-indigo-600" />
                                  <span>Método: {tx.metodo_pago}</span>
                                </button>
                              )}

                              {/* Gasto Fijo / Puntual Switch */}
                              {tx.tipo_operacion === 'GASTO' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onUpdateTransaction?.(tx.id, {
                                      es_gasto_fijo: !tx.es_gasto_fijo,
                                      frecuencia_recurrencia: tx.es_gasto_fijo ? 'PUNTUAL' : 'MENSUAL',
                                    });
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-bold rounded-xs border border-slate-200 transition-colors cursor-pointer"
                                >
                                  <RotateCw className="w-3 h-3 text-purple-600" />
                                  <span>{tx.es_gasto_fijo ? 'Gasto Fijo Mensual' : 'Compra Única'}</span>
                                </button>
                              )}

                              {/* Mark as Pagado if Pending */}
                              {tx.tipo_operacion === 'GASTO' && tx.estado_pago === 'PENDIENTE' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onUpdateTransaction?.(tx.id, {
                                      estado_pago: 'PAGADO',
                                    });
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-xs border border-emerald-300 transition-colors cursor-pointer"
                                >
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>Marcar como Pagado</span>
                                </button>
                              )}

                              {/* Delete Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteTransaction(tx.id);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold rounded-xs border border-rose-200 transition-colors cursor-pointer ml-auto"
                              >
                                <Trash2 className="w-3 h-3 text-rose-600" />
                                <span>Eliminar</span>
                              </button>
                            </div>

                            {/* 1. Origen / Nota del Registro */}
                            {tx.mensaje_usuario && (
                              <div className="p-2.5 bg-white border border-slate-200 rounded-xs flex items-start gap-2">
                                <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold text-[9px] text-slate-400 uppercase tracking-wider block">
                                    Nota original registrada:
                                  </span>
                                  <p className="text-slate-800 font-medium italic mt-0.5 text-xs">
                                    "{tx.mensaje_usuario}"
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* 2. Panel de Edición Rápida */}
                            {onUpdateTransaction && (
                              <div className="p-3 bg-white border border-slate-200 rounded-xs space-y-2.5">
                                <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 pb-1.5 border-b border-slate-100">
                                  <SlidersHorizontal className="w-3 h-3 text-indigo-600" />
                                  <span>Edición Rápida</span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                                  {/* Campo Fecha */}
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                      Fecha
                                    </label>
                                    <input
                                      type="date"
                                      value={tx.fecha}
                                      onChange={(e) => {
                                        onUpdateTransaction(tx.id, { fecha: e.target.value });
                                      }}
                                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-xs text-xs font-mono font-medium text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                  </div>

                                  {/* Campo Monto Total */}
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                      Monto Total ({monedaSimbolo})
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={tx.monto_total}
                                      onChange={(e) => {
                                        const newMonto = parseFloat(e.target.value) || 0;
                                        const newCuotas = tx.cuotas || 1;
                                        const updatedItems = tx.items.map((it, idx) => {
                                          if (idx === 0) {
                                            return { ...it, monto: newMonto };
                                          }
                                          return it;
                                        });
                                        onUpdateTransaction(tx.id, {
                                          monto_total: newMonto,
                                          monto_cuota_mensual: newCuotas > 0 ? newMonto / newCuotas : newMonto,
                                          items: updatedItems,
                                        });
                                      }}
                                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-xs text-xs font-mono font-bold text-slate-900 outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                  </div>

                                  {/* Campo Comercio / Tienda */}
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                      Comercio / Tienda
                                    </label>
                                    <input
                                      type="text"
                                      value={tx.comercio || ''}
                                      placeholder="Ej. Metro, Tottus, Bembos..."
                                      onChange={(e) => {
                                        onUpdateTransaction(tx.id, { comercio: e.target.value });
                                      }}
                                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-xs text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                  </div>

                                  {/* Campo Banco / Entidad */}
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                      Banco / Entidad
                                    </label>
                                    <input
                                      type="text"
                                      value={tx.entidad_financiera || ''}
                                      placeholder="Ej. BCP, BBVA, Interbank"
                                      onChange={(e) => {
                                        onUpdateTransaction(tx.id, { entidad_financiera: e.target.value || undefined });
                                      }}
                                      className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-xs text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* 3. Ítems Desglosados */}
                            <div className="p-2.5 bg-white border border-slate-200 rounded-xs space-y-1.5">
                              <span className="font-bold text-[10px] text-slate-700 uppercase tracking-wider block">
                                Ítems Desglosados ({tx.items.length})
                              </span>
                              <div className="space-y-1">
                                {tx.items.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between p-1.5 bg-slate-50 border border-slate-100 rounded-xs text-xs"
                                  >
                                    <div className="min-w-0 pr-2">
                                      <span className="font-semibold text-slate-900 block truncate">
                                        {item.concepto}
                                      </span>
                                      <span className="text-[10px] text-slate-400">
                                        {item.categoria_principal} › {item.subcategoria}
                                      </span>
                                    </div>
                                    <span className="font-mono font-bold text-slate-900 shrink-0">
                                      {monedaSimbolo} {item.monto.toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

