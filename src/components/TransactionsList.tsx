import React, { useState } from 'react';
import {
  Trash2,
  Search,
  CreditCard,
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
} from 'lucide-react';
import { TransactionRecord } from '../types';

interface TransactionsListProps {
  transactions: TransactionRecord[];
  onDeleteTransaction: (id: string) => void;
  onUpdateTransaction?: (id: string, updatedFields: Partial<TransactionRecord>) => void;
  monedaSimbolo: string;
}

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

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-sm flex flex-col mb-6 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-800">
            Historial de Operaciones
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {transactions.length} registros almacenados
          </p>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar..."
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-sm outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 text-xs text-slate-700 rounded-sm outline-none font-medium cursor-pointer"
          >
            <option value="ALL">Movimientos Ejecutados en Banco</option>
            <option value="GASTO">Gastos Ejecutados</option>
            <option value="GASTO_FIJO">📌 Gastos Fijos Recurrentes</option>
            <option value="GASTO_PUNTUAL">🛒 Compras Únicas</option>
            <option value="INGRESO">Ingresos</option>
            <option value="PENDIENTE">⏳ Compromisos Pendientes de Pago</option>
            <option value="TODOS">Todos (Ejecutados + Pendientes)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {filteredTransactions.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-xs italic">
          No se encontraron registros que coincidan con la búsqueda.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {filteredTransactions.map((tx) => {
            const isExpanded = expandedId === tx.id;
            const mainCategory = tx.items[0]?.categoria_principal || 'General';

            return (
              <div
                key={tx.id}
                className={`transition-colors ${
                  tx.alerta_ahorro_comprometido ? 'bg-rose-50/30' : 'hover:bg-slate-50'
                }`}
              >
                <div
                  onClick={() => toggleExpand(tx.id)}
                  className="px-6 py-4 flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 font-bold text-xs ${
                        tx.tipo_operacion === 'INGRESO'
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                          : tx.metodo_pago === 'CREDITO'
                          ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {tx.tipo_operacion === 'INGRESO' ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : tx.metodo_pago === 'CREDITO' ? (
                        <CreditCard className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900">
                          {getDisplayTitle(tx)}
                        </span>

                        {tx.comercio && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-sm border border-emerald-200">
                            <Store className="w-3 h-3 text-emerald-600" />
                            {tx.comercio}
                          </span>
                        )}

                        {tx.entidad_financiera && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-sm border border-indigo-200">
                            <CreditCard className="w-3 h-3 text-indigo-600" />
                            {tx.entidad_financiera}
                          </span>
                        )}

                        {tx.tipo_operacion === 'GASTO' && (
                          tx.estado_pago === 'PENDIENTE' ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateTransaction?.(tx.id, {
                                  estado_pago: 'PAGADO',
                                });
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-900 hover:bg-amber-200 text-[10px] font-bold rounded-sm border border-amber-300 transition-colors cursor-pointer"
                              title="Haz clic para marcar como Pagado hoy (descuenta del banco)"
                            >
                              <Clock className="w-3 h-3 text-amber-700" />
                              Pendiente (Día {tx.dia_pago_mensual || 21}) — Marcar Pagado
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateTransaction?.(tx.id, {
                                  estado_pago: 'PENDIENTE',
                                  dia_pago_mensual: tx.dia_pago_mensual || 21,
                                });
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-[10px] font-bold rounded-sm border border-emerald-200 transition-colors cursor-pointer"
                              title="Transacción ya ejecutada (Haz clic para cambiar a Pendiente)"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Pagado / Ejecutado
                            </button>
                          )
                        )}

                        {tx.tipo_operacion === 'GASTO' && (
                          tx.es_gasto_fijo ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateTransaction?.(tx.id, {
                                  es_gasto_fijo: false,
                                  frecuencia_recurrencia: 'PUNTUAL',
                                });
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-800 hover:bg-purple-200 text-[10px] font-bold rounded-sm border border-purple-300 transition-colors cursor-pointer"
                              title="Haz clic para cambiar a Compra Única"
                            >
                              <RotateCw className="w-3 h-3 text-purple-600" />
                              Gasto Fijo Mensual
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateTransaction?.(tx.id, {
                                  es_gasto_fijo: true,
                                  frecuencia_recurrencia: 'MENSUAL',
                                });
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 hover:bg-slate-200 text-[10px] font-bold rounded-sm border border-slate-200 transition-colors cursor-pointer"
                              title="Haz clic para cambiar a Gasto Fijo Mensual"
                            >
                              <ShoppingBag className="w-3 h-3 text-slate-400" />
                              Compra Única
                            </button>
                          )
                        )}

                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded-sm border border-slate-200">
                          {mainCategory}
                        </span>

                        {(tx.cuotas > 1 || (tx.cuota_actual && tx.cuota_actual > 1)) && (
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold uppercase rounded-sm border border-indigo-200">
                            Cuota {tx.cuota_actual || 1}/{tx.cuotas}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {tx.fecha}
                        </span>
                        <span>•</span>
                        <span className="font-bold uppercase text-[10px] tracking-wider text-slate-500">
                          {tx.metodo_pago}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      {tx.metodo_pago === 'CREDITO' && tx.cuotas > 1 ? (
                        <>
                          <div className="font-mono font-bold text-sm md:text-base text-indigo-700">
                            - {monedaSimbolo} {tx.monto_cuota_mensual.toFixed(2)} / mes
                          </div>
                          <div className="text-[10px] font-mono font-semibold text-slate-400">
                            Total: {monedaSimbolo} {tx.monto_total.toFixed(2)} ({tx.cuotas} cuotas)
                          </div>
                        </>
                      ) : (
                        <div
                          className={`font-mono font-bold text-sm md:text-base ${
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

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTransaction(tx.id);
                      }}
                      className="p-1.5 text-slate-300 hover:text-rose-600 rounded-sm hover:bg-rose-50 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-4 border-t border-slate-100 bg-slate-50/80 text-xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white border border-slate-200 rounded-sm">
                      <div className="text-slate-700 font-sans italic">
                        "{tx.mensaje_usuario}"
                      </div>
                      {onUpdateTransaction && (
                        <div className="flex items-center gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-indigo-600" />
                            Editar Fecha:
                          </label>
                          <input
                            type="date"
                            value={tx.fecha}
                            onChange={(e) => {
                              if (e.target.value) {
                                onUpdateTransaction(tx.id, { fecha: e.target.value });
                              }
                            }}
                            className="bg-slate-50 border border-slate-200 text-xs px-2 py-1 rounded-sm outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-400 uppercase tracking-widest text-[10px] mb-1.5">
                        Ítems Desglosados:
                      </h4>
                      <div className="space-y-1">
                        {tx.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-sm"
                          >
                            <div className="flex items-center gap-2">
                              <Tag className="w-3 h-3 text-indigo-600" />
                              <span className="font-medium text-slate-900">
                                {item.concepto}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                ({item.categoria_principal} › {item.subcategoria})
                              </span>
                            </div>
                            <span className="font-mono font-bold text-slate-900">
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
      )}
    </div>
  );
};

