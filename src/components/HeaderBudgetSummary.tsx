import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  PieChart,
  DollarSign,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { BudgetSummary } from '../types';

interface HeaderBudgetSummaryProps {
  summary: BudgetSummary;
  monedaSimbolo: string;
  onOpenSettings: () => void;
}

export const HeaderBudgetSummary: React.FC<HeaderBudgetSummaryProps> = ({
  summary,
  monedaSimbolo,
  onOpenSettings,
}) => {
  const [expenseViewMode, setExpenseViewMode] = useState<'proyectado' | 'ejecutado'>('proyectado');
  const [showExpenseInfo, setShowExpenseInfo] = useState(false);

  const {
    ingresoMensual,
    ingresosCobradosTotal,
    montoPendienteCobrar,
    porcentajeCobrado,
    metaAhorroMonto,
    gastosTotalesProyectados,
    gastosEjecutadosReal = 0,
    gastosPendientesTotal = 0,
    gastosFijos,
    cuotasCredito,
    gastosVariables,
    saldoBancoReal,
    dineroLibreDisponible,
    alertaAhorroComprometido,
  } = summary;

  return (
    <header className="mb-6 space-y-6">
      {/* Top Navbar */}
      <nav className="h-16 bg-white border border-slate-200 shadow-sm flex items-center justify-between px-6 sm:px-8 rounded-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-sm flex items-center justify-center shrink-0">
            <div className="w-3.5 h-3.5 border-2 border-white rotate-45"></div>
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-slate-800 uppercase font-sans">
              FINANCE.AI
            </span>
            <span className="hidden sm:inline-block text-xs text-slate-400 ml-2 font-medium">
              • Asistente Financiero & Control de Caja
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-sm border border-slate-200 transition-colors cursor-pointer"
            title="Configurar presupuesto"
          >
            <Settings className="w-3.5 h-3.5 text-indigo-600" />
            <span>Ajustes</span>
          </button>
        </div>
      </nav>

      {/* Critical Alert Warning Banner */}
      {alertaAhorroComprometido && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-sm flex items-start gap-3.5 shadow-sm">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-xs uppercase tracking-wider text-rose-700">
              ¡ALERTA: EL SALDO EN CUENTA Y GASTOS COMPROMETEN EL AHORRO PROTEGIDO!
            </h3>
            <p className="text-xs text-rose-600 mt-1">
              Tus gastos ({monedaSimbolo} {gastosTotalesProyectados.toFixed(2)}) comparados con el dinero abonado en banco ({monedaSimbolo} {ingresosCobradosTotal.toFixed(2)}) están invadiendo tu meta del 10% de ahorro ({monedaSimbolo} {metaAhorroMonto.toFixed(2)}).
            </p>
          </div>
        </div>
      )}

      {/* Main Highlights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 10% Protection Savings Deep Indigo Hero Card (4 cols) */}
        <div className="lg:col-span-4 bg-indigo-900 text-white p-6 shadow-md rounded-sm relative overflow-hidden flex flex-col justify-between">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-200/80">
                Protección de Ahorro (10%)
              </h2>
              <span className="px-2 py-0.5 bg-indigo-800 text-emerald-400 text-[10px] font-bold uppercase tracking-wider rounded-sm border border-indigo-700">
                Meta Blindada
              </span>
            </div>

            <div className="text-3xl font-light font-mono mb-1 text-white">
              {monedaSimbolo} {metaAhorroMonto.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-indigo-200/80 mb-6">
              Reserva intocable del 10% calculada sobre tu ingreso base ({monedaSimbolo} {ingresoMensual.toFixed(0)}).
            </p>

            {/* Savings Bar */}
            <div className="w-full bg-indigo-950 h-2 rounded-full overflow-hidden border border-indigo-800">
              <div
                className={`h-full transition-all duration-500 ${
                  alertaAhorroComprometido
                    ? 'bg-rose-500'
                    : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                }`}
                style={{ width: `${alertaAhorroComprometido ? 50 : 100}%` }}
              />
            </div>

            <div className="mt-3 flex justify-between text-[10px] font-bold uppercase tracking-tight">
              <span className={alertaAhorroComprometido ? 'text-rose-400' : 'text-emerald-400'}>
                Estado: {alertaAhorroComprometido ? 'Comprometido' : 'Protegido'}
              </span>
              <span className="text-indigo-200/90">Meta 10%</span>
            </div>
          </div>

          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-indigo-800 rounded-full opacity-30 pointer-events-none"></div>
        </div>

        {/* 3 Metrics Cards (8 cols) */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Ingresos Recibidos en Banco */}
          <div className="bg-white border border-slate-200 p-5 shadow-sm rounded-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                Ingresos Recibidos
              </span>
              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-mono font-bold rounded-xs border border-emerald-200">
                {porcentajeCobrado}% Cobrado
              </span>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono text-emerald-600">
                {monedaSimbolo} {ingresosCobradosTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {montoPendienteCobrar > 0
                  ? `Pendiente: ${monedaSimbolo} ${montoPendienteCobrar.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : 'Sueldo completo abonado'}
              </p>
            </div>
          </div>

          {/* Gastos Totales Card with Proyectado vs Ejecutado Selector */}
          <div className="bg-white border border-slate-200 p-5 shadow-sm rounded-sm flex flex-col justify-between relative">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Gastos {expenseViewMode === 'proyectado' ? 'Proyectados' : 'Ejecutados'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowExpenseInfo(!showExpenseInfo)}
                    className="w-4 h-4 rounded-full bg-slate-100 hover:bg-indigo-100 text-slate-500 hover:text-indigo-700 text-[10px] font-bold flex items-center justify-center transition-colors cursor-pointer"
                    title="Explicación de Cómputo de Gastos"
                  >
                    ?
                  </button>
                </div>
              </div>

              {/* Toggle Switcher */}
              <div className="flex bg-slate-100 p-0.5 rounded-xs mb-2 border border-slate-200 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setExpenseViewMode('proyectado')}
                  className={`flex-1 py-0.5 px-1.5 rounded-xs transition-colors cursor-pointer ${
                    expenseViewMode === 'proyectado'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Fin de Mes
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseViewMode('ejecutado')}
                  className={`flex-1 py-0.5 px-1.5 rounded-xs transition-colors cursor-pointer ${
                    expenseViewMode === 'ejecutado'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Al Momento
                </button>
              </div>

              <div className="text-2xl font-bold font-mono text-rose-600">
                {monedaSimbolo}{' '}
                {(expenseViewMode === 'proyectado'
                  ? gastosTotalesProyectados
                  : gastosEjecutadosReal
                ).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>

              {expenseViewMode === 'proyectado' ? (
                <div className="text-[10px] font-mono text-slate-500 mt-1 flex flex-wrap gap-x-2">
                  <span>Al momento: {gastosEjecutadosReal.toFixed(2)}</span>
                  <span>+ Fijos: {gastosFijos.toFixed(2)}</span>
                  {(summary.cuotasCreditoPendientes || 0) > 0 && (
                    <span className="text-amber-700">+ Cuotas pend.: {(summary.cuotasCreditoPendientes || 0).toFixed(2)}</span>
                  )}
                </div>
              ) : (
                <div className="text-[10px] font-mono text-slate-500 mt-1 flex flex-wrap gap-x-2">
                  <span className="text-emerald-700 font-semibold">Pagado: {gastosEjecutadosReal.toFixed(2)}</span>
                  {gastosPendientesTotal > 0 && (
                    <span className="text-amber-700">| Pend: {gastosPendientesTotal.toFixed(2)}</span>
                  )}
                </div>
              )}
            </div>

            {/* Explanation popover */}
            {showExpenseInfo && (
              <div className="mt-3 p-2.5 bg-indigo-50 border border-indigo-200 rounded-sm text-[11px] text-indigo-950 space-y-1 shadow-xs animate-fadeIn">
                <div className="flex items-center justify-between font-bold text-indigo-900 text-[10px] uppercase">
                  <span>💡 Cómputo de Gastos</span>
                  <button
                    onClick={() => setShowExpenseInfo(false)}
                    className="text-indigo-400 hover:text-indigo-900 font-bold"
                  >
                    ✕
                  </button>
                </div>
                <p>
                  • <strong>Fin de Mes (Proyectado):</strong> Gastos al momento ({monedaSimbolo} {gastosEjecutadosReal.toFixed(2)}) + Gastos Fijos ({monedaSimbolo} {gastosFijos.toFixed(2)}){(summary.cuotasCreditoPendientes || 0) > 0 ? ` + Cuotas tc pend. (${monedaSimbolo} ${(summary.cuotasCreditoPendientes || 0).toFixed(2)})` : ''} = {monedaSimbolo} {gastosTotalesProyectados.toFixed(2)}.
                </p>
                <p>
                  • <strong>Al Momento (Ejecutado):</strong> Salida total de dinero y consumos registrados a la fecha ({monedaSimbolo} {gastosEjecutadosReal.toFixed(2)}).
                </p>
              </div>
            )}
          </div>

          {/* Dinero Libre en Banco */}
          <div
            className={`bg-white border p-5 shadow-sm rounded-sm flex flex-col justify-between ${
              alertaAhorroComprometido
                ? 'ring-2 ring-rose-500/50 border-rose-300'
                : 'ring-2 ring-indigo-500/20 border-slate-200'
            }`}
          >
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
              Dinero Libre en Banco
            </span>
            <div>
              <div
                className={`text-2xl font-bold font-mono ${
                  dineroLibreDisponible < 0 ? 'text-rose-600' : 'text-indigo-600'
                }`}
              >
                {monedaSimbolo} {dineroLibreDisponible.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Saldo en banco ({monedaSimbolo} {saldoBancoReal.toFixed(0)}) tras 10% ahorro
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

