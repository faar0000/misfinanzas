import { TransactionRecord } from '../types';

/**
 * Resolves the true main category for an item or transaction.
 * Ensures health food, proteins, fruits, vegetables, groceries, and diet inputs
 * are classified as "Alimentación y Dieta", while "Gastos Hormiga y Antojos"
 * is strictly reserved for junk food, snacks, beer, pizza, fast food, and spontaneous treats.
 */
export const getNormalizedCategoryName = (
  catName?: string,
  subcatName?: string,
  concepto?: string,
  extraText?: string
): string => {
  const c = (catName || '').toLowerCase().trim();
  const s = (subcatName || '').toLowerCase().trim();
  const k = (concepto || '').toLowerCase().trim();
  const e = (extraText || '').toLowerCase().trim();
  const fullText = `${c} ${s} ${k} ${e}`;

  // 1. Explicit Junk Food / Antojos check
  const isJunkFoodOrAntojo =
    s.includes('chatarra') ||
    s.includes('galleta') ||
    s.includes('cerveza') ||
    s.includes('pollo a la brasa') ||
    s.includes('pizza') ||
    s.includes('hamburguesa') ||
    s.includes('gaseosa') ||
    s.includes('snack') ||
    s.includes('dulce') ||
    s.includes('golosina') ||
    s.includes('postre') ||
    s.includes('helado') ||
    s.includes('papas fritas') ||
    s.includes('piqueo') ||
    s.includes('antojo') ||
    s.includes('capricho') ||
    s.includes('licor') ||
    s.includes('trago') ||
    k.includes('chatarra') ||
    k.includes('galleta') ||
    k.includes('cerveza') ||
    k.includes('pollo a la brasa') ||
    k.includes('pizza') ||
    k.includes('hamburguesa') ||
    k.includes('gaseosa') ||
    k.includes('snack') ||
    k.includes('dulce') ||
    k.includes('golosina') ||
    k.includes('postre') ||
    k.includes('helado') ||
    k.includes('papas fritas') ||
    k.includes('piqueo') ||
    k.includes('antojo') ||
    c.includes('hormiga') ||
    c.includes('antojo') ||
    fullText.includes('delivery no planificado');

  if (isJunkFoodOrAntojo) {
    return 'Gastos Hormiga y Antojos';
  }

  // 2. Home Equipment, Furniture, Scale, Appliances, Hardware, Home Repairs & Cleaning Supplies (CAPEX / Variables)
  const isHouseholdEquipmentOrRepair =
    c.includes('mueble') ||
    c.includes('equipamiento') ||
    c.includes('ferreter') ||
    c.includes('hogar') ||
    s.includes('mueble') ||
    s.includes('balanza') ||
    s.includes('electrodom') ||
    s.includes('lavadora') ||
    s.includes('refrigerador') ||
    s.includes('nevera') ||
    s.includes('microondas') ||
    s.includes('licuadora') ||
    s.includes('artículos para el hogar') ||
    s.includes('articulos para el hogar') ||
    s.includes('artículos de limpieza') ||
    s.includes('articulos de limpieza') ||
    s.includes('limpieza del hogar') ||
    s.includes('limpieza de casa') ||
    s.includes('articulos limpieza') ||
    s.includes('artículos limpieza') ||
    s.includes('menaje') ||
    s.includes('utensilio') ||
    s.includes('cocina') ||
    s.includes('reparaci') ||
    s.includes('arreglo') ||
    s.includes('gasfiter') ||
    s.includes('fontaner') ||
    s.includes('electricista') ||
    s.includes('pintura') ||
    s.includes('cerrajer') ||
    s.includes('herramienta') ||
    s.includes('ferreter') ||
    s.includes('decoraci') ||
    s.includes('detergente') ||
    s.includes('trapeador') ||
    s.includes('escoba') ||
    k.includes('mueble') ||
    k.includes('mesa') ||
    k.includes('silla') ||
    k.includes('escritorio') ||
    k.includes('cama') ||
    k.includes('colchón') ||
    k.includes('colchon') ||
    k.includes('ropero') ||
    k.includes('closet') ||
    k.includes('sillón') ||
    k.includes('sillon') ||
    k.includes('sofa') ||
    k.includes('sofá') ||
    k.includes('balanza') ||
    k.includes('lavadora') ||
    k.includes('secadora') ||
    k.includes('refrigerador') ||
    k.includes('nevera') ||
    k.includes('microondas') ||
    k.includes('licuadora') ||
    k.includes('cafetera') ||
    k.includes('tostadora') ||
    k.includes('hervidor') ||
    k.includes('freidora') ||
    k.includes('air fryer') ||
    k.includes('televisor') ||
    k.includes('plancha') ||
    k.includes('aspiradora') ||
    k.includes('ventilador') ||
    k.includes('electrodom') ||
    k.includes('reparaci') ||
    k.includes('arreglo') ||
    k.includes('gasfiter') ||
    k.includes('fontaner') ||
    k.includes('electricista') ||
    k.includes('cerrajer') ||
    k.includes('pintura') ||
    k.includes('utensilio') ||
    k.includes('olla') ||
    k.includes('sartén') ||
    k.includes('sarten') ||
    k.includes('vajilla') ||
    k.includes('cubierto') ||
    k.includes('cortina') ||
    k.includes('lámpara') ||
    k.includes('lampara') ||
    k.includes('sábana') ||
    k.includes('sabana') ||
    k.includes('almohada') ||
    k.includes('toalla') ||
    k.includes('alfombra') ||
    k.includes('ferreter') ||
    k.includes('taladro') ||
    k.includes('tornillo') ||
    k.includes('martillo') ||
    k.includes('clavo') ||
    k.includes('foco') ||
    k.includes('bombilla') ||
    k.includes('enchufe') ||
    k.includes('artículos de limpieza') ||
    k.includes('articulos de limpieza') ||
    k.includes('detergente') ||
    k.includes('lejía') ||
    k.includes('lejia') ||
    k.includes('escoba') ||
    k.includes('trapeador') ||
    k.includes('limpiador') ||
    k.includes('lavavajilla') ||
    k.includes('desinfectante') ||
    k.includes('donaci');

  if (isHouseholdEquipmentOrRepair) {
    return 'Hogar y Mantenimiento';
  }

  // 3. Vehicle & Transport
  const isVehicle =
    c.includes('vehíc') ||
    c.includes('vehic') ||
    c.includes('auto') ||
    c.includes('carro') ||
    c.includes('transporte') ||
    c.includes('movilidad') ||
    c.includes('taxi') ||
    s.includes('estacionamiento') ||
    s.includes('cochera') ||
    s.includes('parqueo') ||
    s.includes('gasolina') ||
    s.includes('combustible') ||
    s.includes('peaje') ||
    s.includes('lavado de auto') ||
    s.includes('lavado de carro') ||
    s.includes('lavado auto') ||
    s.includes('lavado carro') ||
    s.includes('car wash') ||
    s.includes('carwash') ||
    s.includes('repuesto de auto') ||
    s.includes('repuesto auto') ||
    s.includes('repuestos auto') ||
    s.includes('taxi') ||
    s.includes('uber') ||
    s.includes('cabify') ||
    s.includes('mantenimiento auto') ||
    s.includes('mantenimiento vehicular') ||
    k.includes('estacionamiento') ||
    k.includes('cochera') ||
    k.includes('parqueo') ||
    k.includes('gasolina') ||
    k.includes('combustible') ||
    k.includes('grifo') ||
    k.includes('repsol') ||
    k.includes('primax') ||
    k.includes('peaje') ||
    k.includes('lavado de auto') ||
    k.includes('lavado de carro') ||
    k.includes('lavado auto') ||
    k.includes('lavado carro') ||
    k.includes('car wash') ||
    k.includes('carwash') ||
    k.includes('taxi') ||
    k.includes('pasaje') ||
    k.includes('uber') ||
    k.includes('cabify') ||
    e.includes('lavado de carro') ||
    e.includes('lavado de auto') ||
    e.includes('lavado carro') ||
    e.includes('lavado auto') ||
    (c.includes('vehic') && (s.includes('lavado') || k.includes('lavado')));

  if (isVehicle) {
    return 'Vehículo';
  }

  // 4. Fixed Recurring Structural Utilities & Contracts (OPEX)
  const isServicesOrFixed =
    c.includes('servicios') ||
    c.includes('fijo') ||
    c.includes('vivienda') ||
    s.includes('alquiler') ||
    s.includes('agua') ||
    s.includes('luz') ||
    s.includes('electricidad') ||
    s.includes('internet') ||
    s.includes('teléfono') ||
    s.includes('telefono') ||
    s.includes('celular') ||
    s.includes('gas') ||
    s.includes('seguro') ||
    s.includes('educaci') ||
    s.includes('mantenimiento de edificio') ||
    s.includes('mantenimiento de condominio') ||
    s.includes('suscripcion') ||
    s.includes('suscripción') ||
    k.includes('alquiler') ||
    k.includes('sedapal') ||
    k.includes('enel') ||
    k.includes('luz del sur') ||
    k.includes('cálidda') ||
    k.includes('calidda') ||
    k.includes('balon de gas') ||
    k.includes('balón de gas') ||
    k.includes('arbitrio') ||
    k.includes('predial');

  if (isServicesOrFixed) {
    return 'Servicios y Gastos Fijos';
  }

  // 5. Credit & Debt Commitments
  const isCredit =
    c.includes('crédito') ||
    c.includes('credito') ||
    c.includes('compromiso') ||
    s.includes('tarjeta') ||
    s.includes('préstamo') ||
    s.includes('prestamo') ||
    s.includes('cuotas');

  if (isCredit) {
    return 'Crédito y Compromisos';
  }

  // 5. Leisure & Outings
  const isLeisure =
    c.includes('ocio') ||
    c.includes('salida') ||
    s.includes('viaje') ||
    s.includes('cine') ||
    s.includes('restaurante') ||
    s.includes('pasatiempo');

  if (isLeisure) {
    return 'Ocio y Salidas';
  }

  // 6. Healthy Food / Diet / Groceries
  const isHealthyFoodOrGrocery =
    c.includes('alimentac') ||
    c.includes('dieta') ||
    s.includes('proteín') ||
    s.includes('protein') ||
    s.includes('dieta') ||
    s.includes('fruta') ||
    s.includes('lácteo') ||
    s.includes('lacteo') ||
    s.includes('verdura') ||
    s.includes('carne') ||
    s.includes('supermercado') ||
    s.includes('abarrote') ||
    s.includes('víveres') ||
    s.includes('viveres') ||
    s.includes('insumo') ||
    s.includes('alimento') ||
    s.includes('huevo') ||
    s.includes('pan') ||
    s.includes('leche') ||
    s.includes('yogurt') ||
    s.includes('queso') ||
    s.includes('empaque') ||
    k.includes('proteín') ||
    k.includes('protein') ||
    k.includes('dieta') ||
    k.includes('fruta') ||
    k.includes('lácteo') ||
    k.includes('lacteo') ||
    k.includes('verdura') ||
    k.includes('carne') ||
    k.includes('supermercado') ||
    k.includes('abarrote') ||
    k.includes('víveres') ||
    k.includes('viveres') ||
    k.includes('insumo') ||
    k.includes('alimento');

  if (isHealthyFoodOrGrocery) {
    return 'Alimentación y Dieta';
  }

  // 7. Respect explicit category name if provided
  if (catName && catName !== 'Otros' && catName !== 'General') {
    return catName;
  }

  return 'Alimentación y Dieta';
};

