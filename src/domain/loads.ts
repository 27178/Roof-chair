/**
 * Laster och lastkombinationer.
 *
 * Snölast enligt SS-EN 1991-1-3 med svenska nationella val i Boverkets
 * konstruktionsregler (BFS 2024:6, som från 1 juli 2025 ersätter EKS,
 * BFS 2011:10 – med övergångsregler t.o.m. 30 juni 2026).
 * Lastkombinationer enligt SS-EN 1990 ekv. 6.10a och 6.10b med svenska
 * partialkoefficienter och säkerhetsklassfaktor γd.
 *
 * Enheter: laster i kN/m², längder i m.
 */

import type { Lastvaraktighet } from './materials';

/* ------------------------------------------------------------------ */
/* Snözoner                                                            */
/* ------------------------------------------------------------------ */

export interface Snozon {
  /** Karakteristisk snölast på mark, kN/m² */
  sk: number;
  etikett: string;
  /** Exempel på orter/områden i zonen (vägledande) */
  exempel: string;
}

/**
 * Snözoner (sk = karakteristisk snölast på mark, 50 års återkomsttid).
 * Zonindelningen är vägledande – bindande värde läses ur lastkartan i
 * Boverkets konstruktionsregler. Nära en zongräns bör högre värde väljas.
 */
export const SNOZONER: Snozon[] = [
  { sk: 1.0, etikett: '1,0', exempel: 'Södra Skåne, delar av västkusten' },
  { sk: 1.5, etikett: '1,5', exempel: 'Skåne, Halland, Blekinge, Gotland' },
  { sk: 2.0, etikett: '2,0', exempel: 'Götaland i övrigt, Mälardalen, Stockholm' },
  { sk: 2.5, etikett: '2,5', exempel: 'Delar av Svealand, Östergötland inland, Uppland' },
  { sk: 3.0, etikett: '3,0', exempel: 'Norra Svealand, kustnära Norrland, Dalarna' },
  { sk: 3.5, etikett: '3,5', exempel: 'Norrlands inland, Jämtland, Västerbotten' },
  { sk: 4.5, etikett: '4,5', exempel: 'Norra Norrlands inland, Lappland' },
  { sk: 5.5, etikett: '5,5', exempel: 'Fjällnära lägen i nordöstra Norrland' },
];

/**
 * Formfaktor μ1 för snölast enligt SS-EN 1991-1-3 tabell 5.2.
 * @param alfaGrader taklutning i grader
 */
export function formfaktorMu1(alfaGrader: number): number {
  const a = Math.abs(alfaGrader);
  if (a <= 30) return 0.8;
  if (a >= 60) return 0;
  return (0.8 * (60 - a)) / 30;
}

/** Exponeringsförhållande – styr Ce enligt SS-EN 1991-1-3 tabell 5.1. */
export type Exponering = 'vindutsatt' | 'normal' | 'skyddad';

export const EXPONERING_TEXT: Record<Exponering, string> = {
  vindutsatt:
    'Vindutsatt – öppet landskap utan skydd av terräng, träd eller högre byggnader',
  normal: 'Normal – viss avblåsning av snö förekommer (standardval)',
  skyddad: 'Skyddad – byggnaden ligger i lä av terräng, träd eller högre byggnader',
};

/**
 * Exponeringsfaktor Ce. I Sverige används normalt Ce = 1,0; värdet 0,8 får
 * bara användas när avblåsning är säkerställd under byggnadens hela livslängd.
 */
export function exponeringsfaktor(exp: Exponering): number {
  switch (exp) {
    case 'vindutsatt':
      return 0.8;
    case 'skyddad':
      return 1.2;
    default:
      return 1.0;
  }
}

/**
 * Termisk koefficient Ct. Ct = 1,0 för normalt isolerade tak; lägre värde
 * får bara användas vid hög värmegenomgång (t.ex. växthus).
 */
export const CT_NORMAL = 1.0;

