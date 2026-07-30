/**
 * Bärförmågekontroller enligt SS-EN 1995-1-1 (Eurokod 5).
 *
 * Alla kontroller returnerar en utnyttjandegrad där värden ≤ 1,0 innebär
 * att kravet är uppfyllt. Spänningar i MPa, krafter i kN, moment i kNm.
 */

import {
  KCR,
  area,
  betaC,
  bojmotstandY,
  gammaM,
  kh,
  kmod,
  troghetsmomentY,
  troghetsmomentZ,
  type Klimatklass,
  type Lastvaraktighet,
  type TimberGrade,
  type Virkesdimension,
} from './materials';

export interface Dimensioneringsvarden {
  fmd: number;
  ft0d: number;
  fc0d: number;
  fc90d: number;
  fvd: number;
  kmod: number;
  kh: number;
  gammaM: number;
}

export function dimensioneringsvarden(
  grade: TimberGrade,
  dim: Virkesdimension,
  klimatklass: Klimatklass,
  varaktighet: Lastvaraktighet,
): Dimensioneringsvarden {
  const km = kmod(klimatklass, varaktighet);
  const gM = gammaM(grade.family);
  const kHojd = kh(dim, grade);
  return {
    fmd: (km * kHojd * grade.fmk) / gM,
    ft0d: (km * kHojd * grade.ft0k) / gM,
    fc0d: (km * grade.fc0k) / gM,
    fc90d: (km * grade.fc90k) / gM,
    fvd: (km * grade.fvk) / gM,
    kmod: km,
    kh: kHojd,
    gammaM: gM,
  };
}

export interface Knackningsdata {
  /** Slankhetstal i planet */
  lambdaY: number;
  /** Slankhetstal ut ur planet */
  lambdaZ: number;
  lambdaRelY: number;
  lambdaRelZ: number;
  kcY: number;
  kcZ: number;
}

/**
 * Knäckningsfaktorer kc enligt SS-EN 1995-1-1 avsnitt 6.3.2.
 * @param lcY knäcklängd i takstolens plan, m
 * @param lcZ knäcklängd ut ur takstolens plan, m
 */
export function knackning(
  grade: TimberGrade,
  dim: Virkesdimension,
  lcY: number,
  lcZ: number,
): Knackningsdata {
  const A = area(dim);
  const iY = Math.sqrt(troghetsmomentY(dim) / A);
  const iZ = Math.sqrt(troghetsmomentZ(dim) / A);
  const lambdaY = (lcY * 1000) / iY;
  const lambdaZ = (lcZ * 1000) / iZ;
  const faktor = Math.sqrt(grade.fc0k / grade.E005) / Math.PI;
  const lambdaRelY = lambdaY * faktor;
  const lambdaRelZ = lambdaZ * faktor;
  const bc = betaC(grade.family);

  const kc = (lambdaRel: number) => {
    if (lambdaRel <= 0.3) return 1.0;
    const k = 0.5 * (1 + bc * (lambdaRel - 0.3) + lambdaRel ** 2);
    return 1 / (k + Math.sqrt(Math.max(k ** 2 - lambdaRel ** 2, 0)));
  };

  return {
    lambdaY,
    lambdaZ,
    lambdaRelY,
    lambdaRelZ,
    kcY: kc(lambdaRelY),
    kcZ: kc(lambdaRelZ),
  };
}

/**
 * kcrit för vippning enligt SS-EN 1995-1-1 avsnitt 6.3.3.
 * @param lef effektiv längd (avstånd mellan sidostagningar), m
 */
export function vippning(grade: TimberGrade, dim: Virkesdimension, lef: number): {
  sigmaMCrit: number;
  lambdaRelM: number;
  kcrit: number;
} {
  const lefMm = Math.max(lef, 0.01) * 1000;
  // Kritisk böjspänning för rektangulärt barrträtvärsnitt, ekv. 6.32
  const sigmaMCrit = (0.78 * dim.b ** 2 * grade.E005) / (dim.h * lefMm);
  const lambdaRelM = Math.sqrt(grade.fmk / sigmaMCrit);
  let kcrit: number;
  if (lambdaRelM <= 0.75) kcrit = 1.0;
  else if (lambdaRelM <= 1.4) kcrit = 1.56 - 0.75 * lambdaRelM;
  else kcrit = 1 / lambdaRelM ** 2;
  return { sigmaMCrit, lambdaRelM, kcrit };
}