/**
 * Normalizes and unifies subcategory names to prevent duplicates in budget breakdowns,
 * category reports, and transaction details.
 * Maps synonyms, abbreviations, and informal names to the canonical base subcategories
 * defined in CATEGORIAS_BASE, or standardizes unknown custom subcategories into Clean Title Case.
 */
export const getNormalizedSubcategoryName = (
  categoryNameOrId?: string,
  subcatName?: string,
  concepto?: string,
  extraText?: string
): string => {
  const cat = (categoryNameOrId || '').toLowerCase().trim();
  const sub = (subcatName || '').toLowerCase().trim();
  const con = (concepto || '').toLowerCase().trim();
  const ext = (extraText || '').toLowerCase().trim();
  const all = `${sub} ${con} ${ext}`;

  // Helper to format unknown text into Title Case without duplicate spaces
  const cleanTitleCase = (str: string): string => {
    if (!str) return 'General';
    return str
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[_\-]+/g, ' ')
      .split(' ')
      .map((word) => {
        if (word.length === 0) return '';
        const lower = word.toLowerCase();
        // Common Spanish prepositions/articles keep lowercase unless first word
        if (['de', 'del', 'la', 'las', 'el', 'los', 'en', 'y', 'o', 'por', 'a'].includes(lower)) {
          return lower;
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ')
      .replace(/^[a-z]/, (match) => match.toUpperCase());
  };

  // 1. ALIMENTACIÓN Y DIETA (alimentacion)
  if (
    cat === 'alimentacion' ||
    cat.includes('alimentac') ||
    cat.includes('dieta')
  ) {
    if (
      all.includes('menu') ||
      all.includes('menú') ||
      all.includes('almuerzo') ||
      all.includes('desayuno') ||
      all.includes('cena') ||
      all.includes('comida corrida') ||
      all.includes('alimento planificado') ||
      all.includes('comida preparada') ||
      all.includes('menu ejecutivo') ||
      all.includes('menú ejecutivo')
    ) {
      return 'Menú / Almuerzo';
    }

    if (
      all.includes('prote') ||
      all.includes('pollo') ||
      all.includes('carne') ||
      all.includes('pescado') ||
      all.includes('huevo') ||
      all.includes('suplement') ||
      all.includes('creatina') ||
      all.includes('whey') ||
      all.includes('atun') ||
      all.includes('atún') ||
      all.includes('pechuga')
    ) {
      return 'Proteína y suplementos';
    }

    if (
      all.includes('dieta') ||
      all.includes('fruta') ||
      all.includes('verdura') ||
      all.includes('palta') ||
      all.includes('avena') ||
      all.includes('frutos secos') ||
      all.includes('ensalada') ||
      all.includes('saludable')
    ) {
      return 'Insumos de dieta estructurada';
    }

    if (
      all.includes('supermercado') ||
      all.includes('viveres') ||
      all.includes('víveres') ||
      all.includes('mercado') ||
      all.includes('abarrote') ||
      all.includes('compra') ||
      all.includes('tottus') ||
      all.includes('metro') ||
      all.includes('plaza vea') ||
      all.includes('wong') ||
      all.includes('makro') ||
      all.includes('mass')
    ) {
      return 'Supermercado';
    }

    if (sub) {
      if (sub.includes('menu') || sub.includes('menú') || sub.includes('almuerzo') || sub.includes('desayuno') || sub.includes('cena')) return 'Menú / Almuerzo';
      if (sub.includes('super') || sub.includes('compra') || sub.includes('viver') || sub.includes('mercado')) return 'Supermercado';
      if (sub.includes('dieta') || sub.includes('salud')) return 'Insumos de dieta estructurada';
      if (sub.includes('prote')) return 'Proteína y suplementos';
      return cleanTitleCase(subcatName || '');
    }

    return 'Supermercado';
  }

  // 2. GASTOS HORMIGA Y ANTOJOS (gastos_hormiga)
  if (
    cat === 'gastos_hormiga' ||
    cat.includes('hormiga') ||
    cat.includes('antojo')
  ) {
    if (
      all.includes('chatarra') ||
      all.includes('pizza') ||
      all.includes('hamburguesa') ||
      all.includes('burger') ||
      all.includes('pollo a la brasa') ||
      all.includes('salchipapa') ||
      all.includes('bembos') ||
      all.includes('kfc') ||
      all.includes('mcdonald') ||
      all.includes('fast food')
    ) {
      return 'Comida chatarra';
    }

    if (
      all.includes('delivery') ||
      all.includes('rappi') ||
      all.includes('pedidosya') ||
      all.includes('ubereats') ||
      all.includes('no planificado')
    ) {
      return 'Deliveries no planificados';
    }

    if (
      all.includes('bebida') ||
      all.includes('snack') ||
      all.includes('gaseosa') ||
      all.includes('cerveza') ||
      all.includes('galleta') ||
      all.includes('piqueo') ||
      all.includes('trago') ||
      all.includes('licor') ||
      all.includes('chips')
    ) {
      return 'Bebidas y snacks';
    }

    if (
      all.includes('paseo') ||
      all.includes('capricho') ||
      all.includes('menor')
    ) {
      return 'Paseos y caprichos menores';
    }

    if (
      all.includes('antojo') ||
      all.includes('postre') ||
      all.includes('helado') ||
      all.includes('dulce') ||
      all.includes('chocolate') ||
      all.includes('torta') ||
      all.includes('pastel')
    ) {
      return 'Antojos espontáneos';
    }

    if (sub) {
      if (sub.includes('chatarra') || sub.includes('fast food')) return 'Comida chatarra';
      if (sub.includes('delivery')) return 'Deliveries no planificados';
      if (sub.includes('bebida') || sub.includes('snack') || sub.includes('cerveza')) return 'Bebidas y snacks';
      if (sub.includes('antojo') || sub.includes('postre')) return 'Antojos espontáneos';
      if (sub.includes('capricho')) return 'Paseos y caprichos menores';
      return cleanTitleCase(subcatName || '');
    }

    return 'Antojos espontáneos';
  }

  // 3. VEHÍCULO (vehiculo)
  if (
    cat === 'vehiculo' ||
    cat.includes('vehic') ||
    cat.includes('auto') ||
    cat.includes('carro') ||
    cat.includes('transporte') ||
    cat.includes('movilidad')
  ) {
    if (
      all.includes('gasolina') ||
      all.includes('combustible') ||
      all.includes('grifo') ||
      all.includes('primax') ||
      all.includes('repsol') ||
      all.includes('pecsa') ||
      all.includes('petroperu') ||
      all.includes('gasohol') ||
      all.includes('diesel') ||
      all.includes('diésel')
    ) {
      return 'Gasolina / Combustible';
    }

    if (
      all.includes('cochera') ||
      all.includes('estacionamiento') ||
      all.includes('parqueo') ||
      all.includes('garage')
    ) {
      return 'Cochera';
    }

    if (
      all.includes('peaje') ||
      all.includes('rutas de lima') ||
      all.includes('linea amarilla')
    ) {
      return 'Peajes';
    }

    if (
      all.includes('lavado') ||
      all.includes('lavada') ||
      all.includes('car wash') ||
      all.includes('carwash') ||
      all.includes('repuesto') ||
      all.includes('llanta') ||
      all.includes('bateria') ||
      all.includes('batería')
    ) {
      return 'Repuestos y lavado';
    }

    if (
      all.includes('mantenimiento') ||
      all.includes('mecanico') ||
      all.includes('mecánico') ||
      all.includes('aceite') ||
      all.includes('revision') ||
      all.includes('revisión') ||
      all.includes('frenos') ||
      all.includes('afinamiento')
    ) {
      return 'Mantenimiento preventivo/correctivo';
    }

    if (
      all.includes('taxi') ||
      all.includes('pasaje') ||
      all.includes('uber') ||
      all.includes('cabify') ||
      all.includes('indrive') ||
      all.includes('didi') ||
      all.includes('metro') ||
      all.includes('bus')
    ) {
      return 'Transporte público y taxi';
    }

    if (sub) {
      if (sub.includes('gasolin') || sub.includes('combust')) return 'Gasolina / Combustible';
      if (sub.includes('cocher') || sub.includes('estacion') || sub.includes('parqueo')) return 'Cochera';
      if (sub.includes('peaje')) return 'Peajes';
      if (sub.includes('lavad') || sub.includes('repuest')) return 'Repuestos y lavado';
      if (sub.includes('mantenim') || sub.includes('mecanic')) return 'Mantenimiento preventivo/correctivo';
      if (sub.includes('taxi') || sub.includes('uber') || sub.includes('pasaje')) return 'Transporte público y taxi';
      return cleanTitleCase(subcatName || '');
    }

    return 'Gasolina / Combustible';
  }

  // 4. SERVICIOS Y GASTOS FIJOS (servicios_fijos)
  if (
    cat === 'servicios_fijos' ||
    cat.includes('servicio') ||
    cat.includes('fijo')
  ) {
    if (
      all.includes('alquiler') ||
      all.includes('departamento') ||
      all.includes('depa') ||
      all.includes('renta')
    ) {
      return 'Alquiler de departamento';
    }

    if (
      all.includes('mantenimiento') ||
      all.includes('edificio') ||
      all.includes('condominio')
    ) {
      return 'Mantenimiento de edificio';
    }

    if (
      all.includes('luz') ||
      all.includes('electricidad') ||
      all.includes('enel') ||
      all.includes('luz del sur')
    ) {
      return 'Luz / Electricidad';
    }

    if (
      all.includes('agua') ||
      all.includes('sedapal')
    ) {
      return 'Agua';
    }

    if (
      all.includes('internet') ||
      all.includes('cable') ||
      all.includes('fibra') ||
      all.includes('win') ||
      all.includes('movistar') ||
      all.includes('claro') ||
      all.includes('telefono') ||
      all.includes('teléfono') ||
      all.includes('celular') ||
      all.includes('entel') ||
      all.includes('plan celular')
    ) {
      return 'Internet y Telefonía';
    }

    if (
      all.includes('gas') ||
      all.includes('calidda') ||
      all.includes('cálidda') ||
      all.includes('balon') ||
      all.includes('balón')
    ) {
      return 'Gas domiciliario';
    }

    if (
      all.includes('gym') ||
      all.includes('gimnasio') ||
      all.includes('smartfit') ||
      all.includes('netflix') ||
      all.includes('spotify') ||
      all.includes('prime') ||
      all.includes('disney') ||
      all.includes('icloud') ||
      all.includes('streaming') ||
      all.includes('suscripci')
    ) {
      return 'Suscripciones (gimnasio, streaming)';
    }

    if (
      all.includes('seguro') ||
      all.includes('colegio') ||
      all.includes('universidad') ||
      all.includes('pension') ||
      all.includes('pensión') ||
      all.includes('arbitrio') ||
      all.includes('predial')
    ) {
      return 'Pensiones y Seguros';
    }

    if (sub) {
      if (sub.includes('alquiler')) return 'Alquiler de departamento';
      if (sub.includes('mantenimiento')) return 'Mantenimiento de edificio';
      if (sub.includes('luz') || sub.includes('electric')) return 'Luz / Electricidad';
      if (sub.includes('agua')) return 'Agua';
      if (sub.includes('internet') || sub.includes('telefon') || sub.includes('celular')) return 'Internet y Telefonía';
      if (sub.includes('gas')) return 'Gas domiciliario';
      if (sub.includes('suscrip') || sub.includes('gym') || sub.includes('stream')) return 'Suscripciones (gimnasio, streaming)';
      if (sub.includes('seguro') || sub.includes('pension')) return 'Pensiones y Seguros';
      return cleanTitleCase(subcatName || '');
    }

    return 'Servicios y Gastos Fijos';
  }

  // 5. HOGAR Y MANTENIMIENTO (hogar_mantenimiento)
  if (
    cat === 'hogar_mantenimiento' ||
    cat.includes('hogar') ||
    cat.includes('mantenimiento')
  ) {
    if (
      all.includes('mueble') ||
      all.includes('mesa') ||
      all.includes('silla') ||
      all.includes('escritorio') ||
      all.includes('cama') ||
      all.includes('colchon') ||
      all.includes('colchón') ||
      all.includes('ropero') ||
      all.includes('closet') ||
      all.includes('sofa') ||
      all.includes('sofá') ||
      all.includes('sillon') ||
      all.includes('sillón')
    ) {
      return 'Muebles y Equipamiento';
    }

    if (
      all.includes('balanza') ||
      all.includes('lavadora') ||
      all.includes('secadora') ||
      all.includes('refrigerador') ||
      all.includes('nevera') ||
      all.includes('microondas') ||
      all.includes('licuadora') ||
      all.includes('cafetera') ||
      all.includes('tostadora') ||
      all.includes('hervidor') ||
      all.includes('freidora') ||
      all.includes('air fryer') ||
      all.includes('televisor') ||
      all.includes('plancha') ||
      all.includes('aspiradora') ||
      all.includes('ventilador') ||
      all.includes('electrodom')
    ) {
      return 'Electrodomésticos y Balanza';
    }

    if (
      all.includes('reparaci') ||
      all.includes('arreglo') ||
      all.includes('gasfiter') ||
      all.includes('fontaner') ||
      all.includes('electricista') ||
      all.includes('cerrajer') ||
      all.includes('pintura') ||
      all.includes('instalaci')
    ) {
      return 'Reparaciones y Arreglos del Hogar';
    }

    if (
      all.includes('ferreter') ||
      all.includes('taladro') ||
      all.includes('martillo') ||
      all.includes('herramienta') ||
      all.includes('tornillo') ||
      all.includes('clavo')
    ) {
      return 'Ferretería y Herramientas';
    }

    if (
      all.includes('cortina') ||
      all.includes('lampara') ||
      all.includes('lámpara') ||
      all.includes('alfombra') ||
      all.includes('decoraci') ||
      all.includes('cuadro')
    ) {
      return 'Decoración y Mejoras';
    }

    if (
      all.includes('olla') ||
      all.includes('sarten') ||
      all.includes('sartén') ||
      all.includes('vajilla') ||
      all.includes('cubierto') ||
      all.includes('menaje') ||
      all.includes('utensilio') ||
      all.includes('toalla') ||
      all.includes('sabana') ||
      all.includes('sábana') ||
      all.includes('almohada') ||
      all.includes('limpieza') ||
      all.includes('detergente') ||
      all.includes('escoba') ||
      all.includes('trapeador') ||
      all.includes('articulo') ||
      all.includes('artículo')
    ) {
      return 'Artículos para el hogar y Menaje';
    }

    if (sub) {
      if (sub.includes('mueble')) return 'Muebles y Equipamiento';
      if (sub.includes('electro') || sub.includes('balanza')) return 'Electrodomésticos y Balanza';
      if (sub.includes('reparac') || sub.includes('arregl') || sub.includes('gasfiter')) return 'Reparaciones y Arreglos del Hogar';
      if (sub.includes('ferret') || sub.includes('herram')) return 'Ferretería y Herramientas';
      if (sub.includes('decorac')) return 'Decoración y Mejoras';
      if (sub.includes('menaje') || sub.includes('articul') || sub.includes('limpieza')) return 'Artículos para el hogar y Menaje';
      return cleanTitleCase(subcatName || '');
    }

    return 'Muebles y Equipamiento';
  }

  // 6. OCIO Y SALIDAS (ocio_salidas)
  if (
    cat === 'ocio_salidas' ||
    cat.includes('ocio') ||
    cat.includes('salida')
  ) {
    if (
      all.includes('salida') ||
      all.includes('restaurante') ||
      all.includes('cena') ||
      all.includes('almuerzo') ||
      all.includes('bar') ||
      all.includes('pareja')
    ) {
      return 'Salidas en pareja';
    }

    if (
      all.includes('internet') ||
      all.includes('online') ||
      all.includes('amazon') ||
      all.includes('aliexpress') ||
      all.includes('tecnologia') ||
      all.includes('tecnología') ||
      all.includes('gadget') ||
      all.includes('compra')
    ) {
      return 'Compras por internet/tecnología';
    }

    if (
      all.includes('viaje') ||
      all.includes('escapada') ||
      all.includes('vuelo') ||
      all.includes('hotel') ||
      all.includes('hospedaje') ||
      all.includes('turismo')
    ) {
      return 'Viajes/escapadas';
    }

    if (
      all.includes('cine') ||
      all.includes('concierto') ||
      all.includes('teatro') ||
      all.includes('juego') ||
      all.includes('hobby') ||
      all.includes('pasatiempo') ||
      all.includes('entretenimiento')
    ) {
      return 'Pasatiempos y entretenimiento';
    }

    if (sub) {
      if (sub.includes('salida') || sub.includes('restauran')) return 'Salidas en pareja';
      if (sub.includes('internet') || sub.includes('tecnolog') || sub.includes('online')) return 'Compras por internet/tecnología';
      if (sub.includes('viaje') || sub.includes('escapad')) return 'Viajes/escapadas';
      if (sub.includes('cine') || sub.includes('pasatiemp') || sub.includes('entreten')) return 'Pasatiempos y entretenimiento';
      return cleanTitleCase(subcatName || '');
    }

    return 'Salidas en pareja';
  }

  // 7. CRÉDITO Y COMPROMISOS (credito_compromisos)
  if (
    cat === 'credito_compromisos' ||
    cat.includes('credit') ||
    cat.includes('compromiso')
  ) {
    if (
      all.includes('cuota') ||
      all.includes('diferid')
    ) {
      return 'Compras diferidas en cuotas';
    }

    if (
      all.includes('prestamo') ||
      all.includes('préstamo') ||
      all.includes('amortiz')
    ) {
      return 'Préstamos y amortizaciones';
    }

    if (
      all.includes('tarjeta') ||
      all.includes('pago') ||
      all.includes('estado de cuenta')
    ) {
      return 'Pagos de tarjeta de crédito';
    }

    if (sub) {
      if (sub.includes('tarjeta')) return 'Pagos de tarjeta de crédito';
      if (sub.includes('cuota')) return 'Compras diferidas en cuotas';
      if (sub.includes('prestam') || sub.includes('amortiz')) return 'Préstamos y amortizaciones';
      return cleanTitleCase(subcatName || '');
    }

    return 'Pagos de tarjeta de crédito';
  }

  // Fallback for general custom categories
  if (subcatName && subcatName.trim()) {
    return cleanTitleCase(subcatName);
  }
  if (concepto && concepto.trim()) {
    return cleanTitleCase(concepto);
  }
  return 'General';
};

/**
 * Normalizes recurring payment concepts (e.g., Luz, Agua, Teléfono/Internet, Alquiler, Cochera, Mantenimiento)
 * to group multiple historical receipts under the same recurring service concept.
 */
export const getRecurringConceptKey = (tx: TransactionRecord): string => {
  const fullText = (
    (tx.titulo_resumen || '') +
    ' ' +
    (tx.items[0]?.concepto || '') +
    ' ' +
    (tx.items[0]?.subcategoria || '') +
    ' ' +
    (tx.items[0]?.categoria_principal || '')
  )
    .toLowerCase()
    .trim();

  // 1. Vehicle fuel & gasoline must NOT be confused with domestic gas utility
  const isVehicleFuel =
    fullText.includes('gasolina') ||
    fullText.includes('gasohol') ||
    fullText.includes('combustible') ||
    fullText.includes('grifo') ||
    fullText.includes('primax') ||
    fullText.includes('repsol') ||
    fullText.includes('pecsa') ||
    fullText.includes('petroperu');

  if (isVehicleFuel) {
    return 'combustible_vehiculo';
  }

  if (fullText.includes('mantenimiento')) return 'mantenimiento_edificio';
  if (
    fullText.includes('cochera') ||
    fullText.includes('estacionamiento') ||
    fullText.includes('parqueo') ||
    fullText.includes('garage')
  ) {
    return 'alquiler_cochera';
  }
  if (
    fullText.includes('alquiler') ||
    fullText.includes('departamento') ||
    fullText.includes('depa') ||
    fullText.includes('renta depa')
  ) {
    return 'alquiler_departamento';
  }
  if (
    fullText.includes('luz') ||
    fullText.includes('enel') ||
    fullText.includes('luz del sur') ||
    fullText.includes('electricidad')
  ) {
    return 'servicio_luz';
  }
  if (fullText.includes('agua') || fullText.includes('sedapal')) {
    return 'servicio_agua';
  }
  if (
    fullText.includes('internet') ||
    fullText.includes('cable') ||
    fullText.includes('claro') ||
    fullText.includes('movistar') ||
    fullText.includes('win') ||
    fullText.includes('entel') ||
    fullText.includes('telefono') ||
    fullText.includes('teléfono') ||
    fullText.includes('celular')
  ) {
    return 'servicio_internet_telefono';
  }
  if (
    fullText.includes('calidda') ||
    fullText.includes('cálidda') ||
    fullText.includes('balon de gas') ||
    fullText.includes('balón de gas') ||
    fullText.includes('servicio de gas') ||
    fullText.includes('recibo de gas') ||
    (/\bgas\b/i.test(fullText) && !fullText.includes('gasto') && !fullText.includes('gastron') && !fullText.includes('gasfitero'))
  ) {
    return 'servicio_gas';
  }
  if (
    fullText.includes('arbitrios') ||
    fullText.includes('muni') ||
    fullText.includes('predial')
  ) {
    return 'arbitrios_municipales';
  }
  if (
    fullText.includes('gym') ||
    fullText.includes('gimnasio') ||
    fullText.includes('smartfit')
  ) {
    return 'suscripcion_gimnasio';
  }
  if (
    fullText.includes('colegio') ||
    fullText.includes('escuela') ||
    fullText.includes('universidad') ||
    fullText.includes('pension') ||
    fullText.includes('pensión')
  ) {
    return 'pension_educativa';
  }
  if (fullText.includes('paramount')) return 'suscripcion_paramount';
  if (fullText.includes('netflix')) return 'suscripcion_netflix';
  if (fullText.includes('spotify')) return 'suscripcion_spotify';
  if (fullText.includes('icloud') || fullText.includes('apple')) return 'suscripcion_apple_icloud';
  if (fullText.includes('amazon') || fullText.includes('prime')) return 'suscripcion_amazon_prime';
  if (fullText.includes('disney')) return 'suscripcion_disney';
  if (fullText.includes('hbo') || fullText.includes('max')) return 'suscripcion_hbo_max';

  // Normalize generic concept: strip generic terms like "suscripcion", "servicio", "pago", month names, numbers
  const titleOrConcept = (tx.titulo_resumen || tx.items[0]?.concepto || '').toLowerCase();
  const cleaned = titleOrConcept
    .replace(/\b(suscripcion|suscripción|servicio|pago|cuota|mensual|fee|de|del|la|el|gastos|gasto|fijo)\b/gi, '')
    .replace(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre)\b/gi, '')
    .replace(/\b20\d\d\b/g, '')
    .replace(/[\d]/g, '')
    .replace(/[^\w\s]/gi, '')
    .trim();

  return cleaned || tx.id;
};

/**
  Checks if two transaction records represent the exact same recurring fixed concept.
 */
export const areSameRecurringConcept = (t1: TransactionRecord, t2: TransactionRecord): boolean => {
  if (t1.id === t2.id) return true;
  const key1 = getRecurringConceptKey(t1);
  const key2 = getRecurringConceptKey(t2);
  if (key1 && key2 && key1 === key2) return true;

  const getCleanName = (tx: TransactionRecord) => {
    const raw = (tx.titulo_resumen || tx.items[0]?.concepto || '').toLowerCase();
    return raw
      .replace(/\b(suscripcion|suscripción|servicio|pago|cuota|mensual|fee|de|del|la|el|gastos|gasto|fijo)\b/gi, '')
      .replace(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|setiembre|septiembre|octubre|noviembre|diciembre)\b/gi, '')
      .replace(/\b20\d\d\b/g, '')
      .replace(/[\d]/g, '')
      .replace(/[^\w\s]/gi, '')
      .trim();
  };

  const name1 = getCleanName(t1);
  const name2 = getCleanName(t2);
  if (name1 && name2 && (name1 === name2 || name1.includes(name2) || name2.includes(name1))) {
    return true;
  }

  return false;
};

