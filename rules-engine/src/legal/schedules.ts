export type QuantityUnit = 'g' | 'kg' | 'mL' | 'L' | 'number' | 'm' | 'm2';

export interface MpeBand {
  minExclusive: number;
  maxInclusive?: number;
  percent?: number;
  absolute?: number;
}

/**
 * First Schedule, Table I: maximum permissible error for weight/volume.
 * Boundaries follow the published table. Percentage tolerances are rounded
 * as prescribed by the Schedule.
 */
export const FIRST_SCHEDULE_WEIGHT_VOLUME: readonly MpeBand[] = [
  { minExclusive: -Infinity, maxInclusive: 50, percent: 9 },
  { minExclusive: 50, maxInclusive: 100, absolute: 4.5 },
  { minExclusive: 100, maxInclusive: 200, percent: 4.5 },
  { minExclusive: 200, maxInclusive: 300, absolute: 9 },
  { minExclusive: 300, maxInclusive: 500, percent: 3 },
  { minExclusive: 500, maxInclusive: 1000, absolute: 15 },
  { minExclusive: 1000, maxInclusive: 10000, percent: 1.5 },
  { minExclusive: 10000, maxInclusive: 15000, absolute: 150 },
  { minExclusive: 15000, percent: 1 }
];

export interface GenericMpeResult {
  applicable: boolean;
  tolerance?: number;
  deficiency?: number;
  withinTolerance?: boolean;
  reason?: string;
}

function roundTolerance(tolerance: number, declaredBase: number): number {
  if (declaredBase <= 1000) return Math.round(tolerance * 10) / 10;
  return Math.ceil(tolerance);
}

export function firstScheduleMpe(declaredQuantity: number, actualQuantity: number, unit: 'g' | 'mL'): GenericMpeResult {
  if (!Number.isFinite(declaredQuantity) || !Number.isFinite(actualQuantity) || declaredQuantity <= 0) {
    return { applicable: false, reason: 'Declared and actual quantities must be finite positive numbers.' };
  }

  const band = FIRST_SCHEDULE_WEIGHT_VOLUME.find(b => declaredQuantity > b.minExclusive && (b.maxInclusive === undefined || declaredQuantity <= b.maxInclusive));
  if (!band) return { applicable: false, reason: `No First Schedule band found for ${declaredQuantity} ${unit}.` };

  const rawTolerance = band.absolute ?? declaredQuantity * (band.percent! / 100);
  const tolerance = roundTolerance(rawTolerance, declaredQuantity);
  const deficiency = declaredQuantity - actualQuantity;
  return {
    applicable: true,
    tolerance,
    deficiency,
    withinTolerance: deficiency <= tolerance
  };
}

export type StandardQuantityRule = {
  commodity: string;
  description: string;
  matches: (quantity: number, unit: QuantityUnit) => boolean;
};

const kg = (g: number) => g / 1000;
const litre = (ml: number) => ml / 1000;
const nearInt = (x: number) => Math.abs(x - Math.round(x)) < 1e-9;

/**
 * Second Schedule entries represented as deterministic predicates. The data
 * is intentionally limited to the published commodity entries below; any
 * commodity not represented here is NOT treated as unrestricted by inference.
 */