export type Kontrolltyp =
  | 'drag_bojning'
  | 'tryck_bojning'
  | 'knackning'
  | 'vippning'
  | 'skjuvning'
  | 'tryck_vinkelrat';

export const KONTROLL_NAMN: Record<Kontrolltyp, string> = {
  drag_bojning: 'Drag och böjning (6.17)',
  tryck_bojning: 'Tryck och böjning (6.19)',
  knackning: 'Knäckning med böjning (6.23/6.24)',
  vippning: 'Vippning (6.35)',
  skjuvning: 'Skjuvning (6.13)',
  tryck_vinkelrat: 'Tryck vinkelrätt fibrerna (6.3)',
};

export interface Kontrollresultat {
  typ: Kontrolltyp;
  utnyttjande: number;
  /** Textuell redovisning av kontrollen */
  formel: string;
}

export interface SnittKontrollIndata {
  /** Normalkraft, kN (drag positiv) */
  N: number;
  /** Böjmoment, kNm */
  M: number;
  /** Tvärkraft, kN */
  V: number;
  grade: TimberGrade;
  dim: Virkesdimension;
  dv: Dimensioneringsvarden;
  knack: Knackningsdata;
  kcrit: number;
}

/** km för rektangulära tvärsnitt, SS-EN 1995-1-1 avsnitt 6.1.6. */
const KM = 0.7;

/** Kontrollerar ett snitt och returnerar alla relevanta kontroller. */
export function kontrolleraSnitt(i: SnittKontrollIndata): Kontrollresultat[] {
  const A = area(i.dim); // mm²
  const W = bojmotstandY(i.dim); // mm³
  const sigmaN = (Math.abs(i.N) * 1000) / A; // MPa
  const sigmaM = (Math.abs(i.M) * 1e6) / W; // MPa
  const tau = (1.5 * Math.abs(i.V) * 1000) / (KCR * i.dim.b * i.dim.h); // MPa

  const resultat: Kontrollresultat[] = [];

  if (i.N >= 0) {
    // Drag och böjning, ekv. 6.17
    const u = sigmaN / i.dv.ft0d + sigmaM / i.dv.fmd;
    resultat.push({
      typ: 'drag_bojning',
      utnyttjande: u,
      formel: `σt,0,d/ft,0,d + σm,d/fm,d = ${sigmaN.toFixed(2)}/${i.dv.ft0d.toFixed(2)} + ${sigmaM.toFixed(2)}/${i.dv.fmd.toFixed(2)}`,
    });
  } else {
    // Tryck och böjning utan knäckning, ekv. 6.19
    const u1 = (sigmaN / i.dv.fc0d) ** 2 + sigmaM / i.dv.fmd;
    resultat.push({
      typ: 'tryck_bojning',
      utnyttjande: u1,
      formel: `(σc,0,d/fc,0,d)² + σm,d/fm,d = (${sigmaN.toFixed(2)}/${i.dv.fc0d.toFixed(2)})² + ${sigmaM.toFixed(2)}/${i.dv.fmd.toFixed(2)}`,
    });

    // Knäckning med böjning, ekv. 6.23 och 6.24
    if (i.knack.lambdaRelY > 0.3 || i.knack.lambdaRelZ > 0.3) {
      const u23 = sigmaN / (i.knack.kcY * i.dv.fc0d) + sigmaM / i.dv.fmd;
      const u24 = sigmaN / (i.knack.kcZ * i.dv.fc0d) + (KM * sigmaM) / i.dv.fmd;
      const u = Math.max(u23, u24);
      resultat.push({
        typ: 'knackning',
        utnyttjande: u,
        formel: `σc,0,d/(kc·fc,0,d) + σm,d/fm,d, kc,y = ${i.knack.kcY.toFixed(3)} (λrel,y = ${i.knack.lambdaRelY.toFixed(2)}), kc,z = ${i.knack.kcZ.toFixed(3)} (λrel,z = ${i.knack.lambdaRelZ.toFixed(2)})`,
      });
    }
  }

  // Vippning, ekv. 6.33/6.35 (kombinerad med tryck)
  if (i.kcrit < 1.0 && sigmaM > 0) {
    const u =
      i.N < 0
        ? (sigmaM / (i.kcrit * i.dv.fmd)) ** 2 + sigmaN / (i.knack.kcZ * i.dv.fc0d)
        : sigmaM / (i.kcrit * i.dv.fmd);
    resultat.push({
      typ: 'vippning',
      utnyttjande: u,
      formel: `σm,d/(kcrit·fm,d) med kcrit = ${i.kcrit.toFixed(3)}`,
    });
  }

  // Skjuvning, ekv. 6.13 med sprickfaktor kcr
  resultat.push({
    typ: 'skjuvning',
    utnyttjande: tau / i.dv.fvd,
    formel: `τd/fv,d = ${tau.toFixed(2)}/${i.dv.fvd.toFixed(2)} (kcr = ${KCR})`,
  });

  return resultat;
}