/**
 * Filter transactions that represent recurring fixed expenses (Rent, Utilities, Subscriptions, Maintenance).
 */
export const filterRawFixedExpenses = (transactions: TransactionRecord[]): TransactionRecord[] => {
  return transactions.filter((t) => {
    if (t.tipo_operacion !== 'GASTO') return false;

    // Multi-installment credit card purchases (> 1 cuota) are tracked separately in cuotas projection
    if (t.metodo_pago === 'CREDITO' && t.cuotas > 1) return false;

    // Vehicle fuel (Gasolina, Repsol, Primax) is an operational variable expense, not a fixed home utility
    const text = (
      (t.titulo_resumen || '') +
      ' ' +
      (t.comercio || '') +
      ' ' +
      t.items.map((i) => `${i.concepto} ${i.subcategoria || ''} ${i.categoria_principal || ''}`).join(' ')
    ).toLowerCase();

    const isVehicleFuel =
      text.includes('gasolina') ||
      text.includes('gasohol') ||
      text.includes('combustible') ||
      text.includes('grifo') ||
      text.includes('primax') ||
      text.includes('repsol') ||
      text.includes('pecsa') ||
      text.includes('petroperu');

    if (isVehicleFuel && t.es_gasto_fijo !== true) return false;

    // 1. Explicitly marked as fixed by user, badge, or recurring settings
    if (t.es_gasto_fijo === true) return true;
    if (t.frecuencia_recurrencia === 'MENSUAL') return true;

    // 2. Pending commitments with payment day or fixed keywords
    if (t.estado_pago === 'PENDIENTE' && Boolean(t.dia_pago_mensual)) return true;

    // Explicitly cancelled or marked as not fixed for executed historical one-time purchases
    if (t.es_gasto_fijo === false && t.frecuencia_recurrencia === 'PUNTUAL' && t.estado_pago !== 'PENDIENTE') {
      return false;
    }

    // 3. Keyword heuristic detection
    const isCleaningOrGrocery =
      text.includes('limpieza') ||
      text.includes('aseo') ||
      text.includes('detergente') ||
      text.includes('desinfectante') ||
      text.includes('jabón') ||
      text.includes('jabon') ||
      text.includes('shampoo') ||
      text.includes('supermercado') ||
      text.includes('abarrotes') ||
      text.includes('víveres') ||
      text.includes('viveres');

    if (isCleaningOrGrocery) return false;

    const hasFixedKeyword =
      text.includes('alquiler') ||
      text.includes('departamento') ||
      text.includes('depa') ||
      text.includes('cochera') ||
      text.includes('estacionamiento') ||
      text.includes('mantenimiento') ||
      text.includes('luz') ||
      text.includes('agua') ||
      text.includes('internet') ||
      text.includes('calidda') ||
      text.includes('cálidda') ||
      text.includes('servicio de gas') ||
      text.includes('recibo de gas') ||
      text.includes('balon de gas') ||
      text.includes('balón de gas') ||
      (/\bgas\b/i.test(text) && !text.includes('gasto') && !text.includes('gastron') && !text.includes('gasfitero')) ||
      text.includes('telefono') ||
      text.includes('teléfono') ||
      text.includes('celular') ||
      text.includes('suscripc') ||
      text.includes('colegio') ||
      text.includes('escuela') ||
      text.includes('pension') ||
      text.includes('pensión') ||
      text.includes('gym') ||
      text.includes('gimnasio') ||
      text.includes('seguro') ||
      text.includes('arbitrios') ||
      text.includes('paramount') ||
      text.includes('netflix') ||
      text.includes('spotify') ||
      text.includes('icloud') ||
      text.includes('prime') ||
      text.includes('disney') ||
      text.includes('hbo') ||
      text.includes('youtube') ||
      text.includes('max') ||
      text.includes('apple') ||
      text.includes('cada mes');

    if (hasFixedKeyword) return true;

    return false;
  });
};

