import React, { useState } from 'react';
import { Bell, Calendar, CheckCircle2, ArrowRight, X } from 'lucide-react';
import { TransactionRecord } from '../types';

interface UpcomingDueDateReminderBannerProps {
  transactions: TransactionRecord[];
  monedaSimbolo: string;
  onUpdateTransaction: (id: string, updatedFields: Partial<TransactionRecord>) => void;
  onNavigateToProyeccion?: () => void;
}

export const UpcomingDueDateReminderBanner: React.FC<UpcomingDueDateReminderBannerProps> = ({
  transactions,
  monedaSimbolo,
  onUpdateTransaction,
  onNavigateToProyeccion,
}) => {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [justPaidId, setJustPaidId] = useState<string | null>(null);

  const today = new Date();
  const currentDay = today.getDate();

  // Find all pending fixed expenses / scheduled commitments
  const upcomingExpenses = transactions.filter((tx) => {
    if (tx.tipo_operacion !== 'GASTO') return false;
    if (tx.estado_pago !== 'PENDIENTE') return false;
    if (dismissedIds.includes(tx.id)) return false;

    return true;
  });

  if (upcomingExpenses.length === 0) return null;

  const handleMarkPaid = (txId: string) => {
    setJustPaidId(txId);
    setTimeout(() => {
      onUpdateTransaction(txId, { estado_pago: 'PAGADO' });
      setJustPaidId(null);
    }, 400);
  };

  return (
    <div className="mb-6 bg-slate-900/95 dark:bg-slate-900/95 border-2 border-amber-500 text-amber-100 rounded-md p-4 shadow-md animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2.5 pb-2 border-b border-amber-500/30 gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-amber-500/20 border border-amber-500/40 rounded-full flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4 text-amber-400 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-xs uppercase tracking-wider text-amber-400">
                ALERTAS DE VENCIMIENTO DEL MES
              </h3>
              <span className="bg-amber-500/20 text-amber-200 border border-amber-400/50 text-[10px] px-2 py-0.5 rounded-full font-extrabold shadow-2xs">
                {upcomingExpenses.length} {upcomingExpenses.length === 1 ? 'compromiso pendiente' : 'compromisos pendientes'}
              </span>
              <span className="text-[10px] font-bold bg-amber-950/80 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                ⚡ Sincronizado con Proyección de Caja
              </span>
            </div>
            <p className="text-[11px] text-slate-200 font-medium mt-0.5 leading-snug">
              <strong className="text-amber-400 font-bold">Atención:</strong> Tienes servicios o compromisos fijos pendientes de pago. Al marcarlos como pagados aquí o en Proyección de Caja, se actualizarán en ambas pantallas de forma sincronizada.
            </p>
          </div>
        </div>

        {onNavigateToProyeccion && (
          <button
            type="button"
            onClick={onNavigateToProyeccion}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] rounded-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-auto"
            title="Ir a Proyección de Caja para ver todos los compromisos futuros"
          >
            <span>Ver Proyección de Caja</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {upcomingExpenses.map((tx) => {
          const dueDay = tx.dia_pago_mensual || 21;
          const daysRemaining = dueDay - currentDay;
          const title = tx.titulo_resumen || tx.items[0]?.concepto || 'Gasto Fijo';
          const monto = tx.monto_total;
          const isPaying = justPaidId === tx.id;

          let badgeText = '';
          let badgeBg = '';

          if (daysRemaining === 0) {
            badgeText = '¡Vence Hoy!';
            badgeBg = 'bg-red-500 text-white font-black animate-pulse';
          } else if (daysRemaining === 1) {
            badgeText = 'Vence Mañana (Día 1)';
            badgeBg = 'bg-orange-500 text-white font-extrabold';
          } else if (daysRemaining > 1) {
            badgeText = `Vence en ${daysRemaining} días (Día ${dueDay})`;
            badgeBg = 'bg-amber-900 text-amber-100 font-extrabold';
          } else {
            badgeText = `Pendiente por Pagar (Día ${dueDay})`;
            badgeBg = 'bg-red-700 text-white font-extrabold';
          }

          return (
            <div
              key={tx.id}
              className={`bg-white/10 backdrop-blur-xs border border-white/20 rounded-sm p-2.5 flex items-center justify-between gap-3 text-xs transition-all duration-300 ${
                isPaying ? 'opacity-50 scale-98 bg-emerald-900/40 border-emerald-400' : ''
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Calendar className="w-4 h-4 text-amber-200 shrink-0" />
                <div className="min-w-0">
                  <div className="font-bold text-white truncate flex items-center gap-2 flex-wrap">
                    <span className="truncate">{title}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-xs shrink-0 ${badgeBg}`}>
                      {badgeText}
                    </span>
                  </div>
                  <div className="text-[11px] text-amber-100 font-mono font-semibold">
                    Monto pendiente: <span className="text-white font-bold">{monedaSimbolo} {monto.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleMarkPaid(tx.id)}
                  disabled={isPaying}
                  className="px-2.5 py-1 bg-white text-amber-950 hover:bg-amber-100 font-bold text-[11px] rounded-xs shadow-xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="Marcar como Pagado hoy (se sincroniza con Proyección de Caja y descuenta de tu saldo)"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  {isPaying ? 'Pagado...' : 'Marcar Pagado'}
                </button>
                <button
                  type="button"
                  onClick={() => setDismissedIds((prev) => [...prev, tx.id])}
                  className="p-1 text-amber-200 hover:text-white rounded-xs transition-colors cursor-pointer"
                  title="Ocultar aviso por ahora"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