export const SECOND_SCHEDULE: readonly StandardQuantityRule[] = [
  { commodity: 'baby food', description: '100g, 200g, 300g, 400g, 500g, 600g, 700g, 800g, 900g, 1kg, 2kg, 5kg, 10kg', matches: (q,u) => u==='g' ? [100,200,300,400,500,600,700,800,900].includes(q) : u==='kg' && [1,2,5,10].includes(q) },
  { commodity: 'weaning food', description: '100g, 200g, 300g, 400g, 500g, 600g, 700g, 800g, 900g, 1kg, 2kg, 5kg, 10kg', matches: (q,u) => u==='g' ? [100,200,300,400,500,600,700,800,900].includes(q) : u==='kg' && [1,2,5,10].includes(q) },
  { commodity: 'biscuits', description: '25g, 50g, 75g, 100g, 150g, 200g, 250g, 300g and thereafter multiples of 100g up to 1kg', matches: (q,u) => u==='g' && ( [25,50,75,100,150,200,250,300].includes(q) || (q>=400 && q<=1000 && nearInt(q/100)) ) },
  { commodity: 'bread', description: '100g and thereafter multiples of 100g', matches: (q,u) => u==='g' && q>=100 && nearInt(q/100) },
  { commodity: 'brown bread', description: '100g and thereafter multiples of 100g', matches: (q,u) => u==='g' && q>=100 && nearInt(q/100) },
  { commodity: 'butter and margarine', description: '25g, 50g, 100g, 200g, 500g, 1kg, 2kg, 5kg and thereafter multiples of 5kg', matches: (q,u) => u==='g' ? [25,50,100,200,500].includes(q) : u==='kg' && ( [1,2,5].includes(q) || (q>=10 && nearInt(q/5)) ) },
  { commodity: 'cereals and pulses', description: '100g, 200g, 500g, 1kg, 2kg, 5kg and thereafter multiples of 5kg', matches: (q,u) => u==='g' ? [100,200,500].includes(q) : u==='kg' && ([1,2,5].includes(q) || (q>=10 && nearInt(q/5))) },
  { commodity: 'coffee', description: '25g, 50g, 100g, 200g, 250g, 500g, 1kg and thereafter multiples of 1kg', matches: (q,u) => u==='g' ? [25,50,100,200,250,500].includes(q) : u==='kg' && (q===1 || (q>1 && nearInt(q))) },
  { commodity: 'tea', description: '25g, 50g, 100g, 125g, 250g, 500g, 1kg and thereafter multiples of 1kg', matches: (q,u) => u==='g' ? [25,50,100,125,250,500].includes(q) : u==='kg' && (q===1 || (q>1 && nearInt(q))) },
  { commodity: 'materials which may be constituted or reconstituted as beverages', description: '25g, 50g, 100g, 125g, 200g, 500g, 1kg and thereafter multiples of 1kg', matches: (q,u) => u==='g' ? [25,50,100,125,200,500].includes(q) : u==='kg' && (q===1 || (q>1 && nearInt(q))) },
  { commodity: 'edible oils', description: '50g, 100g, 200g, 500g, 1kg, 2kg, 3kg, 5kg and thereafter multiples of 5kg; volume declarations have corresponding ml/L treatment', matches: (q,u) => u==='g' ? [50,100,200,500].includes(q) : u==='kg' && ([1,2,3,5].includes(q) || (q>5 && nearInt(q/5))) },
  { commodity: 'vanaspati', description: '50g, 100g, 200g, 500g, 1kg, 2kg, 3kg, 5kg and thereafter multiples of 5kg', matches: (q,u) => u==='g' ? [50,100,200,500].includes(q) : u==='kg' && ([1,2,3,5].includes(q) || (q>5 && nearInt(q/5))) },
  { commodity: 'ghee', description: '50g, 100g, 200g, 500g, 1kg, 2kg, 3kg, 5kg and thereafter multiples of 5kg', matches: (q,u) => u==='g' ? [50,100,200,500].includes(q) : u==='kg' && ([1,2,3,5].includes(q) || (q>5 && nearInt(q/5))) },
  { commodity: 'milk powder', description: 'Below 50g unrestricted; 50g, 100g, 200g, 500g, 1kg and thereafter multiples of 500g', matches: (q,u) => u==='g' ? q<50 || [50,100,200,500].includes(q) || (q>500 && nearInt(q/500)) : u==='kg' && (q===1 || (q>1 && nearInt(q*2))) },
  { commodity: 'non-soapy detergents', description: 'Below 50g unrestricted; specified sizes through 2kg and thereafter multiples of 1kg', matches: (q,u) => u==='g' ? q<50 || [50,75,100,150,200,250,400,500,700,750,800,1000,1500,2000].includes(q) || (q>2000 && nearInt(q/1000)) : false },
  { commodity: 'rice', description: '100g, 200g, 500g, 1kg, 2kg, 5kg and thereafter multiples of 5kg', matches: (q,u) => u==='g' ? [100,200,500].includes(q) : u==='kg' && ([1,2,5].includes(q) || (q>5 && nearInt(q/5))) },
  { commodity: 'flour', description: '100g, 200g, 500g, 1kg, 2kg, 5kg and thereafter multiples of 5kg', matches: (q,u) => u==='g' ? [100,200,500].includes(q) : u==='kg' && ([1,2,5].includes(q) || (q>5 && nearInt(q/5))) },
  { commodity: 'atta', description: '100g, 200g, 500g, 1kg, 2kg, 5kg and thereafter multiples of 5kg', matches: (q,u) => u==='g' ? [100,200,500].includes(q) : u==='kg' && ([1,2,5].includes(q) || (q>5 && nearInt(q/5))) },
  { commodity: 'rawa', description: '100g, 200g, 500g, 1kg, 2kg, 5kg and thereafter multiples of 5kg', matches: (q,u) => u==='g' ? [100,200,500].includes(q) : u==='kg' && ([1,2,5].includes(q) || (q>5 && nearInt(q/5))) },
  { commodity: 'suji', description: '100g, 200g, 500g, 1kg, 2kg, 5kg and thereafter multiples of 5kg', matches: (q,u) => u==='g' ? [100,200,500].includes(q) : u==='kg' && ([1,2,5].includes(q) || (q>5 && nearInt(q/5))) },
  { commodity: 'salt', description: 'Below 50g in multiples of 10g; 50g, 100g, 200g, 500g, 750g, 1kg, 2kg, 5kg and thereafter multiples of 5kg', matches: (q,u) => u==='g' ? (q<50 ? nearInt(q/10) : [50,100,200,500,750].includes(q)) : u==='kg' && ([1,2,5].includes(q) || (q>5 && nearInt(q/5))) },
  { commodity: 'laundry soap', description: '50g, 75g, 100g and thereafter multiples of 50g', matches: (q,u) => u==='g' && q>=50 && ([50,75,100].includes(q) || nearInt(q/50)) },
  { commodity: 'non-soapy detergent cakes', description: '50g, 75g, 100g, 125g, 150g, 200g, 250g, 300g and thereafter multiples of 100g', matches: (q,u) => u==='g' && ([50,75,100,125,150,200,250,300].includes(q) || (q>300 && nearInt(q/100))) },
  { commodity: 'toilet soap', description: '25g, 50g, 75g, 100g, 125g, 150g and thereafter multiples of 50g', matches: (q,u) => u==='g' && ([25,50,75,100,125,150].includes(q) || (q>150 && nearInt(q/50))) },
  { commodity: 'aerated soft drinks', description: '65ml fruit drinks, 100ml, 125ml fruit drinks, 150ml, 200ml, 250ml, 300ml, 330ml cans, 500ml, 750ml, 1L, 1.5L, 2L, 3L, 4L, 5L', matches: (q,u) => u==='mL' ? [65,100,125,150,200,250,300,330,500,750].includes(q) : u==='L' && [1,1.5,2,3,4,5].includes(q) },
  { commodity: 'mineral water', description: '100ml, 150ml, 200ml, 250ml, 300ml, 500ml, 750ml, 1L, 1.5L, 2L, 3L, 4L, 5L', matches: (q,u) => u==='mL' ? [100,150,200,250,300,500,750].includes(q) : u==='L' && [1,1.5,2,3,4,5].includes(q) },
  { commodity: 'drinking water', description: '100ml, 150ml, 200ml, 250ml, 300ml, 500ml, 750ml, 1L, 1.5L, 2L, 3L, 4L, 5L', matches: (q,u) => u==='mL' ? [100,150,200,250,300,500,750].includes(q) : u==='L' && [1,1.5,2,3,4,5].includes(q) },
  { commodity: 'cement', description: '1kg, 2kg, 5kg, 10kg, 20kg, 25kg, 40kg white cement only, 50kg', matches: (q,u) => u==='kg' && [1,2,5,10,20,25,50].includes(q) },
  { commodity: 'paint', description: '50ml, 100ml, 200ml, 500ml, 1L, 2L, 3L, 4L, 5L and thereafter multiples of 5L', matches: (q,u) => u==='mL' ? [50,100,200,500].includes(q) : u==='L' && ([1,2,3,4,5].includes(q) || (q>5 && nearInt(q/5))) },
  { commodity: 'paste paint', description: '500g, 1kg, 1.5kg, 2kg, 3kg, 5kg, 7kg and thereafter multiples of 5kg', matches: (q,u) => u==='g' ? q===500 : u==='kg' && ([1,1.5,2,3,5,7].includes(q) || (q>7 && nearInt(q/5))) },
  { commodity: 'solid paint', description: '500g, 1kg, 1.5kg, 2kg, 3kg, 5kg, 7kg and thereafter multiples of 5kg', matches: (q,u) => u==='g' ? q===500 : u==='kg' && ([1,1.5,2,3,5,7].includes(q) || (q>7 && nearInt(q/5))) },
  { commodity: 'base paint', description: '450ml, 500ml, 900ml, 925ml, 950ml, 975ml, 1L, 3.6L, 3.7L, 3.8L, 3.9L, 4L; no restriction above 4L', matches: (q,u) => u==='mL' ? [450,500,900,925,950,975].includes(q) : u==='L' && [1,3.6,3.7,3.8,3.9,4].includes(q) }
];