/**
 * Obtains the latest registered/paid transaction for each recurring fixed service concept.
 * This ensures variable services (Luz, Agua, Teléfono) use the exact amount of the LAST PAID MONTH
 * rather than summing or averaging historical receipts.
 */
export const getLatestFixedExpenses = (transactions: TransactionRecord[]): TransactionRecord[] => {
  const rawFixed = filterRawFixedExpenses(transactions);

  // Sort by prioritizing PENDIENTE commitments (unpaid upcoming receipts) first,
  // then explicitly marked es_gasto_fijo, then date descending.
  const sorted = [...rawFixed].sort((a, b) => {
    // 1. Pending commitments take highest precedence
    if (a.estado_pago === 'PENDIENTE' && b.estado_pago !== 'PENDIENTE') return -1;
    if (b.estado_pago === 'PENDIENTE' && a.estado_pago !== 'PENDIENTE') return 1;

    // 2. Explicitly marked as fixed
    if (a.es_gasto_fijo === true && b.es_gasto_fijo !== true) return -1;
    if (b.es_gasto_fijo === true && a.es_gasto_fijo !== true) return 1;

    // 3. Most recent date
    const dateA = new Date(a.fecha);
    const dateB = new Date(b.fecha);
    const timeA = dateA.getTime();
    const timeB = dateB.getTime();
    if (timeA !== timeB) return timeB - timeA;
    return (b.id || '').localeCompare(a.id || '');
  });

  const latestMap = new Map<string, TransactionRecord>();
  sorted.forEach((tx) => {
    const key = getRecurringConceptKey(tx);
    if (!latestMap.has(key)) {
      latestMap.set(key, tx);
    }
  });

  return Array.from(latestMap.values());
};

