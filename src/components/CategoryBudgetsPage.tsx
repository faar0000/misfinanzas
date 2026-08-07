import React, { useState } from 'react';
import {
  CategoryDefinition,
  CATEGORIAS_BASE,
  TransactionRecord,
} from '../types';
import {
  Target,
  PiggyBank,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Save,
  RotateCcw,
  Plus,
  ChevronDown,
  ChevronUp,
  Apple,
  Coffee,
  Car,
  Home,
  PartyPopper,
  CreditCard,
  DollarSign,
  Info,
  Calendar,
  Sparkles,
} from 'lucide-react';

interface CategoryBudgetsPageProps {
  transactions: TransactionRecord[];
  categoryBudgets: Record<string, number>;
  onUpdateCategoryBudgets: (newBudgets: Record<string, number>) => void;
  monedaSimbolo: string;
}

// Icon mapping helper
const getCategoryIcon = (iconName: string) => {
  switch (iconName) {
    case 'Apple':
      return <Apple className="w-5 h-5" />;
    case 'Coffee':
      return <Coffee className="w-5 h-5" />;
    case 'Car':
      return <Car className="w-5 h-5" />;
    case 'Home':
      return <Home className="w-5 h-5" />;
    case 'PartyPopper':
      return <PartyPopper className="w-5 h-5" />;
    case 'CreditCard':
      return <CreditCard className="w-5 h-5" />;
    default:
      return <Target className="w-5 h-5" />;
  }
};

// Normalize category name to match CATEGORIAS_BASE IDs
export const normalizeCategoryToId = (
  catName?: string,
  subcatName?: string,
  extraText?: string,
  esGastoFijo?: boolean,
  metodoPago?: string
): string => {
  const c = (catName || '').toLowerCase().trim();
  const s = (subcatName || '').toLowerCase().trim();
  const e = (extraText || '').toLowerCase().trim();
  const text = `${c} ${s} ${e}`;

  if (
    c === 'credito_compromisos' ||
    c.includes('crédito y compromisos') ||
    c.includes('credito y compromisos') ||
    text.includes('tarjeta') ||
    text.includes('cuota') ||
    text.includes('préstamo') ||
    text.includes('prestamo') ||
    text.includes('compromiso')
  ) {
    return 'credito_compromisos';
  }

  if (
    c === 'gastos_hormiga' ||
    c.includes('gastos hormiga') ||
    text.includes('hormiga') ||
    text.includes('antojo') ||
    text.includes('snack') ||
    text.includes('chatarra') ||
    text.includes('dulces') ||
    text.includes('capricho') ||
    text.includes('delivery no planificado')
  ) {
    return 'gastos_hormiga';
  }

  if (
    c === 'alimentacion' ||
    c.includes('alimentación') ||
    text.includes('alimentac') ||
    text.includes('comida') ||
    text.includes('dieta') ||
    text.includes('supermercado') ||
    text.includes('abarrotes') ||
    text.includes('viveres') ||
    text.includes('víveres') ||
    text.includes('proteína') ||
    text.includes('plaza vea') ||
    text.includes('wong') ||
    text.includes('metro') ||
    text.includes('tottus') ||
    text.includes('vivanda')
  ) {
    return 'alimentacion';
  }

  if (
    c === 'vehiculo' ||
    c.includes('vehículo') ||
    text.includes('vehic') ||
    text.includes('auto') ||
    text.includes('carro') ||
    text.includes('gasolina') ||
    text.includes('cochera') ||
    text.includes('combustible') ||
    text.includes('peaje') ||
    text.includes('mantenimiento preventivo')
  ) {
    return 'vehiculo';
  }

  if (
    c === 'ocio_salidas' ||
    c.includes('ocio y salidas') ||
    text.includes('ocio') ||
    text.includes('salida') ||
    text.includes('cine') ||
    text.includes('viaje') ||
    text.includes('pasatiempo') ||
    text.includes('restaurante') ||
    text.includes('bar')
  ) {
    return 'ocio_salidas';
  }

  if (
    c === 'servicios_fijos' ||
    c.includes('servicios y gastos fijos') ||
    text.includes('alquiler') ||
    text.includes('luz') ||
    text.includes('agua') ||
    text.includes('internet') ||
    text.includes('teléfono') ||
    text.includes('telefono') ||
    text.includes('suscripcion') ||
    text.includes('suscripción') ||
    text.includes('gimnasio') ||
    text.includes('gym') ||
    text.includes('mantenimiento edificio') ||
    text.includes('arbitrios') ||
    text.includes('colegio') ||
    text.includes('pension') ||
    text.includes('pensión')
  ) {
    return 'servicios_fijos';
  }

  if (metodoPago === 'CREDITO') {
    return 'credito_compromisos';
  }

  if (esGastoFijo) {
    return 'servicios_fijos';
  }

  return 'alimentacion'; // Balanced neutral default for unclassified groceries/items
};

