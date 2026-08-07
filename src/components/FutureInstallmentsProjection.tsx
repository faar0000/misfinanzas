import React, { useState } from 'react';
import { CreditCard, Calendar, CheckCircle2, Building2, Filter, Repeat, ShoppingBag, ShieldCheck, HelpCircle, Clock, ChevronDown, ChevronUp, X } from 'lucide-react';
import { TransactionRecord } from '../types';
import { getLatestFixedExpenses, getRecurringConceptKey } from '../lib/financial';

interface FutureInstallmentsProjectionProps {
  transactions: TransactionRecord[];
  monedaSimbolo: string;
  ingresoMensual: number;
  onUpdateTransaction?: (id: string, updatedFields: Partial<TransactionRecord>) => void;
  onCancelFixedExpense?: (tx: TransactionRecord) => void;
}

export const FutureInstallmentsProjection: React.FC<FutureInstallmentsProjectionProps> = ({
  transactions,
  monedaSimbolo,
  ingresoMensual,
  onUpdateTransaction,
  onCancelFixedExpense,
}) => {
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [showCriteriaInfo, setShowCriteriaInfo] = useState<boolean>(false);
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

  const toggleMonthExpand = (key: string) => {
    setExpandedMonths((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const [confirmCancelTx, setConfirmCancelTx] = useState<TransactionRecord | null>(null);

  // 1. Identify Gastos Fijos Recurrentes Mensuales strictly using the last paid month value for variable services (Rent, Utilities, Subscriptions, Maintenance, etc.)
  const rawFixedExpensesList = getLatestFixedExpenses(transactions);
  const fixedExpensesList = rawFixedExpensesList.filter(
    (tx) => tx.es_gasto_fijo !== false
  );

  const totalFixedMonthlyAmount = fixedExpensesList.reduce(
    (sum, tx) => sum + (tx.monto_total || 0),
    0
  );

  // 2. Filter all credit card transactions with cuotas or credit payment method
  const creditTxList = transactions.filter(
    (t) =>
      t.tipo_operacion === 'GASTO' &&
      (t.metodo_pago === 'CREDITO' ||
        t.cuotas > 1 ||
        (t.cuota_actual && t.cuota_actual > 1) ||
        (t.cuotas_restantes && t.cuotas_restantes > 0))
  );

  // Group credit by financial entity
  const entitiesMap: { [key: string]: { count: number; monthlyTotal: number } } = {};

  creditTxList.forEach((tx) => {
    const entity = tx.entidad_financiera?.trim() || 'Tarjeta de Crédito Generica';
    if (!entitiesMap[entity]) {
      entitiesMap[entity] = { count: 0, monthlyTotal: 0 };
    }
    entitiesMap[entity].count += 1;
    entitiesMap[entity].monthlyTotal += tx.monto_cuota_mensual;
  });

  const availableEntities = Object.keys(entitiesMap);

  // Filter by selected bank/entity if applied
  const filteredCreditTxs = creditTxList.filter((tx) => {
    if (selectedEntity === 'ALL') return true;
    const entity = tx.entidad_financiera?.trim() || 'Tarjeta de Crédito Generica';
    return entity === selectedEntity;
  });

  // Calculate monthly projection for future 6 months
  const monthsAhead = 6;
  const currentMonthDate = new Date();

  const monthlyProjections: {
    monthName: string;
    totalCuotas: number;
    totalFixedExpenses: number;
    totalMonthlyCommitments: number;
    itemsList: {
      concepto: string;
      cuotaActual: number;
      totalCuotas: number;
      montoCuota: number;
      entidad: string;
    }[];
  }[] = [];

  for (let i = 0; i < monthsAhead; i++) {
    const targetDate = new Date(
      currentMonthDate.getFullYear(),
      currentMonthDate.getMonth() + i,
      1
    );

    const monthName = targetDate.toLocaleDateString('es-PE', {
      month: 'long',
      year: 'numeric',
    });

    let totalCuotas = 0;
    const itemsList: {
      concepto: string;
      cuotaActual: number;
      totalCuotas: number;
      montoCuota: number;
      entidad: string;
    }[] = [];

    filteredCreditTxs.forEach((tx) => {
      const cuotaInicial = tx.cuota_actual || 1;
      const cuotaActualMes = cuotaInicial + i;

      if (cuotaActualMes <= tx.cuotas) {
        totalCuotas += tx.monto_cuota_mensual;
        itemsList.push({
          concepto: tx.titulo_resumen || tx.items[0]?.concepto || 'Compra en cuotas',
          cuotaActual: cuotaActualMes,
          totalCuotas: tx.cuotas,
          montoCuota: tx.monto_cuota_mensual,
          entidad: tx.entidad_financiera || 'Tarjeta Crédito',
        });
      }
    });

    const totalMonthlyCommitments = totalFixedMonthlyAmount + totalCuotas;

    monthlyProjections.push({
      monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1),
      totalCuotas,
      totalFixedExpenses: totalFixedMonthlyAmount,
      totalMonthlyCommitments,
      itemsList,
    });
  }

  const metaAhorro = ingresoMensual * 0.1;

  return (
    <div className="space-y-6 mb-6">
      {/* 1. GASTOS FIJOS RECURRENTES IDENTIFICADOS CARD */}
      <div className="bg-white border border-purple-200 rounded-sm shadow-xs p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-purple-100 mb-5 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-700 rounded-sm flex items-center justify-center text-white shrink-0">
              <Repeat className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-800">
                  Gastos Fijos Recurrentes Identificados
                </h2>
                <button
                  type="button"
                  onClick={() => setShowCriteriaInfo(!showCriteriaInfo)}
                  title={showCriteriaInfo ? "Ocultar criterios" : "Ver criterios de análisis de gastos fijos"}
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold transition-all cursor-pointer shrink-0 border ${
                    showCriteriaInfo
                      ? 'bg-amber-500 text-white border-amber-600 shadow-xs ring-2 ring-amber-300'
                      : 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                  }`}
                >
                  ?
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Gastos fijos que se realizan todos los meses (Alquiler, Servicios, Mantenimiento, Suscripciones)
              </p>
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-sm text-right">
            <span className="text-[10px] text-purple-700 font-bold uppercase block">
              Total Gastos Fijos Mensuales
            </span>
            <span className="font-mono font-bold text-sm text-purple-900">
              {monedaSimbolo} {totalFixedMonthlyAmount.toFixed(2)} / mes
            </span>
          </div>
        </div>

        {showCriteriaInfo && (
          <div className="bg-amber-50/90 border border-amber-200 p-3 rounded-sm mb-4 text-[11px] text-amber-900 flex items-start justify-between gap-3 shadow-xs animate-fadeIn">
            <div className="flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div>
                  <strong>Criterio de Análisis de Caja:</strong> Compras de artículos de limpieza, aseo personal, abarrotes o insumos del hogar que se efectúan cada 2 o 3 meses se clasifican como <em>compras puntuales/ocasionales</em>. De este modo, <strong>no distorsionan ni recargan el presupuesto de gastos fijos ineludibles todos los meses</strong>.
                </div>
                <div className="text-purple-950 font-medium">
                  💡 <strong>Proyección con Último Pago Registrado:</strong> Para gastos fijos variables (Departamento, Luz, Agua, Mantenimiento, etc.), la proyección de los siguientes meses utiliza automáticamente el <strong>monto del último pago realizado</strong> en el sistema.
                </div>
                <div className="text-indigo-950 font-medium">
                  💳 <strong>Compras en Tarjeta de Crédito:</strong> Las compras en cuotas con tarjeta son <em>compras únicas diferidas en el tiempo</em>. No se recargan en Gastos Fijos Recurrentes, sino que se proyectan independientemente en el módulo de <strong>Compromisos a Cuotas y Pagos Futuros</strong>.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowCriteriaInfo(false)}
              className="text-amber-700 hover:text-amber-950 text-xs font-bold p-1 rounded-xs hover:bg-amber-200/50 transition-colors shrink-0 cursor-pointer"
              title="Cerrar panel de criterios"
            >
              ✕
            </button>
          </div>
        )}

        {fixedExpensesList.length === 0 ? (
          <div className="text-center py-6 bg-slate-50 rounded-sm border border-slate-200 text-slate-400 text-xs">
            No tienes gastos fijos identificados. Puedes marcar cualquier gasto en el historial como "Gasto Fijo Mensual".
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {fixedExpensesList.map((tx) => {
                const title = tx.titulo_resumen || tx.items[0]?.concepto || 'Gasto Fijo';
                const subCat = tx.items[0]?.subcategoria || tx.items[0]?.categoria_principal || 'Servicios';
                const isPendiente = tx.estado_pago === 'PENDIENTE';
                const dueDay = tx.dia_pago_mensual || 21;

                return (
                  <div
                    key={tx.id}
                    className={`p-3.5 border rounded-sm flex items-center justify-between relative group transition-shadow hover:shadow-xs ${
                      isPendiente
                        ? 'bg-amber-50/60 border-amber-300'
                        : 'bg-purple-50/40 border-purple-200'
                    }`}
                  >
                    {/* Botón X arriba del box para cancelar el gasto fijo / suscripción */}
                    <button
                      type="button"
                      onClick={() => setConfirmCancelTx(tx)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-rose-600 hover:bg-rose-700 active:scale-90 text-white rounded-full flex items-center justify-center shadow-md cursor-pointer transition-all z-20 border-2 border-white"
                      title={`Cancelar gasto fijo / suscripción (${title})`}
                    >
                      <X className="w-3 h-3 stroke-[3]" />
                    </button>

                    <div>
                      <div className="font-bold text-xs text-slate-900 truncate max-w-[150px] sm:max-w-[170px] flex items-center gap-1.5">
                        <span>{title}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                        <span>{subCat}</span>
                        <span>•</span>
                        <span className={isPendiente ? 'text-amber-800 font-bold' : 'text-emerald-700 font-bold'}>
                          {isPendiente ? `Paga día ${dueDay}` : 'Pagado'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end gap-1">
                      <div className="font-mono font-bold text-xs text-slate-900">
                        {monedaSimbolo} {tx.monto_total.toFixed(2)}
                      </div>
                      {onUpdateTransaction && (
                        <div className="flex items-center gap-1.5">
                          {isPendiente ? (
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateTransaction(tx.id, {
                                  estado_pago: 'PAGADO',
                                })
                              }
                              className="px-1.5 py-0.5 bg-emerald-600 text-white hover:bg-emerald-700 text-[9px] font-bold rounded-xs cursor-pointer flex items-center gap-1 shadow-2xs"
                              title="Haz clic cuando hayas realizado el pago"
                            >
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              Marcar Pagado
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateTransaction(tx.id, {
                                  estado_pago: 'PENDIENTE',
                                  dia_pago_mensual: dueDay,
                                })
                              }
                              className="text-[9px] text-emerald-700 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                            >
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                              Pagado
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. PROYECCION DE CAJA FUTURA (GASTOS FIJOS + CUOTAS DE CREDITO) */}
      <div className="bg-white border border-slate-200 rounded-sm shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 mb-5 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-sm flex items-center justify-center text-white shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-800">
                Proyección de Caja Futura (Gastos Fijos + Cuotas de Crédito)
              </h2>
              <p className="text-[11px] text-slate-400">
                Proyección mensual consolidada de compromisos fijos y dinero libre para los próximos 6 meses
              </p>
            </div>
          </div>

          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-sm bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
            {creditTxList.length} cuotas activas + {fixedExpensesList.length} gastos fijos
          </span>
        </div>

        {/* Summary Cards by Financial Entity / Bank if credit cards exist */}
        {creditTxList.length > 0 && (
          <div className="mb-6">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Resumen de Tarjetas de Crédito por Banco / Entidad:</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {availableEntities.map((entity) => {
                const isSelected = selectedEntity === entity;
                const data = entitiesMap[entity];
                return (
                  <button
                    key={entity}
                    onClick={() => setSelectedEntity(isSelected ? 'ALL' : entity)}
                    className={`p-3 rounded-sm border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-900 text-white border-indigo-900 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-bold truncate ${isSelected ? 'text-indigo-200' : 'text-indigo-600'}`}>
                        {entity}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-xs font-bold ${
                        isSelected ? 'bg-indigo-800 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {data.count} {data.count === 1 ? 'cuota' : 'cuotas'}
                      </span>
                    </div>

                    <div className="font-mono font-bold text-sm">
                      {monedaSimbolo} {data.monthlyTotal.toFixed(2)}{' '}
                      <span className={`text-[10px] font-sans font-normal ${isSelected ? 'text-indigo-300' : 'text-slate-400'}`}>
                        / mes
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Filter Bar */}
        {availableEntities.length > 1 && (
          <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-sm border border-slate-200 mb-5">
            <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Filtrar cuotas por tarjeta:</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedEntity('ALL')}
                className={`px-2.5 py-1 rounded-sm text-xs font-semibold cursor-pointer transition-colors ${
                  selectedEntity === 'ALL'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                Todas ({creditTxList.length})
              </button>
              {availableEntities.map((entity) => (
                <button
                  key={entity}
                  onClick={() => setSelectedEntity(entity)}
                  className={`px-2.5 py-1 rounded-sm text-xs font-semibold cursor-pointer transition-colors ${
                    selectedEntity === entity
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  {entity}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Monthly Projections Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {monthlyProjections.map((proj, idx) => {
            const dineroLibreEstimadoMes = ingresoMensual - metaAhorro - proj.totalMonthlyCommitments;
            const estaEnRiesgo = dineroLibreEstimadoMes < 0;
            const monthKey = `month-${idx}`;
            const isExpanded = !!expandedMonths[monthKey];

            return (
              <div
                key={idx}
                className={`p-4 rounded-sm border transition-colors ${
                  estaEnRiesgo
                    ? 'bg-rose-50/50 border-rose-200'
                    : idx === 0
                    ? 'bg-indigo-50/30 border-indigo-200'
                    : 'bg-slate-50/80 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{proj.monthName}</span>
                    {idx === 0 && (
                      <span className="text-[9px] bg-indigo-600 text-white px-1.5 py-0.2 rounded-xs uppercase font-bold tracking-wider">
                        Mes actual
                      </span>
                    )}
                  </div>

                  <span className="font-mono font-bold text-sm text-slate-900">
                    {monedaSimbolo} {proj.totalMonthlyCommitments.toFixed(2)}
                  </span>
                </div>

                <div className="text-[11px] bg-white p-2.5 rounded-sm border border-slate-200 mb-3 space-y-1">
                  <div className="flex justify-between text-purple-900">
                    <span>Gastos Fijos Recurrentes:</span>
                    <strong className="font-mono">{monedaSimbolo} {proj.totalFixedExpenses.toFixed(2)}</strong>
                  </div>
                  <div className="flex justify-between text-indigo-900">
                    <span>Cuotas Crédito ({proj.itemsList.length}):</span>
                    <strong className="font-mono">{monedaSimbolo} {proj.totalCuotas.toFixed(2)}</strong>
                  </div>
                  <div className="pt-1 border-t border-slate-100 flex justify-between font-bold">
                    <span>Dinero Libre Proyectado:</span>
                    <strong
                      className={
                        estaEnRiesgo
                          ? 'text-rose-600 font-mono font-bold'
                          : 'text-emerald-600 font-mono font-bold'
                      }
                    >
                      {monedaSimbolo} {dineroLibreEstimadoMes.toFixed(2)}
                    </strong>
                  </div>
                </div>

                {proj.itemsList.length === 0 ? (
                  <div className="text-[11px] text-slate-400 italic">
                    Sin cuotas de tarjeta adicionales para este mes
                  </div>
                ) : (
                  <div>
                    <button
                      type="button"
                      onClick={() => toggleMonthExpand(monthKey)}
                      className="w-full flex items-center justify-between p-2 rounded-sm bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition-colors cursor-pointer shadow-2xs"
                    >
                      <span className="flex items-center gap-1.5 text-indigo-900 font-bold">
                        <CreditCard className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="truncate">
                          {isExpanded ? 'Ocultar detalle de cuotas' : `Ver cuotas de crédito (${proj.itemsList.length})`}
                        </span>
                      </span>
                      <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-indigo-700 shrink-0">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-500" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="mt-2 space-y-2 pt-2 border-t border-slate-200/80 animate-fadeIn">
                        {proj.itemsList.map((item, itemIdx) => (
                          <div
                            key={itemIdx}
                            className="p-2.5 bg-white rounded-sm border border-slate-200 text-[11px] shadow-2xs hover:border-indigo-200 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-slate-900 truncate max-w-[140px]">
                                {item.concepto}
                              </span>
                              <span className="font-mono font-bold text-slate-900">
                                {monedaSimbolo} {item.montoCuota.toFixed(2)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-1 text-[10px]">
                              <span className="text-indigo-600 font-semibold bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-xs truncate max-w-[120px]">
                                {item.entidad}
                              </span>
                              <span className="text-indigo-800 font-bold uppercase tracking-wider bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-xs">
                                Cuota {item.cuotaActual}/{item.totalCuotas}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de confirmación para cancelar gasto fijo / suscripción */}
      {confirmCancelTx && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full p-5 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-2">
              <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <X className="w-5 h-5 stroke-[2.5]" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Cancelar Gasto Fijo / Suscripción</h3>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              ¿Deseas cancelar el gasto fijo o suscripción{' '}
              <strong className="text-slate-900 font-bold">
                "{confirmCancelTx.titulo_resumen || confirmCancelTx.items[0]?.concepto || 'Gasto Fijo'}"
              </strong>
              ?
              <br />
              <br />
              Al cancelar, ya no figurará en tus compromisos fijos mensuales ni en las proyecciones presupuestarias.
            </p>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmCancelTx(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded cursor-pointer transition-colors"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={() => {
                  const txToCancel = confirmCancelTx;
                  setConfirmCancelTx(null);
                  if (onCancelFixedExpense) {
                    onCancelFixedExpense(txToCancel);
                  } else if (onUpdateTransaction) {
                    onUpdateTransaction(txToCancel.id, {
                      es_gasto_fijo: false,
                      frecuencia_recurrencia: 'PUNTUAL',
                    });
                  }
                }}
                className="px-3.5 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded cursor-pointer shadow-xs transition-colors"
              >
                Sí, cancelar suscripción
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

