/**
 * Förenklad vindlast enligt SS-EN 1991-1-4 med svenska nationella val.
 *
 * Beräkningen ger karakteristiskt hastighetstryck qp(z) och nettovindlast på
 * takfallen. Formfaktorerna avser takets inre zoner (zon H respektive I) och
 * är avsedda för dimensionering av takstolen som helhet. Randzoner (F, G, J)
 * ger högre sug och måste kontrolleras separat för infästning av taktäckning,
 * läkt och takstolarnas förankring.
 */

export type Terrangtyp = 0 | 1 | 2 | 3 | 4;

export const TERRANG_TEXT: Record<Terrangtyp, string> = {
  0: 'Terrängtyp 0 – hav, kustnära område exponerat mot öppet hav',
  1: 'Terrängtyp I – sjö eller plant område utan vegetation och hinder',
  2: 'Terrängtyp II – öppet landskap med enstaka hinder (standardval)',
  3: 'Terrängtyp III – förort, industriområde, sammanhängande skog',
  4: 'Terrängtyp IV – stadsområde där minst 15 % är bebyggt högre än 15 m',
};

const Z0: Record<Terrangtyp, number> = { 0: 0.003, 1: 0.01, 2: 0.05, 3: 0.3, 4: 1.0 };
const ZMIN: Record<Terrangtyp, number> = { 0: 1, 1: 1, 2: 2, 3: 5, 4: 10 };
const Z0_II = 0.05;
const RHO_LUFT = 1.25; // kg/m³

/** Referensvindhastigheter vb enligt vindlastkartan, m/s. */
export const REFERENSVINDHASTIGHETER = [21, 22, 23, 24, 25, 26];

export interface Vindresultat {
  /** Karakteristiskt hastighetstryck, kN/m² */
  qp: number;
  /** Medelvindhastighet, m/s */
  vm: number;
  /** Turbulensintensitet */
  Iv: number;
  /** Nettoformfaktor för sug (uppåt) på lovartsidan */
  cpNettoSug: number;
  /** Nettoformfaktor för tryck (nedåt) på lovartsidan */
  cpNettoTryck: number;
  /** Sugande vindlast vinkelrätt takytan, kN/m² (positivt = uppåt från taket) */
  wSug: number;
  /** Tryckande vindlast vinkelrätt takytan, kN/m² */
  wTryck: number;
}

/** Hastighetstryck qp(z) i kN/m² enligt SS-EN 1991-1-4 avsnitt 4.5. */
export function hastighetstryck(vb: number, terrang: Terrangtyp, z: number): {
  qp: number;
  vm: number;
  Iv: number;
} {
  const z0 = Z0[terrang];
  const zEff = Math.max(z, ZMIN[terrang]);
  const kr = 0.19 * (z0 / Z0_II) ** 0.07;
  const cr = kr * Math.log(zEff / z0);
  const co = 1.0;
  const vm = cr * co * vb;
  const Iv = 1.0 / (co * Math.log(zEff / z0));
  const qp = ((1 + 7 * Iv) * 0.5 * RHO_LUFT * vm ** 2) / 1000; // kN/m²
  return { qp, vm, Iv };
}

/**
 * Yttre formfaktor cpe,10 för sadeltak, vindriktning vinkelrätt nocken,
 * enligt SS-EN 1991-1-4 tabell 7.4a. Värdena avser takets inre zon (H).
 * Returnerar både det negativa (sug) och positiva (tryck) alternativet.
 */
export function cpeSadeltak(alfaGrader: number): { min: number; max: number } {
  const punkter: [number, number, number][] = [
    // [taklutning, cpe negativ, cpe positiv]
    [5, -0.6, 0.0],
    [15, -0.3, 0.2],
    [30, -0.2, 0.4],
    [45, 0.0, 0.6],
    [60, 0.7, 0.7],
    [75, 0.8, 0.8],
  ];
  const a = Math.max(5, Math.min(75, alfaGrader));
  for (let i = 0; i < punkter.length - 1; i++) {
    const [a1, min1, max1] = punkter[i];
    const [a2, min2, max2] = punkter[i + 1];
    if (a >= a1 && a <= a2) {
      const t = (a - a1) / (a2 - a1);
      return { min: min1 + t * (min2 - min1), max: max1 + t * (max2 - max1) };
    }
  }
  return { min: punkter[punkter.length - 1][1], max: punkter[punkter.length - 1][2] };
}

/** Inre formfaktor cpi. Vid okänd öppningsfördelning används ±0,2/−0,3. */
export const CPI_SUG = 0.2;
export const CPI_TRYCK = -0.3;

export interface VindIndata {
  vb: number;
  terrang: Terrangtyp;
  /** Byggnadens referenshöjd (nockhöjd över mark), m */
  byggnadshojd: number;
  taklutning: number;
}

export function berakVindlast(indata: VindIndata): Vindresultat {
  const { qp, vm, Iv } = hastighetstryck(indata.vb, indata.terrang, indata.byggnadshojd);
  const cpe = cpeSadeltak(indata.taklutning);
  const cpNettoSug = cpe.min - CPI_SUG; // mest negativ = störst sug
  const cpNettoTryck = cpe.max - CPI_TRYCK; // mest positiv = störst tryck
  return {
    qp,
    vm,
    Iv,
    cpNettoSug,
    cpNettoTryck,
    wSug: -cpNettoSug * qp, // positivt tal = last uppåt från takytan
    wTryck: cpNettoTryck * qp,
  };
}
