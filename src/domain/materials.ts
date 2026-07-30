/**
 * Materialdata för konstruktionsvirke och limträ.
 *
 * Karakteristiska hållfasthets- och styvhetsvärden enligt
 *   SS-EN 338:2016 (konstruktionsvirke, C-klasser)
 *   SS-EN 14080:2013 (limträ, GL-klasser)
 * Partialkoefficienter och kmod/kdef enligt SS-EN 1995-1-1 (Eurokod 5)
 * med svenska nationella val enligt Boverkets konstruktionsregler.
 *
 * Enheter: hållfasthet i MPa (N/mm²), styvhet i MPa, densitet i kg/m³.
 */

export type MaterialFamily = 'konstruktionsvirke' | 'limtra';

export interface TimberGrade {
  id: string;
  namn: string;
  family: MaterialFamily;
  /** Böjhållfasthet, karakteristisk */
  fmk: number;
  /** Draghållfasthet parallellt fibrerna */
  ft0k: number;
  /** Draghållfasthet vinkelrätt fibrerna */
  ft90k: number;
  /** Tryckhållfasthet parallellt fibrerna */
  fc0k: number;
  /** Tryckhållfasthet vinkelrätt fibrerna */
  fc90k: number;
  /** Skjuvhållfasthet */
  fvk: number;
  /** Medelelasticitetsmodul parallellt fibrerna */
  E0mean: number;
  /** 5-percentil av elasticitetsmodulen, används vid knäckning */
  E005: number;
  /** Medelskjuvmodul */
  Gmean: number;
  /** Karakteristisk densitet */
  rhok: number;
  /** Medeldensitet, används för egentyngd */
  rhomean: number;
  /** Tillgänglighet/kommentar för svensk marknad */
  kommentar?: string;
}

/**
 * SS-EN 338:2016 tabell 1 (barrträ, C-klasser). I Sverige sorteras
 * merparten av konstruktionsvirket till C14, C18, C24 och C30.
 */
export const KONSTRUKTIONSVIRKE: TimberGrade[] = [
  {
    id: 'C14',
    namn: 'C14',
    family: 'konstruktionsvirke',
    fmk: 14,
    ft0k: 7.2,
    ft90k: 0.4,
    fc0k: 16,
    fc90k: 2.0,
    fvk: 3.0,
    E0mean: 7000,
    E005: 4700,
    Gmean: 440,
    rhok: 290,
    rhomean: 350,
    kommentar: 'Lägsta vanliga klassen, ofta i reglar och kortare spännvidder.',
  },
  {
    id: 'C16',
    namn: 'C16',
    family: 'konstruktionsvirke',
    fmk: 16,
    ft0k: 8.5,
    ft90k: 0.4,
    fc0k: 17,
    fc90k: 2.2,
    fvk: 3.2,
    E0mean: 8000,
    E005: 5400,
    Gmean: 500,
    rhok: 310,
    rhomean: 370,
  },
  {
    id: 'C18',
    namn: 'C18',
    family: 'konstruktionsvirke',
    fmk: 18,
    ft0k: 10,
    ft90k: 0.4,
    fc0k: 18,
    fc90k: 2.2,
    fvk: 3.4,
    E0mean: 9000,
    E005: 6000,
    Gmean: 560,
    rhok: 320,
    rhomean: 380,
    kommentar: 'Vanlig i takstolar tillsammans med C24.',
  },
  {
    id: 'C20',
    namn: 'C20',
    family: 'konstruktionsvirke',
    fmk: 20,
    ft0k: 11.5,
    ft90k: 0.4,
    fc0k: 19,
    fc90k: 2.3,
    fvk: 3.6,
    E0mean: 9500,
    E005: 6400,
    Gmean: 590,
    rhok: 330,
    rhomean: 390,
  },
  {
    id: 'C22',
    namn: 'C22',
    family: 'konstruktionsvirke',
    fmk: 22,
    ft0k: 13,
    ft90k: 0.4,
    fc0k: 20,
    fc90k: 2.4,
    fvk: 3.8,
    E0mean: 10000,
    E005: 6700,
    Gmean: 630,
    rhok: 340,
    rhomean: 410,
  },
  {
    id: 'C24',
    namn: 'C24',
    family: 'konstruktionsvirke',
    fmk: 24,
    ft0k: 14.5,
    ft90k: 0.4,
    fc0k: 21,
    fc90k: 2.5,
    fvk: 4.0,
    E0mean: 11000,
    E005: 7400,
    Gmean: 690,
    rhok: 350,
    rhomean: 420,
    kommentar: 'Standardval för takstolar i Sverige.',
  },
  {
    id: 'C27',
    namn: 'C27',
    family: 'konstruktionsvirke',
    fmk: 27,
    ft0k: 16.5,
    ft90k: 0.4,
    fc0k: 22,
    fc90k: 2.6,
    fvk: 4.0,
    E0mean: 11500,
    E005: 7700,
    Gmean: 720,
    rhok: 370,
    rhomean: 450,
  },
  {
    id: 'C30',
    namn: 'C30',
    family: 'konstruktionsvirke',
    fmk: 30,
    ft0k: 19,
    ft90k: 0.4,
    fc0k: 24,
    fc90k: 2.7,
    fvk: 4.0,
    E0mean: 12000,
    E005: 8000,
    Gmean: 750,
    rhok: 380,
    rhomean: 460,
    kommentar: 'Maskinsorterat virke, används vid stora spännvidder.',
  },
  {
    id: 'C35',
    namn: 'C35',
    family: 'konstruktionsvirke',
    fmk: 35,
    ft0k: 22.5,
    ft90k: 0.4,
    fc0k: 25,
    fc90k: 2.8,
    fvk: 4.0,
    E0mean: 13000,
    E005: 8700,
    Gmean: 810,
    rhok: 400,
    rhomean: 480,
    kommentar: 'Begränsad tillgång, kräver maskinsortering.',
  },
];

