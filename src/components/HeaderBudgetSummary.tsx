import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  PieChart,
  Wallet,
  Settings,
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
    saldoBancoReal,
    dineroLibreDisponible,
    alertaAhorroComprometido,
  } = summary;

  return (
    <header className="mb-4 space-y-3 sm:space-y-4">
      {/* Top Navbar */}
      <nav className="h-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between px-4 sm:px-6 rounded-md">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center shrink-0">
            <div className="w-3 h-3 border-2 border-white rotate-45"></div>
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-slate-800 dark:text-slate-100 uppercase font-sans">
              FINANCE.AI
            </span>
            <span className="hidden sm:inline-block text-xs text-slate-400 dark:text-slate-500 ml-2 font-medium">
              • Asistente Financiero & Control de Caja
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-md border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            title="Configurar presupuesto"
          >
            <Settings className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Ajustes</span>
          </button>
        </div>
      </nav>

      {/* Critical Alert Warning Banner */}
      {alertaAhorroComprometido && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-md flex items-center gap-3 shadow-2xs text-xs">
          <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          <div className="flex-1">
            <span className="font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">
              ¡Alerta de Ahorro!
            </span>{' '}
            <span>
              Gastos ({monedaSimbolo} {gastosTotalesProyectados.toFixed(2)}) e ingresos cobrados ({monedaSimbolo} {ingresosCobradosTotal.toFixed(2)}) invaden tu meta del 10% ({monedaSimbolo} {metaAhorroMonto.toFixed(2)}).
            </span>
          </div>
        </div>
      )}

      {/* Unified 4 Equal Cards Grid (2 cols on mobile, 4 cols on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Card 1: Protección de Ahorro (10%) */}
        <div
          className={`bg-white dark:bg-slate-900 border p-3.5 sm:p-4 shadow-2xs rounded-md flex flex-col justify-between transition-all ${
            alertaAhorroComprometido
              ? 'border-rose-300 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-950/20'
              : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate flex items-center gap-1">
                {alertaAhorroComprometido ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                )}
                <span className="truncate">Ahorro 10%</span>
              </span>
              <span
                className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-xs ${
                  alertaAhorroComprometido
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                }`}
              >
                {alertaAhorroComprometido ? 'Alerta' : 'Blindado'}
              </span>
            </div>

            <div
              className={`text-lg sm:text-2xl font-bold font-mono tracking-tight ${
                alertaAhorroComprometido ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-700 dark:text-indigo-300'
              }`}
            >
              {monedaSimbolo}{' '}
              {metaAhorroMonto.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="mt-2.5">
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden border border-slate-200/60 dark:border-slate-700">
              <div
                className={`h-full transition-all duration-500 ${
                  alertaAhorroComprometido ? 'bg-rose-500' : 'bg-indigo-600 dark:bg-indigo-400'
                }`}
                style={{ width: `${alertaAhorroComprometido ? 50 : 100}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
              <span className="truncate">Base: {monedaSimbolo}{ingresoMensual.toFixed(0)}</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">10%</span>
            </div>
          </div>
        </div>

        {/* Card 2: Ingresos Recibidos */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 sm:p-4 shadow-2xs rounded-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="truncate">Ingresos</span>
              </span>
              <span className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[9px] font-mono font-bold rounded-xs border border-emerald-200 dark:border-emerald-800">
                {porcentajeCobrado}% Cobrado
              </span>
            </div>

            <div className="text-lg sm:text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
              {monedaSimbolo}{' '}
              {ingresosCobradosTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 truncate">
            {montoPendienteCobrar > 0
              ? `Pendiente: ${monedaSimbolo} ${montoPendienteCobrar.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : 'Sueldo completo abonado'}
          </p>
        </div>

        {/* Card 3: Gastos (Proyectados / Ejecutados) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 sm:p-4 shadow-2xs rounded-md flex flex-col justify-between relative">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate flex items-center gap-1">
                <PieChart className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span className="truncate">
                  Gastos {expenseViewMode === 'proyectado' ? 'Proyectados' : 'Ejecutados'}
                </span>
              </span>

              <button
                type="button"
                onClick={() => setShowExpenseInfo(!showExpenseInfo)}
                className="w-4 h-4 rounded-full bg-slate-100 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-indigo-900 text-slate-500 dark:text-slate-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-[10px] font-bold flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Explicación de Cómputo de Gastos"
              >
                ?
              </button>
            </div>

            {/* Toggle Switcher */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xs mb-1.5 border border-slate-200 dark:border-slate-700 text-[9px] font-bold">
              <button
                type="button"
                onClick={() => setExpenseViewMode('proyectado')}
                className={`flex-1 py-0.5 px-1 rounded-xs transition-colors cursor-pointer ${
                  expenseViewMode === 'proyectado'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Fin de Mes
              </button>
              <button
                type="button"
                onClick={() => setExpenseViewMode('ejecutado')}
                className={`flex-1 py-0.5 px-1 rounded-xs transition-colors cursor-pointer ${
                  expenseViewMode === 'ejecutado'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Al Momento
              </button>
            </div>

            <div className="text-lg sm:text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 tracking-tight">
              {monedaSimbolo}{' '}
              {(expenseViewMode === 'proyectado'
                ? gastosTotalesProyectados
                : gastosEjecutadosReal
              ).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="text-[9px] sm:text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1 truncate">
            {expenseViewMode === 'proyectado' ? (
              <span>Moment: {gastosEjecutadosReal.toFixed(0)} + Fij: {gastosFijos.toFixed(0)}</span>
            ) : (
              <span>Pagado: {gastosEjecutadosReal.toFixed(0)} | Pend: {gastosPendientesTotal.toFixed(0)}</span>
            )}
          </div>

          {/* Explanation popover */}
          {showExpenseInfo && (
            <div className="absolute top-12 left-2 right-2 z-20 p-2.5 bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 rounded-md text-[11px] text-indigo-950 dark:text-indigo-100 space-y-1 shadow-md animate-fadeIn">
              <div className="flex items-center justify-between font-bold text-indigo-900 dark:text-indigo-200 text-[10px] uppercase">
                <span>💡 Cómputo de Gastos</span>
                <button
                  onClick={() => setShowExpenseInfo(false)}
                  className="text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-200 font-bold"
                >
                  ✕
                </button>
              </div>
              <p>
                • <strong>Fin de Mes (Proyectado):</strong> Gastos ejecutados ({monedaSimbolo} {gastosEjecutadosReal.toFixed(2)}) + Fijos ({monedaSimbolo} {gastosFijos.toFixed(2)}) = {monedaSimbolo} {gastosTotalesProyectados.toFixed(2)}.
              </p>
              <p>
                • <strong>Al Momento (Ejecutado):</strong> Compras y salidas reales pagadas ({monedaSimbolo} {gastosEjecutadosReal.toFixed(2)}).
              </p>
            </div>
          )}
        </div>

        {/* Card 4: Dinero Libre en Banco */}
        <div
          className={`bg-white dark:bg-slate-900 border p-3.5 sm:p-4 shadow-2xs rounded-md flex flex-col justify-between ${
            alertaAhorroComprometido
              ? 'border-rose-300 dark:border-rose-800'
              : 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="truncate">Dinero Libre</span>
              </span>
            </div>

            <div
              className={`text-lg sm:text-2xl font-bold font-mono tracking-tight ${
                dineroLibreDisponible < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-indigo-600 dark:text-indigo-400'
              }`}
            >
              {monedaSimbolo}{' '}
              {dineroLibreDisponible.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 truncate">
            En banco: {monedaSimbolo} {saldoBancoReal.toFixed(0)} (tras 10% ahorro)
          </p>
        </div>
      </div>
    </header>
  );
};