/**
 * Checks if an income transaction corresponds to the regular base monthly salary (nómina/haberes/planilla).
 * Incomes that are freelance, bonuses, sales, commissions, or other extras are classified as additional incomes.
 */
export const isSalaryIncomeTransaction = (tx: TransactionRecord): boolean => {
  if (tx.tipo_operacion !== 'INGRESO') return false;

  const text = (
    (tx.titulo_resumen || '') +
    ' ' +
    (tx.comercio || '') +
    ' ' +
    (tx.mensaje_usuario || '') +
    ' ' +
    tx.items.map((i) => `${i.concepto} ${i.subcategoria || ''} ${i.categoria_principal || ''}`).join(' ')
  ).toLowerCase();

  // Explicit salary phrases (nómina, haberes, adelantos de sueldo, quincena, etc.)
  const isExplicitSalaryPhrase =
    text.includes('sueldo') ||
    text.includes('salario') ||
    text.includes('adelanto') ||
    text.includes('anticipo') ||
    text.includes('quincena') ||
    text.includes('nómina') ||
    text.includes('nomina') ||
    text.includes('planilla') ||
    text.includes('remuneracion') ||
    text.includes('remuneración') ||
    text.includes('haberes') ||
    text.includes('a cuenta de sueldo') ||
    text.includes('pago mensual') ||
    tx.frecuencia_recurrencia === 'MENSUAL';

  const isExtraOrFreelance =
    text.includes('extra') ||
    text.includes('adicional') ||
    text.includes('freelance') ||
    text.includes('honorario') ||
    text.includes('bono') ||
    text.includes('comision') ||
    text.includes('comisión') ||
    text.includes('venta') ||
    text.includes('interes') ||
    text.includes('interés') ||
    text.includes('rendimiento') ||
    text.includes('dividendo') ||
    text.includes('alquiler cobrado') ||
    text.includes('cashback') ||
    text.includes('reembolso') ||
    text.includes('devolucion') ||
    text.includes('devolución') ||
    text.includes('premio') ||
    text.includes('regalo') ||
    text.includes('propina');

  // If it mentions salary/adelanto/quincena, treat as base salary advance
  if (isExplicitSalaryPhrase) {
    // Only exclude if it's explicitly marked as an extra bonus on top of salary
    if (text.includes('bono extra') || text.includes('ingreso adicional')) return false;
    return true;
  }

  if (isExtraOrFreelance) return false;

  return false;
};