/** SS-EN 14080:2013, homogent (h) och kombinerat (c) limträ. */
export const LIMTRA: TimberGrade[] = [
  {
    id: 'GL28c',
    namn: 'GL28c',
    family: 'limtra',
    fmk: 28,
    ft0k: 16.5,
    ft90k: 0.5,
    fc0k: 24,
    fc90k: 2.5,
    fvk: 3.5,
    E0mean: 12500,
    E005: 10400,
    Gmean: 650,
    rhok: 390,
    rhomean: 420,
    kommentar: 'Vanligast på svensk marknad (kombinerat limträ).',
  },
  {
    id: 'GL30c',
    namn: 'GL30c',
    family: 'limtra',
    fmk: 30,
    ft0k: 19.5,
    ft90k: 0.5,
    fc0k: 24.5,
    fc90k: 2.5,
    fvk: 3.5,
    E0mean: 13000,
    E005: 10800,
    Gmean: 650,
    rhok: 390,
    rhomean: 430,
  },
  {
    id: 'GL28h',
    namn: 'GL28h',
    family: 'limtra',
    fmk: 28,
    ft0k: 22.3,
    ft90k: 0.5,
    fc0k: 28,
    fc90k: 2.5,
    fvk: 3.5,
    E0mean: 12600,
    E005: 10500,
    Gmean: 650,
    rhok: 425,
    rhomean: 460,
  },
  {
    id: 'GL30h',
    namn: 'GL30h',
    family: 'limtra',
    fmk: 30,
    ft0k: 24,
    ft90k: 0.5,
    fc0k: 30,
    fc90k: 2.5,
    fvk: 3.5,
    E0mean: 13600,
    E005: 11300,
    Gmean: 650,
    rhok: 480,
    rhomean: 500,
  },
];

export const ALLA_KVALITETER: TimberGrade[] = [...KONSTRUKTIONSVIRKE, ...LIMTRA];

export function hittaKvalitet(id: string): TimberGrade {
  const g = ALLA_KVALITETER.find((x) => x.id === id);
  if (!g) throw new Error(`Okänd virkeskvalitet: ${id}`);
  return g;
}

/**
 * Klimatklass (service class) enligt SS-EN 1995-1-1 avsnitt 2.3.1.3.
 * Takstolar i ventilerat kallvindsutrymme hänförs normalt till klimatklass 2.
 */
export type Klimatklass = 1 | 2 | 3;

/** Lastvaraktighetsklass enligt SS-EN 1995-1-1 tabell 2.1. */
export type Lastvaraktighet =
  | 'permanent'
  | 'lang'
  | 'medellang'
  | 'kort'
  | 'momentan';

export const LASTVARAKTIGHET_NAMN: Record<Lastvaraktighet, string> = {
  permanent: 'Permanent (> 10 år)',
  lang: 'Lång (6 mån – 10 år)',
  medellang: 'Medellång (1 vecka – 6 mån)',
  kort: 'Kort (< 1 vecka)',
  momentan: 'Momentan',
};

/** kmod enligt SS-EN 1995-1-1 tabell 3.1 (massivt trä och limträ har samma värden). */
const KMOD: Record<Klimatklass, Record<Lastvaraktighet, number>> = {
  1: { permanent: 0.6, lang: 0.7, medellang: 0.8, kort: 0.9, momentan: 1.1 },
  2: { permanent: 0.6, lang: 0.7, medellang: 0.8, kort: 0.9, momentan: 1.1 },
  3: { permanent: 0.5, lang: 0.55, medellang: 0.65, kort: 0.7, momentan: 0.9 },
};

export function kmod(klimatklass: Klimatklass, varaktighet: Lastvaraktighet): number {
  return KMOD[klimatklass][varaktighet];
}

