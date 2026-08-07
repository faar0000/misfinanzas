import React, { useState } from 'react';
import { Bell, Calendar, CheckCircle2, X } from 'lucide-react';
import { TransactionRecord } from '../types';

interface UpcomingDueDateReminderBannerProps {
  transactions: TransactionRecord[];
  monedaSimbolo: string;
  onUpdateTransaction: (id: string, updatedFields: Partial<TransactionRecord>) => void;
}

export const UpcomingDueDateReminderBanner: React.FC<UpcomingDueDateReminderBannerProps> = ({
  transactions,
  monedaSimbolo,
  onUpdateTransaction,
}) => {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const today = new Date();
  const currentDay = today.getDate();

  // Find pending fixed expenses that are due within 4 days or overdue
  const upcomingExpenses = transactions.filter((tx) => {
    if (tx.tipo_operacion !== 'GASTO') return false;
    if (tx.estado_pago !== 'PENDIENTE') return false;
    if (dismissedIds.includes(tx.id)) return false;

    const dueDay = tx.dia_pago_mensual || 21;
    const daysRemaining = dueDay - currentDay;

    // Trigger banner if daysRemaining is between -10 and 4 (i.e. due within 4 days or pending past due)
    return (daysRemaining >= 0 && daysRemaining <= 4) || (daysRemaining < 0 && daysRemaining >= -10);
  });

  if (upcomingExpenses.length === 0) return null;

  return (
    <div className="mb-6 bg-gradient-to-r from-amber-600 via-amber-700 to-orange-700 text-white rounded-sm p-4 shadow-md border border-amber-500 animate-fadeIn">
      <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-amber-500/40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4 text-amber-100 animate-bounce" />
          </div>
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-amber-100 flex items-center gap-2">
              <span>RECORDATORIO DE VENCIMIENTO PRÓXIMO</span>
              <span className="bg-white text-amber-950 text-[10px] px-2 py-0.5 rounded-full font-extrabold">
                {upcomingExpenses.length} {upcomingExpenses.length === 1 ? 'gasto pendiente' : 'gastos pendientes'}
              </span>
            </h3>
            <p className="text-[11px] text-amber-100/90 font-medium">
              Atención: Tienes compromisos fijos con fecha de pago dentro de los próximos 4 días o pendientes de regularización.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {upcomingExpenses.map((tx) => {
          const dueDay = tx.dia_pago_mensual || 21;
          const daysRemaining = dueDay - currentDay;
          const title = tx.titulo_resumen || tx.items[0]?.concepto || 'Gasto Fijo';
          const monto = tx.monto_total;

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
              className="bg-white/10 backdrop-blur-xs border border-white/20 rounded-sm p-2.5 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Calendar className="w-4 h-4 text-amber-200 shrink-0" />
                <div className="min-w-0">
                  <div className="font-bold text-white truncate flex items-center gap-2">
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
                  onClick={() => onUpdateTransaction(tx.id, { estado_pago: 'PAGADO' })}
                  className="px-2.5 py-1 bg-white text-amber-950 hover:bg-amber-100 font-bold text-[11px] rounded-xs shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                  title="Marcar como Pagado hoy (descuenta de tu saldo de banco)"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Marcar Pagado
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