/**
 * Checks if a transaction is a pending fixed expense due within 4 days (or overdue).
 */
export const isUpcomingDueDateAlert = (tx: TransactionRecord, currentDay = new Date().getDate()): boolean => {
  if (tx.tipo_operacion !== 'GASTO') return false;
  if (tx.estado_pago !== 'PENDIENTE') return false;
  
  const dueDay = tx.dia_pago_mensual || 21;
  const daysRemaining = dueDay - currentDay;
  
  // Alert activates if due within 4 days (or overdue)
  return daysRemaining <= 4;
};

export type PyGPersonalTier = 'SUBSISTENCIA' | 'OPERATIVO' | 'DISCRECIONAL' | 'DEUDA_PASIVO';

/**
 * Maps a transaction or item into the Standard Personal P&G (Estado de Resultados) Financial Tiers:
 * 1. SUBSISTENCIA: Costos Fijos Estructurales (Alquiler, Vivienda, Luz, Agua, Internet, Educación, Salud)
 * 2. OPERATIVO: Costos Variables Operativos (Alimentación/Supermercado diario, Combustible, Mantenimiento preventivo)
 * 3. DISCRECIONAL: Gastos Discrecionales (Estilo de Vida, Antojos, Salidas, Ocio, Compras)
 * 4. DEUDA_PASIVO: Servicio de Deuda / Reducción de Pasivos (Cuotas de Crédito, Amortizaciones de Tarjeta o Préstamo)
 */