/** kdef enligt SS-EN 1995-1-1 tabell 3.2. */
const KDEF: Record<MaterialFamily, Record<Klimatklass, number>> = {
  konstruktionsvirke: { 1: 0.6, 2: 0.8, 3: 2.0 },
  limtra: { 1: 0.6, 2: 0.8, 3: 2.0 },
};

export function kdef(family: MaterialFamily, klimatklass: Klimatklass): number {
  return KDEF[family][klimatklass];
}

/** Partialkoefficient för materialet, SS-EN 1995-1-1 tabell 2.3 med svenska val. */
export function gammaM(family: MaterialFamily): number {
  return family === 'limtra' ? 1.25 : 1.3;
}

/**
 * Sprickfaktor kcr vid skjuvning. SS-EN 1995-1-1 avsnitt 6.1.7 med det
 * svenska nationella valet kcr = 0,67 för trä i klimatklass 1–3.
 */
export const KCR = 0.67;

/** Knäckningsparameter βc, SS-EN 1995-1-1 ekv. 6.29. */
export function betaC(family: MaterialFamily): number {
  return family === 'limtra' ? 0.1 : 0.2;
}

export interface Virkesdimension {
  /** Bredd (tjocklek) i mm */
  b: number;
  /** Höjd i mm */
  h: number;
}

/** Standarddimensioner för svenskt konstruktionsvirke (mm). */
export const STANDARDDIMENSIONER: Virkesdimension[] = [
  { b: 34, h: 70 },
  { b: 34, h: 95 },
  { b: 34, h: 120 },
  { b: 34, h: 145 },
  { b: 45, h: 70 },
  { b: 45, h: 95 },
  { b: 45, h: 120 },
  { b: 45, h: 145 },
  { b: 45, h: 170 },
  { b: 45, h: 195 },
  { b: 45, h: 220 },
  { b: 45, h: 245 },
  { b: 58, h: 145 },
  { b: 58, h: 170 },
  { b: 58, h: 195 },
  { b: 58, h: 220 },
  { b: 70, h: 170 },
  { b: 70, h: 195 },
  { b: 70, h: 220 },
  { b: 70, h: 245 },
];

/** Standarddimensioner för limträ (mm). */
export const LIMTRADIMENSIONER: Virkesdimension[] = [
  { b: 42, h: 180 },
  { b: 42, h: 225 },
  { b: 42, h: 270 },
  { b: 56, h: 225 },
  { b: 56, h: 270 },
  { b: 56, h: 315 },
  { b: 66, h: 270 },
  { b: 66, h: 315 },
  { b: 66, h: 360 },
  { b: 90, h: 270 },
  { b: 90, h: 315 },
  { b: 90, h: 360 },
  { b: 90, h: 405 },
  { b: 115, h: 360 },
  { b: 115, h: 405 },
  { b: 115, h: 450 },
];

export function dimensionerFor(family: MaterialFamily): Virkesdimension[] {
  return family === 'limtra' ? LIMTRADIMENSIONER : STANDARDDIMENSIONER;
}

export function dimensionNamn(d: Virkesdimension): string {
  return `${d.b}×${d.h}`;
}

/** Tvärsnittsarea i mm². */
export function area(d: Virkesdimension): number {
  return d.b * d.h;
}

/** Yttröghetsmoment kring styv axel (böjning i takstolens plan), mm⁴. */
export function troghetsmomentY(d: Virkesdimension): number {
  return (d.b * d.h ** 3) / 12;
}

/** Yttröghetsmoment kring vek axel (knäckning ut ur planet), mm⁴. */
export function troghetsmomentZ(d: Virkesdimension): number {
  return (d.h * d.b ** 3) / 12;
}

/** Böjmotstånd kring styv axel, mm³. */
export function bojmotstandY(d: Virkesdimension): number {
  return (d.b * d.h ** 2) / 6;
}

/** Egentyngd av virket i kN/m. */
export function egentyngdPerMeter(d: Virkesdimension, g: TimberGrade): number {
  const areaM2 = (d.b / 1000) * (d.h / 1000);
  return areaM2 * g.rhomean * 9.81e-3; // kN/m
}

/**
 * kh – höjdfaktor för böj- och draghållfasthet, SS-EN 1995-1-1 ekv. 3.1 och 3.2.
 * Gäller konstruktionsvirke med h < 150 mm respektive limträ med h < 600 mm.
 */
export function kh(d: Virkesdimension, g: TimberGrade): number {
  if (g.family === 'limtra') {
    if (d.h >= 600) return 1.0;
    return Math.min((600 / d.h) ** 0.1, 1.1);
  }
  if (d.h >= 150) return 1.0;
  return Math.min((150 / d.h) ** 0.2, 1.3);
}
