export type TipoOperacion = 'GASTO' | 'INGRESO';
export type MetodoPago = 'EFECTIVO' | 'DEBITO' | 'CREDITO';

export interface TransactionItem {
  concepto: string;
  monto: number;
  categoria_principal: string;
  subcategoria: string;
}

export interface TransactionRecord {
  id: string;
  fecha: string; // YYYY-MM-DD
  tipo_operacion: TipoOperacion;
  monto_total: number;
  metodo_pago: MetodoPago;
  cuotas: number;
  monto_cuota_mensual: number;
  items: TransactionItem[];
  alerta_ahorro_comprometido: boolean;
  dinero_libre_restante: number;
  mensaje_usuario: string;
  // Store / Merchant & Smart Title Summary
  comercio?: string;
  titulo_resumen?: string;
  entidad_financiera?: string; // e.g. "Interbank", "BCP", "BBVA", "Scotiabank"
  cuota_actual?: number; // e.g. 3 (if registering the 3rd installment)
  cuotas_restantes?: number; // e.g. 2 (if 2 installments remain)
  cuotas_finalizadas?: boolean; // True if debt/installments are fully paid off or liquidated
  // Classification: Fixed Recurrent Expense vs One-time Purchase
  es_gasto_fijo?: boolean; // True if it's a recurring monthly fixed commitment (Rent, Utilities, Subscriptions, Tuition, etc.)
  frecuencia_recurrencia?: 'MENSUAL' | 'PUNTUAL';
  estado_pago?: 'PAGADO' | 'PENDIENTE'; // PAGADO = Executed cash outflow, PENDIENTE = Scheduled future commitment (does not deduct bank cash yet)
  dia_pago_mensual?: number; // e.g. 21 if due on the 21st of each month
  // Metadata for app state
  descripcionOriginal?: string;
  imagenComprobanteUrl?: string;
  audioGrabadoUrl?: string;
  esCuotaProyectada?: boolean;
  idTransaccionOrigen?: string;
}

export interface BudgetConfig {
  ingresoMensual: number;
  porcentajeAhorroMeta: number; // Default 10%
  monedaSimbolo: string; // Default "S/."
}

export interface BudgetSummary {
  ingresoMensual: number; // Base configured salary
  ingresosSueldoCobrados: number; // Salary received so far this month
  ingresosAdicionalesCobrados: number; // Extra / additional income received this month
  ingresosCobradosTotal: number; // Total actual cash received in bank
  ingresoTotalProyectadoMes: number; // Projected total month income (Base Salary + Extras)
  montoPendienteCobrar: number; // Base salary remaining to be collected
  porcentajeCobrado: number;
  metaAhorroMonto: number;
  gastosTotalesProyectados: number;
  gastosEjecutadosReal: number;
  gastosPendientesTotal: number;
  gastosFijos: number;
  cuotasCredito: number;
  cuotasCreditoPendientes?: number;
  gastosVariables: number;
  saldoBancoReal: number;
  dineroLibreDisponible: number;
  saldoInicialMesAnterior?: number; // Carryover / Rollover free balance from previous month
  dineroLibreMesActual?: number; // Free money generated strictly in current month
  alertaAhorroComprometido: boolean;
}

export interface GoogleSheetsJsonOutput {
  fecha: string;
  tipo_operacion: TipoOperacion;
  monto_total: number;
  metodo_pago: MetodoPago;
  cuotas: number;
  monto_cuota_mensual: number;
  items: TransactionItem[];
  alerta_ahorro_comprometido: boolean;
  dinero_libre_restante: number;
  mensaje_usuario: string;
}

export interface CategoryDefinition {
  id: string;
  nombre: string;
  color: string;
  subcategoriasBase: string[];
  iconoNombre: string;
}

export const CATEGORIAS_BASE: CategoryDefinition[] = [
  {
    id: 'alimentacion',
    nombre: 'Alimentación y Dieta',
    color: '#10B981', // Emerald
    iconoNombre: 'Apple',
    subcategoriasBase: [
      'Supermercado',
      'Menú / Almuerzo',
      'Insumos de dieta estructurada',
      'Proteína y suplementos',
      'Compras de alimento planificado'
    ]
  },
  {
    id: 'gastos_hormiga',
    nombre: 'Gastos Hormiga y Antojos',
    color: '#F59E0B', // Amber
    iconoNombre: 'Coffee',
    subcategoriasBase: [
      'Comida chatarra',
      'Deliveries no planificados',
      'Antojos espontáneos (pollo a la brasa, postres, etc.)',
      'Bebidas y snacks',
      'Paseos y caprichos menores'
    ]
  },
  {
    id: 'vehiculo',
    nombre: 'Vehículo',
    color: '#3B82F6', // Blue
    iconoNombre: 'Car',
    subcategoriasBase: [
      'Cochera',
      'Mantenimiento preventivo/correctivo',
      'Gasolina / Combustible',
      'Peajes',
      'Repuestos y lavado'
    ]
  },
  {
    id: 'servicios_fijos',
    nombre: 'Servicios y Gastos Fijos',
    color: '#8B5CF6', // Purple
    iconoNombre: 'Home',
    subcategoriasBase: [
      'Alquiler de departamento',
      'Mantenimiento de edificio',
      'Agua',
      'Luz / Electricidad',
      'Internet',
      'Teléfono móvil',
      'Gas domiciliario',
      'Suscripciones (gimnasio, streaming)'
    ]
  },
  {
    id: 'hogar_mantenimiento',
    nombre: 'Hogar y Mantenimiento',
    color: '#06B6D4', // Cyan
    iconoNombre: 'Wrench',
    subcategoriasBase: [
      'Muebles y Equipamiento',
      'Electrodomésticos y Balanza',
      'Reparaciones y Arreglos del Hogar',
      'Artículos para el hogar y Menaje',
      'Ferretería y Herramientas',
      'Decoración y Mejoras'
    ]
  },
  {
    id: 'ocio_salidas',
    nombre: 'Ocio y Salidas',
    color: '#EC4899', // Pink
    iconoNombre: 'PartyPopper',
    subcategoriasBase: [
      'Salidas en pareja',
      'Compras por internet/tecnología',
      'Viajes/escapadas',
      'Pasatiempos y entretenimiento'
    ]
  },
  {
    id: 'credito_compromisos',
    nombre: 'Crédito y Compromisos',
    color: '#EF4444', // Red
    iconoNombre: 'CreditCard',
    subcategoriasBase: [
      'Pagos de tarjeta de crédito',
      'Compras diferidas en cuotas',
      'Préstamos y amortizaciones'
    ]
  }
];