/**
 * kc,90 enligt SS-EN 1995-1-1 avsnitt 6.1.5(2).
 * Takstolens upplag är ett ändupplag på diskret stöd (syll/hammarband).
 */
export function kc90(grade: TimberGrade, diskretStod = true): number {
  if (grade.family === 'limtra') return diskretStod ? 1.75 : 1.5;
  return diskretStod ? 1.5 : 1.25;
}

/**
 * Kontroll av tryck vinkelrätt fibrerna vid upplag, ekv. 6.3.
 * Den effektiva upplagslängden får ökas med 30 mm på den sida där virket
 * fortsätter förbi upplaget (SS-EN 1995-1-1 avsnitt 6.1.5(1)).
 *
 * @param R upplagsreaktion, kN
 * @param upplagslangd upplagets längd längs stången, mm
 */
export function kontrolleraUpplagstryck(
  R: number,
  dim: Virkesdimension,
  upplagslangd: number,
  dv: Dimensioneringsvarden,
  kc90Varde = 1.5,
): Kontrollresultat & { erforderligLangd: number } {
  const lef = upplagslangd + 30; // ändupplag: förlängning endast inåt
  const Aef = dim.b * lef;
  const sigma = (Math.abs(R) * 1000) / Aef;
  const kapacitet = kc90Varde * dv.fc90d;
  const erforderligLangd = Math.max(
    0,
    (Math.abs(R) * 1000) / (kapacitet * dim.b) - 30,
  );
  return {
    typ: 'tryck_vinkelrat',
    utnyttjande: sigma / kapacitet,
    formel: `σc,90,d/(kc,90·fc,90,d) = ${sigma.toFixed(2)}/(${kc90Varde} · ${dv.fc90d.toFixed(2)}) med Aef = ${dim.b} × ${lef.toFixed(0)} mm`,
    erforderligLangd,
  };
}

/**
 * Slutlig nedböjning enligt SS-EN 1995-1-1 avsnitt 2.2.3.
 * ufin = uG(1 + kdef) + uQ1(1 + ψ2,1·kdef) + Σ uQi(ψ0,i + ψ2,i·kdef)
 */
export function slutligNedbojning(
  uG: number,
  uQ1: number,
  psi21: number,
  ovriga: { u: number; psi0: number; psi2: number }[],
  kdefVarde: number,
): number {
  let u = uG * (1 + kdefVarde) + uQ1 * (1 + psi21 * kdefVarde);
  for (const o of ovriga) u += o.u * (o.psi0 + o.psi2 * kdefVarde);
  return u;
}