export function findSecondScheduleRule(commodity: string): StandardQuantityRule | undefined {
  const normalized = commodity.trim().toLowerCase();
  return SECOND_SCHEDULE.find(rule => normalized.includes(rule.commodity) || rule.commodity.includes(normalized));
}

export function isSecondScheduleStandard(commodity: string, quantity: number, unit: QuantityUnit): { applicable: boolean; compliant?: boolean; description?: string } {
  const rule = findSecondScheduleRule(commodity);
  if (!rule) return { applicable: false };
  return { applicable: true, compliant: rule.matches(quantity, unit), description: rule.description };
}

export function normalizeQuantity(value: number, unit: string): { value: number; unit: QuantityUnit } | undefined {
  const u = unit.trim().toLowerCase();
  if (u === 'g' || u === 'gram' || u === 'grams') return { value, unit: 'g' };
  if (u === 'kg' || u === 'kilogram' || u === 'kilograms') return { value, unit: 'kg' };
  if (u === 'ml' || u === 'millilitre' || u === 'millilitres' || u === 'milliliter' || u === 'milliliters') return { value, unit: 'mL' };
  if (u === 'l' || u === 'litre' || u === 'litres' || u === 'liter' || u === 'liters') return { value, unit: 'L' };
  if (u === 'number' || u === 'no' || u === 'nos') return { value, unit: 'number' };
  if (u === 'm') return { value, unit: 'm' };
  if (u === 'm2' || u === 'm²' || u === 'sq m' || u === 'square metre') return { value, unit: 'm2' };
  return undefined;
}

export function toBaseQuantity(value: number, unit: QuantityUnit): { value: number; unit: 'g' | 'mL' | 'number' | 'm' | 'm2' } {
  switch (unit) {
    case 'kg': return { value: value * 1000, unit: 'g' };
    case 'L': return { value: value * 1000, unit: 'mL' };
    default: return { value, unit };
  }
}
