/** Formateringshjälp med svenska decimaltecken. */

export function tal(v: number, decimaler = 2): string {
  if (!Number.isFinite(v)) return '–';
  return v.toLocaleString('sv-SE', {
    minimumFractionDigits: decimaler,
    maximumFractionDigits: decimaler,
  });
}

export function procent(v: number, decimaler = 0): string {
  return `${tal(v * 100, decimaler)} %`;
}

/**
 * Längd i millimeter med tusentalsavgränsare, angiven från ett värde i meter.
 * Byggritningar måttsätts i millimeter, så gränssnittet redovisar alla längder
 * så även om beräkningskärnan räknar i meter.
 */
export function mm(meter: number, decimaler = 0): string {
  if (!Number.isFinite(meter)) return '–';
  return (meter * 1000).toLocaleString('sv-SE', {
    minimumFractionDigits: decimaler,
    maximumFractionDigits: decimaler,
  });
}

/** Millimetervärde till meter, avrundat till hel millimeter. */
export function millimeterTillMeter(millimeter: number): number {
  return Math.round(millimeter) / 1000;
}

/** Meter till hel millimeter, för inmatningsfält. */
export function meterTillMillimeter(meter: number): number {
  return Math.round(meter * 1000);
}

export type Statusband = 'good' | 'warning' | 'serious' | 'critical';

/**
 * Utnyttjandegraden delas in i fyra band. Bandet är alltid parat med det
 * numeriska värdet i gränssnittet – färgen bär aldrig informationen ensam.
 */
export function statusband(utnyttjande: number): Statusband {
  if (utnyttjande > 1.0) return 'critical';
  if (utnyttjande > 0.9) return 'serious';
  if (utnyttjande > 0.75) return 'warning';
  return 'good';
}

export const STATUSFARG: Record<Statusband, string> = {
  good: 'var(--status-good)',
  warning: 'var(--status-warning)',
  serious: 'var(--status-serious)',
  critical: 'var(--status-critical)',
};

export const STATUSTEXT: Record<Statusband, string> = {
  good: 'God marginal',
  warning: 'Nära gränsen',
  serious: 'Kritiskt utnyttjad',
  critical: 'Överskrids',
};

export const STATUSIKON: Record<Statusband, string> = {
  good: '✓',
  warning: '!',
  serious: '!!',
  critical: '✕',
};