export const getFinancialTier = (
  catName: string,
  subcatName: string,
  concepto: string,
  metodoPago: string,
  cuotas: number,
  esGastoFijo?: boolean
): PyGPersonalTier => {
  const c = catName.toLowerCase().trim();
  const s = subcatName.toLowerCase().trim();
  const k = concepto.toLowerCase().trim();
  const text = `${c} ${s} ${k}`;

  // 1. Debt Service / Liabilities reduction
  if (
    c.includes('crédito') ||
    c.includes('credito') ||
    c.includes('compromisos') ||
    s.includes('tarjeta') ||
    s.includes('préstamo') ||
    s.includes('prestamo') ||
    s.includes('cuotas') ||
    s.includes('amortización') ||
    s.includes('amortizacion') ||
    k.includes('tarjeta') ||
    k.includes('préstamo') ||
    k.includes('prestamo') ||
    k.includes('amortización') ||
    (metodoPago === 'CREDITO' && cuotas > 1)
  ) {
    return 'DEUDA_PASIVO';
  }

  // 2. Fixed Structural / Existence Expenses (Subsistencia)
  if (
    esGastoFijo ||
    c.includes('servicios') ||
    c.includes('vivienda') ||
    s.includes('alquiler') ||
    s.includes('mantenimiento de edificio') ||
    s.includes('agua') ||
    s.includes('luz') ||
    s.includes('electricidad') ||
    s.includes('internet') ||
    s.includes('teléfono') ||
    s.includes('telefono') ||
    s.includes('gas') ||
    s.includes('educación') ||
    s.includes('educacion') ||
    s.includes('colegio') ||
    s.includes('universidad') ||
    s.includes('salud') ||
    s.includes('seguro') ||
    s.includes('gimnasio') ||
    k.includes('alquiler') ||
    k.includes('mantenimiento') ||
    k.includes('cochera')
  ) {
    return 'SUBSISTENCIA';
  }

  // 3. Discretionary / Lifestyle
  if (
    c.includes('ocio') ||
    c.includes('salidas') ||
    c.includes('hormiga') ||
    c.includes('antojos') ||
    s.includes('salida') ||
    s.includes('restaurante') ||
    s.includes('chatarra') ||
    s.includes('deliveries') ||
    s.includes('delivery') ||
    s.includes('viaje') ||
    s.includes('pasatiempo') ||
    s.includes('compras por internet') ||
    k.includes('antojo') ||
    k.includes('capricho') ||
    k.includes('cine') ||
    k.includes('ropa') ||
    k.includes('tecnología') ||
    k.includes('tecnologia')
  ) {
    return 'DISCRECIONAL';
  }

  // 4. Default Operational Variable (Supermarket, Fuel, Transportation, Pets, Personal Care)
  return 'OPERATIVO';
};