export interface Snolastresultat {
  sk: number;
  mu1: number;
  Ce: number;
  Ct: number;
  /** Snölast på tak, symmetriskt fall, kN/m² horisontell projektion */
  s: number;
  /** Lastvaraktighetsklass för snölasten */
  varaktighet: Lastvaraktighet;
  /** Lastfall enligt SS-EN 1991-1-3 fig. 5.3: [vänster, höger] i kN/m² */
  lastfall: { namn: string; vanster: number; hoger: number }[];
}

/**
 * Lastvaraktighetsklass för snölast med svenska nationella val:
 * snölast förs till klass M (medellång) i huvuddelen av landet, men till
 * klass L (lång) i områden med hög snölast på mark (sk ≥ 3,0 kN/m²).
 */
export function snolastVaraktighet(sk: number): Lastvaraktighet {
  return sk >= 3.0 ? 'lang' : 'medellang';
}

/**
 * Snölast på sadeltak enligt SS-EN 1991-1-3 avsnitt 5.3.3.
 * Lastfall (i) symmetriskt, (ii) och (iii) osymmetriskt med halverad last
 * på ena takfallet (drivbildning/avblåsning).
 */
export function berakSnolast(
  sk: number,
  alfaVanster: number,
  alfaHoger: number,
  exp: Exponering,
  Ct: number = CT_NORMAL,
): Snolastresultat {
  const Ce = exponeringsfaktor(exp);
  const muV = formfaktorMu1(alfaVanster);
  const muH = formfaktorMu1(alfaHoger);
  const sV = muV * Ce * Ct * sk;
  const sH = muH * Ce * Ct * sk;

  return {
    sk,
    mu1: muV,
    Ce,
    Ct,
    s: sV,
    varaktighet: snolastVaraktighet(sk),
    lastfall: [
      { namn: 'Lastfall (i) – symmetrisk snölast', vanster: sV, hoger: sH },
      { namn: 'Lastfall (ii) – osymmetrisk, halv last vänster', vanster: 0.5 * sV, hoger: sH },
      { namn: 'Lastfall (iii) – osymmetrisk, halv last höger', vanster: sV, hoger: 0.5 * sH },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Egentyngder                                                         */
/* ------------------------------------------------------------------ */

export interface Taktackning {
  id: string;
  namn: string;
  /** Egentyngd i kN/m² taklutande yta */
  tyngd: number;
}

/** Egentyngder enligt SS-EN 1991-1-1 bilaga A och branschdata. */
export const TAKTACKNINGAR: Taktackning[] = [
  { id: 'betongpannor', namn: 'Betongtakpannor med läkt', tyngd: 0.55 },
  { id: 'tegelpannor', namn: 'Tegelpannor med läkt', tyngd: 0.6 },
  { id: 'plat_falsad', namn: 'Falsad plåt på råspont', tyngd: 0.25 },
  { id: 'plat_profilerad', namn: 'Profilerad plåt på läkt', tyngd: 0.1 },
  { id: 'papp_rasport', namn: 'Takpapp på råspont', tyngd: 0.2 },
  { id: 'shingel', namn: 'Shingel/takshingel på råspont', tyngd: 0.25 },
  { id: 'torvtak', namn: 'Torvtak (sedum/grästak)', tyngd: 1.0 },
  { id: 'egen', namn: 'Egen uppgift', tyngd: 0.4 },
];

export interface Innertak {
  id: string;
  namn: string;
  /** Egentyngd i kN/m² horisontell yta (undertak + isolering) */
  tyngd: number;
}

export const INNERTAK: Innertak[] = [
  { id: 'inget', namn: 'Inget innertak (kallvind utan bjälklag)', tyngd: 0.0 },
  { id: 'gips_isol', namn: 'Gipsundertak + 500 mm lösull', tyngd: 0.35 },
  { id: 'gips_isol_tung', namn: 'Dubbelt gips + 500 mm lösull', tyngd: 0.45 },
  { id: 'panel_isol', namn: 'Träpanel + 400 mm isolering', tyngd: 0.4 },
  { id: 'egen', namn: 'Egen uppgift', tyngd: 0.3 },
];

/** Nyttig last på vind enligt SS-EN 1991-1-1 tabell 6.2, kategori H och A. */
export interface Nyttiglast {
  id: string;
  namn: string;
  /** qk i kN/m² */
  qk: number;
  /** ψ0, ψ1, ψ2 */
  psi: [number, number, number];
}

export const NYTTIGLASTER: Nyttiglast[] = [
  {
    id: 'H',
    namn: 'Kategori H – ej tillgängligt tak, endast underhåll',
    qk: 0.4,
    psi: [0, 0, 0],
  },
  {
    id: 'vind_forrad',
    namn: 'Vindsutrymme, förvaring (kategori A/E1)',
    qk: 1.0,
    psi: [0.7, 0.5, 0.3],
  },
  {
    id: 'A',
    namn: 'Kategori A – inredd vind, bostadsutrymme',
    qk: 2.0,
    psi: [0.7, 0.5, 0.3],
  },
];

/* ------------------------------------------------------------------ */
/* Säkerhetsklass och lastkombinationer                                */
/* ------------------------------------------------------------------ */

export type Sakerhetsklass = 1 | 2 | 3;

export const SAKERHETSKLASS_TEXT: Record<Sakerhetsklass, string> = {
  1: 'Säkerhetsklass 1 – liten risk för personskada (γd = 0,83)',
  2: 'Säkerhetsklass 2 – någon risk för personskada (γd = 0,91)',
  3: 'Säkerhetsklass 3 – stor risk för personskada (γd = 1,0)',
};

/** Partialkoefficient γd för säkerhetsklass enligt Boverkets konstruktionsregler. */
export function gammaD(klass: Sakerhetsklass): number {
  return klass === 1 ? 0.83 : klass === 2 ? 0.91 : 1.0;
}

/**
 * Kombinationsfaktorer för snölast enligt svenska nationella val
 * (SS-EN 1990 bilaga A1 med Boverkets värden). Faktorerna beror på
 * snölasten på mark.
 */
export function snoPsi(sk: number): { psi0: number; psi1: number; psi2: number } {
  if (sk >= 3.0) return { psi0: 0.8, psi1: 0.6, psi2: 0.2 };
  if (sk >= 2.0) return { psi0: 0.7, psi1: 0.4, psi2: 0.2 };
  return { psi0: 0.6, psi1: 0.3, psi2: 0.1 };
}

/** ψ-faktorer för vindlast enligt svenska nationella val. */
export const VIND_PSI = { psi0: 0.3, psi1: 0.2, psi2: 0.0 };

export type Lasttyp = 'egentyngd' | 'sno' | 'nyttig' | 'vind';

export interface Lastkombination {
  id: string;
  namn: string;
  /** Partialkoefficient per lasttyp (inklusive γd och ψ0) */
  faktorer: Record<Lasttyp, number>;
  /** Vilket snölastfall (index i Snolastresultat.lastfall) som avses */
  snolastfall: number;
  /** Lastvaraktighetsklass som styr kmod (den kortvarigaste lasten i kombinationen) */
  varaktighet: Lastvaraktighet;
  huvudlast: Lasttyp;
}

export interface KombinationsIndata {
  sakerhetsklass: Sakerhetsklass;
  sk: number;
  nyttiglast: Nyttiglast;
  /** Antal snölastfall som ska kombineras (1 = bara symmetriskt) */
  antalSnolastfall: number;
  medVind: boolean;
}

/**
 * Genererar lastkombinationer i brottgränstillstånd enligt SS-EN 1990:
 *
 *   6.10a:  γd·1,35·Gk
 *   6.10b:  γd·1,2·Gk + γd·1,5·Qk,1 + γd·1,5·Σψ0,i·Qk,i
 *
 * Varje kombination genereras även för de osymmetriska snölastfallen.
 */
export function genereraKombinationer(indata: KombinationsIndata): Lastkombination[] {
  const gd = gammaD(indata.sakerhetsklass);
  const { psi0: psiSno } = snoPsi(indata.sk);
  const psiNyttig = indata.nyttiglast.psi[0];
  const snoVar = snolastVaraktighet(indata.sk);
  const kombinationer: Lastkombination[] = [];

  kombinationer.push({
    id: 'BG-6.10a',
    namn: '6.10a – egentyngd dominerar',
    faktorer: { egentyngd: gd * 1.35, sno: 0, nyttig: 0, vind: 0 },
    snolastfall: 0,
    varaktighet: 'permanent',
    huvudlast: 'egentyngd',
  });

  for (let i = 0; i < indata.antalSnolastfall; i++) {
    const suffix = i === 0 ? '' : ` (lastfall ${i === 1 ? 'ii' : 'iii'})`;
    kombinationer.push({
      id: `BG-6.10b-sno-${i}`,
      namn: `6.10b – snölast huvudlast${suffix}`,
      faktorer: {
        egentyngd: gd * 1.2,
        sno: gd * 1.5,
        nyttig: gd * 1.5 * psiNyttig,
        vind: indata.medVind ? gd * 1.5 * VIND_PSI.psi0 : 0,
      },
      snolastfall: i,
      varaktighet: snoVar,
      huvudlast: 'sno',
    });
  }

  if (indata.nyttiglast.qk > 0 && psiNyttig > 0) {
    kombinationer.push({
      id: 'BG-6.10b-nyttig',
      namn: '6.10b – nyttig last huvudlast',
      faktorer: {
        egentyngd: gd * 1.2,
        sno: gd * 1.5 * psiSno,
        nyttig: gd * 1.5,
        vind: indata.medVind ? gd * 1.5 * VIND_PSI.psi0 : 0,
      },
      snolastfall: 0,
      varaktighet: 'medellang',
      huvudlast: 'nyttig',
    });
  }

  if (indata.medVind) {
    kombinationer.push({
      id: 'BG-6.10b-vind',
      namn: '6.10b – vindlast huvudlast',
      faktorer: {
        egentyngd: gd * 1.2,
        sno: gd * 1.5 * psiSno,
        nyttig: gd * 1.5 * psiNyttig,
        vind: gd * 1.5,
      },
      snolastfall: 0,
      varaktighet: 'momentan',
      huvudlast: 'vind',
    });
  }

  return kombinationer;
}

/** Kombinationer i bruksgränstillstånd (nedböjning). */
export interface Brukskombination {
  id: string;
  namn: string;
  faktorer: Record<Lasttyp, number>;
  snolastfall: number;
  /** true = kvasipermanent kombination, används för slutlig nedböjning */
  kvasipermanent: boolean;
}

export function genereraBrukskombinationer(indata: KombinationsIndata): Brukskombination[] {
  const { psi0: psiSno0, psi2: psiSno2 } = snoPsi(indata.sk);
  const psiNyttig0 = indata.nyttiglast.psi[0];
  const psiNyttig2 = indata.nyttiglast.psi[2];

  return [
    {
      id: 'BR-karakteristisk-sno',
      namn: 'Karakteristisk kombination – snö huvudlast',
      faktorer: { egentyngd: 1.0, sno: 1.0, nyttig: psiNyttig0, vind: 0 },
      snolastfall: 0,
      kvasipermanent: false,
    },
    {
      id: 'BR-kvasipermanent',
      namn: 'Kvasipermanent kombination (krypning)',
      faktorer: { egentyngd: 1.0, sno: psiSno2, nyttig: psiNyttig2, vind: 0 },
      snolastfall: 0,
      kvasipermanent: true,
    },
    {
      id: 'BR-karakteristisk-sno-osym',
      namn: 'Karakteristisk kombination – osymmetrisk snö',
      faktorer: { egentyngd: 1.0, sno: 1.0, nyttig: psiNyttig0, vind: 0 },
      snolastfall: Math.min(1, indata.antalSnolastfall - 1),
      kvasipermanent: false,
    },
    {
      id: 'BR-karakteristisk-nyttig',
      namn: 'Karakteristisk kombination – nyttig last huvudlast',
      faktorer: { egentyngd: 1.0, sno: psiSno0, nyttig: 1.0, vind: 0 },
      snolastfall: 0,
      kvasipermanent: false,
    },
  ];
}