export const CategoryBudgetsPage: React.FC<CategoryBudgetsPageProps> = ({
  transactions,
  categoryBudgets,
  onUpdateCategoryBudgets,
  monedaSimbolo,
}) => {
  const [editingBudgets, setEditingBudgets] = useState<Record<string, string>>({});
  const [isEditingAll, setIsEditingAll] = useState(false);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

  // Current month string YYYY-MM
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const currentMonthName = new Date().toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  });

  // Calculate current month executed spending per category & subcategory
  const currentMonthExpenses = transactions.filter(
    (t) =>
      t.tipo_operacion === 'GASTO' &&
      t.fecha.startsWith(currentMonthStr) &&
      t.estado_pago !== 'PENDIENTE'
  );

  const spentPerCategory: Record<string, number> = {
    alimentacion: 0,
    gastos_hormiga: 0,
    vehiculo: 0,
    servicios_fijos: 0,
    ocio_salidas: 0,
    credito_compromisos: 0,
  };

  const spentPerSubcategory: Record<string, Record<string, number>> = {
    alimentacion: {},
    gastos_hormiga: {},
    vehiculo: {},
    servicios_fijos: {},
    ocio_salidas: {},
    credito_compromisos: {},
  };

  currentMonthExpenses.forEach((tx) => {
    // Determine effective monthly cost for this transaction
    let txMonthlyAmount = tx.monto_total || 0;
    if (tx.metodo_pago === 'CREDITO' && tx.cuotas > 1) {
      txMonthlyAmount = tx.monto_cuota_mensual || (tx.monto_total / tx.cuotas);
    }

    if (tx.items && tx.items.length > 0) {
      const itemsDeclaredTotal = tx.items.reduce((sum, item) => sum + (item.monto || 0), 0);

      tx.items.forEach((item) => {
        let itemAmount = 0;
        if (itemsDeclaredTotal > 0 && item.monto) {
          itemAmount = (item.monto / itemsDeclaredTotal) * txMonthlyAmount;
        } else {
          itemAmount = txMonthlyAmount / tx.items.length;
        }

        const catId = normalizeCategoryToId(
          item.categoria_principal,
          item.subcategoria,
          `${tx.titulo_resumen || ''} ${tx.comercio || ''} ${tx.mensaje_usuario || ''}`,
          tx.es_gasto_fijo,
          tx.metodo_pago
        );

        spentPerCategory[catId] = (spentPerCategory[catId] || 0) + itemAmount;

        const subcatName = item.subcategoria || item.concepto || 'General';
        if (!spentPerSubcategory[catId]) {
          spentPerSubcategory[catId] = {};
        }
        spentPerSubcategory[catId][subcatName] =
          (spentPerSubcategory[catId][subcatName] || 0) + itemAmount;
      });
    } else {
      const catId = normalizeCategoryToId(
        '',
        '',
        `${tx.titulo_resumen || ''} ${tx.comercio || ''} ${tx.mensaje_usuario || ''}`,
        tx.es_gasto_fijo,
        tx.metodo_pago
      );

      spentPerCategory[catId] = (spentPerCategory[catId] || 0) + txMonthlyAmount;

      const subcatName = tx.titulo_resumen || tx.comercio || 'General';
      if (!spentPerSubcategory[catId]) {
        spentPerSubcategory[catId] = {};
      }
      spentPerSubcategory[catId][subcatName] =
        (spentPerSubcategory[catId][subcatName] || 0) + txMonthlyAmount;
    }
  });

  // Calculate Totals
  const totalPresupuesto = CATEGORIAS_BASE.reduce(
    (sum, cat) => sum + (categoryBudgets[cat.id] || 0),
    0
  );

  const totalGastado = Object.values(spentPerCategory).reduce((sum, val) => sum + val, 0);

  const totalDisponible = Math.max(0, totalPresupuesto - totalGastado);

  const porcentajeGlobalUso =
    totalPresupuesto > 0 ? Math.min(100, (totalGastado / totalPresupuesto) * 100) : 0;

  // Handle Budget Inputs
  const handleInputChange = (catId: string, val: string) => {
    setEditingBudgets((prev) => ({ ...prev, [catId]: val }));
  };

  const handleSaveAllBudgets = () => {
    const updated: Record<string, number> = { ...categoryBudgets };
    CATEGORIAS_BASE.forEach((cat) => {
      if (editingBudgets[cat.id] !== undefined) {
        const parsed = parseFloat(editingBudgets[cat.id]);
        updated[cat.id] = isNaN(parsed) || parsed < 0 ? 0 : parsed;
      }
    });
    onUpdateCategoryBudgets(updated);
    setIsEditingAll(false);
  };

  const handleResetDefaultBudgets = () => {
    const defaults: Record<string, number> = {
      alimentacion: 500,
      gastos_hormiga: 100,
      vehiculo: 300,
      servicios_fijos: 1200,
      ocio_salidas: 300,
      credito_compromisos: 500,
    };
    onUpdateCategoryBudgets(defaults);
    const editingDefaults: Record<string, string> = {};
    Object.keys(defaults).forEach((k) => {
      editingDefaults[k] = defaults[k].toString();
    });
    setEditingBudgets(editingDefaults);
  };

  const startEditing = () => {
    const currentMap: Record<string, string> = {};
    CATEGORIAS_BASE.forEach((cat) => {
      currentMap[cat.id] = (categoryBudgets[cat.id] || 0).toString();
    });
    setEditingBudgets(currentMap);
    setIsEditingAll(true);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* HEADER BANNER */}
      <div className="bg-white border border-slate-200 rounded-sm p-5 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-xs">
                <Target className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-slate-900">
                Presupuestos por Categoría
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1 capitalize">
              Control de metas de gasto mensual • <span className="font-semibold">{currentMonthName}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isEditingAll ? (
              <>
                <button
                  onClick={startEditing}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xs text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Ajustar Limites</span>
                </button>
                <button
                  onClick={handleResetDefaultBudgets}
                  className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xs text-xs font-medium flex items-center gap-1 transition-all cursor-pointer"
                  title="Restablecer sugeridos"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Restablecer</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveAllBudgets}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xs text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar Cambios</span>
                </button>
                <button
                  onClick={() => setIsEditingAll(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-600 rounded-xs text-xs font-medium hover:bg-slate-100"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* METRICS SUMMARY CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-sm">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Presupuesto Total
            </span>
            <div className="text-xl font-extrabold text-slate-900 font-mono">
              {monedaSimbolo} {totalPresupuesto.toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Suma de límites de {CATEGORIAS_BASE.length} categorías
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-sm">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Gastado al Momento
            </span>
            <div className="text-xl font-extrabold text-slate-900 font-mono">
              {monedaSimbolo} {totalGastado.toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              {porcentajeGlobalUso.toFixed(1)}% del presupuesto global usado
            </span>
          </div>

          <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-sm">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">
              Disponible Global por Gastar
            </span>
            <div className="text-xl font-extrabold text-emerald-700 font-mono">
              {monedaSimbolo} {totalDisponible.toFixed(2)}
            </div>
            <span className="text-[10px] text-emerald-800 mt-1 block">
              Remanente libre para culminar el mes
            </span>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="mt-4 pt-3">
          <div className="flex justify-between text-xs font-semibold mb-1">
            <span className="text-slate-700">
              Avance General de Consumo
            </span>
            <span className="font-mono text-slate-800">
              {totalGastado.toFixed(2)} / {totalPresupuesto.toFixed(2)} ({porcentajeGlobalUso.toFixed(0)}%)
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                porcentajeGlobalUso > 100
                  ? 'bg-rose-500'
                  : porcentajeGlobalUso > 80
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, porcentajeGlobalUso)}%` }}
            />
          </div>
        </div>
      </div>

      {/* CATEGORY CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CATEGORIAS_BASE.map((cat) => {
          const budget = categoryBudgets[cat.id] || 0;
          const spent = spentPerCategory[cat.id] || 0;
          const remaining = budget - spent;
          const pct = budget > 0 ? (spent / budget) * 100 : 0;
          const isOverBudget = spent > budget && budget > 0;
          const subcatsSpent = spentPerSubcategory[cat.id] || {};
          const isExpanded = expandedCategoryId === cat.id;

          // Dynamic colors & badges based on proximity to limit
          let statusColorClass = 'text-emerald-600';
          let barBgClass = 'bg-emerald-500 shadow-xs shadow-emerald-500/20';
          let badgeText = '🟢 Bajo control';
          let badgeClass = 'bg-emerald-50 text-emerald-700 border border-emerald-200';

          if (isOverBudget) {
            statusColorClass = 'text-rose-600 font-bold';
            barBgClass = 'bg-rose-600 shadow-xs shadow-rose-600/30';
            badgeText = `🔴 Excedido por ${monedaSimbolo} ${(spent - budget).toFixed(2)}`;
            badgeClass = 'bg-rose-50 text-rose-700 border border-rose-300 font-bold animate-pulse';
          } else if (pct >= 85) {
            statusColorClass = 'text-orange-600 font-bold';
            barBgClass = 'bg-orange-500 shadow-xs shadow-orange-500/20';
            badgeText = '🟠 Límite cercano';
            badgeClass = 'bg-orange-50 text-orange-700 border border-orange-200 font-semibold';
          } else if (pct >= 60) {
            statusColorClass = 'text-amber-600';
            barBgClass = 'bg-amber-500 shadow-xs shadow-amber-500/20';
            badgeText = '🟡 Atención';
            badgeClass = 'bg-amber-50 text-amber-700 border border-amber-200';
          }

          return (
            <div
              key={cat.id}
              className={`bg-white border rounded-sm p-4 shadow-xs transition-all ${
                isOverBudget
                  ? 'border-rose-300'
                  : 'border-slate-200'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-xs flex items-center justify-center text-white shrink-0 shadow-xs"
                    style={{ backgroundColor: cat.color }}
                  >
                    {getCategoryIcon(cat.iconoNombre)}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      {cat.nombre}
                    </h3>
                    <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium mt-0.5 ${badgeClass}`}>
                      {badgeText}
                    </span>
                  </div>
                </div>

                {/* Inline budget value or input */}
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Presupuesto
                  </span>
                  {isEditingAll ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs font-mono font-bold text-slate-500">
                        {monedaSimbolo}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={
                          editingBudgets[cat.id] !== undefined
                            ? editingBudgets[cat.id]
                            : budget
                        }
                        onChange={(e) => handleInputChange(cat.id, e.target.value)}
                        className="w-24 px-2 py-1 bg-slate-50 border border-slate-300 rounded-xs text-xs font-mono font-bold text-right text-slate-900 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                      />
                    </div>
                  ) : (
                    <div className="text-sm font-extrabold font-mono text-slate-900">
                      {monedaSimbolo} {budget.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>

              {/* Visual Progress Bar Section */}
              <div className="space-y-2 my-4 p-3 bg-slate-50 rounded-sm border border-slate-200/80">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-slate-500 font-medium">Gastado:</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {monedaSimbolo} {spent.toFixed(2)}
                    </span>
                    <span className="text-slate-400">/</span>
                    <span className="text-slate-600 font-mono">
                      {monedaSimbolo} {budget.toFixed(2)}
                    </span>
                  </div>
                  <span className={`font-mono text-xs font-extrabold ${statusColorClass}`}>
                    {pct.toFixed(0)}%
                  </span>
                </div>

                {/* Progress track & dynamic fill */}
                <div className="relative w-full h-3 bg-slate-200/80 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${barBgClass}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                  {/* Subtle 80% threshold marker line */}
                  {budget > 0 && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-slate-400/40 z-10"
                      style={{ left: '80%' }}
                      title="Umbral de alerta 80%"
                    />
                  )}
                </div>
              </div>

              {/* Disponible / Restante Box */}
              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xs text-xs">
                <span className="text-slate-600 font-medium">
                  {isOverBudget ? 'Monto Excedido:' : 'Disponible por gastar:'}
                </span>
                <span
                  className={`font-mono font-bold text-sm ${
                    isOverBudget
                      ? 'text-rose-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {isOverBudget
                    ? `- ${monedaSimbolo} ${(spent - budget).toFixed(2)}`
                    : `${monedaSimbolo} ${remaining.toFixed(2)}`}
                </span>
              </div>

              {/* Subcategories Breakdown Toggle */}
              <div className="mt-3 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setExpandedCategoryId(isExpanded ? null : cat.id)}
                  className="w-full text-left text-[11px] text-slate-500 hover:text-slate-800 flex items-center justify-between cursor-pointer py-1"
                >
                  <span>
                    Subcategorías ({Object.keys(subcatsSpent).length} registradas este mes)
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                {isExpanded && (
                  <div className="mt-2 space-y-1.5 pl-1 animate-fadeIn">
                    {Object.keys(subcatsSpent).length === 0 ? (
                      <p className="text-[11px] italic text-slate-400 py-1">
                        Sin consumos registrados en este mes.
                      </p>
                    ) : (
                      Object.entries(subcatsSpent).map(([subcat, amount]) => (
                        <div
                          key={subcat}
                          className="flex items-center justify-between text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200/80 rounded-xs"
                        >
                          <span className="text-slate-700 font-medium">
                            {subcat}
                          </span>
                          <span className="font-mono font-semibold text-slate-900">
                            {monedaSimbolo} {amount.toFixed(2)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* FOOTER TIP BANNER */}
      <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-sm flex items-start gap-3 text-xs">
        <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-emerald-950 mb-0.5">Consejo de Control Presupuestal</h4>
          <p className="text-slate-700 leading-relaxed">
            Al registrar cualquier gasto por voz, texto o foto de boleta, el sistema clasifica automáticamente el consumo en su respectiva categoría y actualiza en tiempo real el presupuesto disponible que te queda para el resto del mes.
          </p>
        </div>
      </div>
    </div>
  );
};
