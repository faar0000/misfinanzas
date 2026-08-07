import React, { useState } from 'react';
import { X, Save, RefreshCw, DollarSign, ShieldCheck } from 'lucide-react';
import { BudgetConfig } from '../types';

interface BudgetSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: BudgetConfig;
  onSaveConfig: (newConfig: BudgetConfig) => void;
  onResetSampleData: () => void;
}

export const BudgetSettingsModal: React.FC<BudgetSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onResetSampleData,
}) => {
  const [ingreso, setIngreso] = useState<number>(config.ingresoMensual);
  const [moneda, setMoneda] = useState<string>(config.monedaSimbolo);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig({
      ingresoMensual: Number(ingreso) || 5000,
      porcentajeAhorroMeta: 10,
      monedaSimbolo: moneda || 'S/.',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-sm shadow-xl w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 p-1 rounded-sm cursor-pointer transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-1">
          <div className="w-7 h-7 bg-indigo-600 rounded-sm flex items-center justify-center text-white shrink-0">
            <DollarSign className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-800">
            Configuración del Presupuesto
          </h3>
        </div>
        <p className="text-[11px] text-slate-400 mb-5 ml-10">
          Ajusta tu ingreso mensual y parámetros de protección de ahorro.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              Ingreso Mensual Total
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-mono font-bold text-slate-400">
                {moneda}
              </span>
              <input
                type="number"
                step="50"
                min="0"
                value={ingreso}
                onChange={(e) => setIngreso(Number(e.target.value))}
                className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold text-sm outline-none focus:ring-1 focus:ring-indigo-500 rounded-sm"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Meta estricta de ahorro (10%):{' '}
              <strong className="text-emerald-600 font-mono font-bold">
                {moneda} {((Number(ingreso) || 0) * 0.1).toFixed(2)}
              </strong>
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              Símbolo de Moneda
            </label>
            <select
              value={moneda}
              onChange={(e) => setMoneda(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium outline-none rounded-sm"
            >
              <option value="S/.">Soles Peruanos (S/.)</option>
              <option value="$">Dólares US ($)</option>
              <option value="€">Euros (€)</option>
              <option value="MXN$">Pesos Mexicanos (MXN$)</option>
              <option value="CLP$">Pesos Chilenos (CLP$)</option>
            </select>
          </div>

          <div className="p-3.5 bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs rounded-sm flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">Regla del 10% de Ahorro:</strong>
              <p className="text-[11px] text-indigo-800 mt-0.5">
                El sistema reservará siempre el 10% de tu ingreso como ahorro protegido e intocable. Si algún gasto compromete este margen, se notificará explícitamente.
              </p>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-between gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                if (confirm('¿Cargar nuevamente los datos de muestra iniciales?')) {
                  onResetSampleData();
                  onClose();
                }
              }}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium border border-slate-200 rounded-sm flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Cargar Muestra</span>
            </button>

            <button
              type="submit"
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold uppercase tracking-wider rounded-sm flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Guardar Ajustes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

