/**
 * Analysmotor: bygger FEM-modeller för varje baslastfall, superponerar dem
 * enligt lastkombinationerna och kontrollerar varje stång enligt Eurokod 5.
 */

import {
  area,
  dimensionNamn,
  egentyngdPerMeter,
  hittaKvalitet,
  kdef,
  troghetsmomentY,
  type Klimatklass,
  type TimberGrade,
  type Virkesdimension,
} from './materials';
import {
  berakSnolast,
  genereraBrukskombinationer,
  genereraKombinationer,
  NYTTIGLASTER,
  snoPsi,
  type Exponering,
  type Lastkombination,
  type Nyttiglast,
  type Sakerhetsklass,
  type Snolastresultat,
} from './loads';
import { losFem, type ElementResultat, type FemElement, type FemModell, type FemResultat } from './fem';
import {
  byggGeometri,
  stangLangd,
  type GeometriParametrar,
  type Stang,
  type StangTyp,
  type TakstolGeometri,
} from './geometri';
import {
  dimensioneringsvarden,
  knackning,
  kc90,
  kontrolleraSnitt,
  kontrolleraUpplagstryck,
  vippning,
  type Dimensioneringsvarden,
  type Knackningsdata,
  type Kontrollresultat,
  type Kontrolltyp,
} from './ec5';
import { berakVindlast, type Terrangtyp, type Vindresultat } from './vind';

export interface Sektionsval {
  kvalitet: string;
  dim: Virkesdimension;
}

export interface Indata {
  geometri: GeometriParametrar;
  /** Takstolarnas centrumavstånd, m */
  cc: number;
  /** Karakteristisk snölast på mark, kN/m² */
  sk: number;
  exponering: Exponering;
  Ct: number;
  /** Taktäckningens egentyngd, kN/m² taklutande yta */
  taktackningTyngd: number;
  /** Innertak och isolering, kN/m² horisontell yta */
  innertakTyngd: number;
  nyttiglastId: string;
  sakerhetsklass: Sakerhetsklass;
  klimatklass: Klimatklass;
  medVind: boolean;
  vb: number;
  terrang: Terrangtyp;
  byggnadshojd: number;
  /** Tvärsnitt per stångtyp */
  sektioner: Record<StangTyp, Sektionsval>;
  /** Avstånd mellan sidostagningar av överramen, m (normalt takläktens avstånd) */
  stagningOverram: number;
  /** Avstånd mellan sidostagningar av underramen, m (kortlingar eller undertak) */
  stagningUnderram: number;
  /** Avstånd mellan livstag på diagonaler och stolpar, m */
  stagningDiagonal: number;
  /** Knäcklängdsfaktor i takstolens plan */
  knacklangdsfaktor: number;
  /** Nedböjningskrav: L/nedbojningKarakteristisk och L/nedbojningSlutlig */
  nedbojningKarakteristisk: number;
  nedbojningSlutlig: number;
  /** Upplagets längd, mm */
  upplagslangd: number;
}

export const STANDARDINDATA: Omit<Indata, 'geometri' | 'sektioner'> = {
  cc: 1.2,
  sk: 2.0,
  exponering: 'normal',
  Ct: 1.0,
  taktackningTyngd: 0.55,
  innertakTyngd: 0.35,
  nyttiglastId: 'H',
  sakerhetsklass: 2,
  klimatklass: 2,
  medVind: false,
  vb: 24,
  terrang: 2,
  byggnadshojd: 7,
  stagningOverram: 0.4,
  stagningUnderram: 1.2,
  stagningDiagonal: 1.5,
  knacklangdsfaktor: 1.0,
  nedbojningKarakteristisk: 300,
  nedbojningSlutlig: 200,
  upplagslangd: 170,
};

/**
 * Utgångsdimensioner i C24. Värdena motsvarar en automatiskt dimensionerad
 * W-takstol med 9 m spännvidd i snözon 2,0 kN/m² och c/c 1,2 m.
 */
export function standardSektioner(): Record<StangTyp, Sektionsval> {
  return {
    overram: { kvalitet: 'C24', dim: { b: 45, h: 170 } },
    underram: { kvalitet: 'C24', dim: { b: 45, h: 145 } },
    diagonal: { kvalitet: 'C24', dim: { b: 45, h: 120 } },
    stolpe: { kvalitet: 'C24', dim: { b: 45, h: 120 } },
    hanbjalke: { kvalitet: 'C24', dim: { b: 45, h: 170 } },
    stodben: { kvalitet: 'C24', dim: { b: 45, h: 145 } },
    taksprang: { kvalitet: 'C24', dim: { b: 45, h: 170 } },
  };
}

type LastfallId = 'egentyngd' | 'sno0' | 'sno1' | 'sno2' | 'nyttig' | 'vind';

const SNOLASTFALL: LastfallId[] = ['sno0', 'sno1', 'sno2'];

interface Baslastfall {
  id: LastfallId;
  namn: string;
  resultat: FemResultat;
}

/* ------------------------------------------------------------------ */
/* Lastuppställning                                                    */
/* ------------------------------------------------------------------ */

export interface Lastsammanstallning {
  /** Taktäckning inkl. läkt, kN/m² taklutande yta */
  gTak: number;
  /** Taklast per takstol och meter takfall, kN/m */
  gTakLinje: number;
  /** Innertak, kN/m² horisontell yta */
  gInnertak: number;
  gInnertakLinje: number;
  /** Egentyngd av takstolens virke, kN */
  egentyngdVirke: number;
  sno: Snolastresultat;
  /** Snölast per takstol och meter, kN/m (symmetriskt fall) */
  snoLinje: number;
  nyttiglast: Nyttiglast;
  nyttigLinje: number;
  vind?: Vindresultat;
  /** Vindsug per takstol och meter takfall, kN/m */
  vindLinje?: number;
}

function elementstyvhet(grade: TimberGrade, dim: Virkesdimension) {
  const E = grade.E0mean * 1000; // MPa -> kN/m²
  const A = area(dim) / 1e6; // mm² -> m²
  const I = troghetsmomentY(dim) / 1e12; // mm⁴ -> m⁴
  return { EA: E * A, EI: E * I };
}

function riktning(g: TakstolGeometri, s: Stang) {
  const a = g.noder[s.n1];
  const b = g.noder[s.n2];
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  return { c: (b.x - a.x) / L, s: (b.y - a.y) / L, L };
}

/**
 * Bygger FEM-modellen för ett baslastfall. Lasterna anges per meter
 * elementlängd i globalt y-led (och x-led för vindsug).
 */
function byggModell(
  geo: TakstolGeometri,
  indata: Indata,
  laster: Lastsammanstallning,
  lastfall: LastfallId,
): FemModell {
  const element: FemElement[] = geo.stanger.map((s) => {
    const sekt = indata.sektioner[s.typ];
    const grade = hittaKvalitet(sekt.kvalitet);
    const { EA, EI } = elementstyvhet(grade, sekt.dim);
    const { c, s: sinus } = riktning(geo, s);
    const cosLutning = Math.abs(c);

    let qy = 0;
    let qx = 0;

    if (lastfall === 'egentyngd') {
      // Virkets egentyngd på alla stänger
      qy -= egentyngdPerMeter(sekt.dim, grade);
      if (s.takfall) {
        // Taktäckning anges per m² taklutande yta => direkt per meter stång
        qy -= laster.gTak * indata.cc;
      }
      if (s.bjalklag) {
        // Innertak anges per m² horisontell yta => projiceras på stången
        qy -= laster.gInnertak * indata.cc * cosLutning;
      }
    } else if (lastfall.startsWith('sno')) {
      if (s.takfall) {
        const idx = Number(lastfall.slice(3));
        const fall = laster.sno.lastfall[Math.min(idx, laster.sno.lastfall.length - 1)];
        const s0 = s.takfall === 'vanster' ? fall.vanster : fall.hoger;
        // Snölast anges per m² horisontell projektion
        qy -= s0 * indata.cc * cosLutning;
      }
    } else if (lastfall === 'nyttig') {
      if (s.bjalklag) {
        qy -= laster.nyttiglast.qk * indata.cc * cosLutning;
      }
    } else if (lastfall === 'vind') {
      if (s.takfall && laster.vindLinje) {
        // Sug vinkelrätt takytan. Ytans utåtriktade normal ska peka uppåt,
        // oavsett i vilken ordning stångens noder är definierade.
        const w = laster.vindLinje;
        const tecken = c >= 0 ? 1 : -1;
        qx += w * -sinus * tecken;
        qy += w * cosLutning;
      }
    }

    return {
      n1: s.n1,
      n2: s.n2,
      EA,
      EI,
      ledStart: s.ledad,
      ledSlut: s.ledad,
      qx,
      qy,
    };
  });

  return {
    noder: geo.noder.map((n) => ({ x: n.x, y: n.y })),
    element,
    upplag: [
      { nod: geo.upplagsnoder[0], ux: true, uy: true, rz: false },
      { nod: geo.upplagsnoder[1], ux: false, uy: true, rz: false },
    ],
    nodlaster: [],
  };
}

export function sammanstallLaster(geo: TakstolGeometri, indata: Indata): Lastsammanstallning {
  const nyttiglast =
    NYTTIGLASTER.find((n) => n.id === indata.nyttiglastId) ?? NYTTIGLASTER[0];
  const sno = berakSnolast(
    indata.sk,
    indata.geometri.taklutning,
    indata.geometri.taklutningHoger,
    indata.exponering,
    indata.Ct,
  );

  let egentyngdVirke = 0;
  for (const s of geo.stanger) {
    const sekt = indata.sektioner[s.typ];
    const grade = hittaKvalitet(sekt.kvalitet);
    egentyngdVirke += egentyngdPerMeter(sekt.dim, grade) * stangLangd(geo, s) * s.antal;
  }

  const vind = indata.medVind
    ? berakVindlast({
        vb: indata.vb,
        terrang: indata.terrang,
        byggnadshojd: indata.byggnadshojd,
        taklutning: indata.geometri.taklutning,
      })
    : undefined;

  return {
    gTak: indata.taktackningTyngd,
    gTakLinje: indata.taktackningTyngd * indata.cc,
    gInnertak: indata.innertakTyngd,
    gInnertakLinje: indata.innertakTyngd * indata.cc,
    egentyngdVirke,
    sno,
    snoLinje: sno.s * indata.cc,
    nyttiglast,
    nyttigLinje: nyttiglast.qk * indata.cc,
    vind,
    vindLinje: vind ? vind.wSug * indata.cc : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Superposition och kontroll                                          */
/* ------------------------------------------------------------------ */

export interface StangKontroll {
  stangId: string;
  namn: string;
  typ: StangTyp;
  langd: number;
  kvalitet: string;
  dimension: string;
  dim: Virkesdimension;
  /** Dimensionerande utnyttjandegrad */
  utnyttjande: number;
  /** Avgörande kontroll */
  kontroll: Kontrolltyp;
  formel: string;
  /** Avgörande lastkombination */
  kombination: string;
  /** Dimensionerande snittkrafter i det avgörande snittet */
  N: number;
  M: number;
  V: number;
  /** Största drag- respektive tryckkraft över alla kombinationer */
  Nmax: number;
  Nmin: number;
  Mmax: number;
  knackning: Knackningsdata;
  kcrit: number;
  dimensioneringsvarden: Dimensioneringsvarden;
  /** Alla kontroller i det avgörande snittet */
  kontroller: Kontrollresultat[];
}

export interface Nedbojningsresultat {
  /** Momentan nedböjning av variabel last, mm */
  winstQ: number;
  /** Momentan nedböjning av egentyngd, mm */
  winstG: number;
  /** Slutlig nedböjning inkl. krypning, mm */
  wfin: number;
  gransKarakteristisk: number;
  gransSlutlig: number;
  utnyttjandeKarakteristisk: number;
  utnyttjandeSlutlig: number;
  /** Horisontell rörelse vid det rörliga upplaget, mm */
  horisontellRorelse: number;
  /** Nedböjning i taksprånget, mm */
  taksprangNedbojning: number;
}

export interface Upplagsresultat {
  nod: number;
  /** Största vertikala reaktion, kN */
  Rvert: number;
  /** Största horisontella reaktion, kN */
  Rhoriz: number;
  /** Största lyftkraft (negativ vertikalreaktion), kN */
  Rlyft: number;
  kontroll: Kontrollresultat;
  /** Upplagslängd som krävs för att klara tryck vinkelrätt fibrerna, mm */
  erforderligUpplagslangd: number;
}

export interface Analysresultat {
  geometri: TakstolGeometri;
  laster: Lastsammanstallning;
  kombinationer: Lastkombination[];
  stanger: StangKontroll[];
  nedbojning: Nedbojningsresultat;
  upplag: Upplagsresultat[];
  /** Högsta utnyttjandegrad i hela takstolen, inklusive upplagstryck */
  maxUtnyttjande: number;
  /** Högsta utnyttjandegrad för stänger och nedböjning (exkl. upplagstryck) */
  maxUtnyttjandeBarverk: number;
  godkand: boolean;
  varningar: string[];
  /** Snittkrafter per stång för den avgörande kombinationen, för diagram */
  snittkurvor: { stangId: string; N: number[]; M: number[]; V: number[]; x: number[] }[];
  /** Nodförskjutningar för den karakteristiska kombinationen, m */
  deformation: { ux: number; uy: number }[];
  virkesatgang: { typ: StangTyp; langd: number; dimension: string; kvalitet: string }[];
}

function faktorForLastfall(komb: Lastkombination, id: LastfallId): number {
  if (id === 'egentyngd') return komb.faktorer.egentyngd;
  if (id === 'nyttig') return komb.faktorer.nyttig;
  if (id === 'vind') return komb.faktorer.vind;
  const idx = Number(id.slice(3));
  return komb.snolastfall === idx ? komb.faktorer.sno : 0;
}

function knacklangder(
  geo: TakstolGeometri,
  s: Stang,
  indata: Indata,
): { lcY: number; lcZ: number; lef: number } {
  const L = stangLangd(geo, s);
  const lcY = L * indata.knacklangdsfaktor;
  let lcZ = L;
  if (s.typ === 'overram' || s.typ === 'taksprang') {
    lcZ = Math.min(L, Math.max(indata.stagningOverram, 0.1));
  } else if (s.typ === 'underram') {
    lcZ = Math.min(L, Math.max(indata.stagningUnderram, 0.1));
  } else if (indata.stagningDiagonal > 0) {
    lcZ = Math.min(L, Math.max(indata.stagningDiagonal, 0.1));
  }
  return { lcY, lcZ, lef: 0.9 * lcZ };
}

export function analysera(indata: Indata): Analysresultat {
  const geo = byggGeometri(indata.geometri);
  const laster = sammanstallLaster(geo, indata);
  const varningar: string[] = [];

  const antalSnolastfall = laster.sno.lastfall.length;
  const kombIndata = {
    sakerhetsklass: indata.sakerhetsklass,
    sk: indata.sk,
    nyttiglast: laster.nyttiglast,
    antalSnolastfall,
    medVind: indata.medVind,
  };
  const kombinationer = genereraKombinationer(kombIndata);
  const brukskombinationer = genereraBrukskombinationer(kombIndata);

  // Lös alla baslastfall
  const baslastfall: Baslastfall[] = [];
  const lastfallIds: LastfallId[] = ['egentyngd', ...SNOLASTFALL.slice(0, antalSnolastfall)];
  if (laster.nyttiglast.qk > 0) lastfallIds.push('nyttig');
  if (indata.medVind) lastfallIds.push('vind');

  for (const id of lastfallIds) {
    const modell = byggModell(geo, indata, laster, id);
    baslastfall.push({ id, namn: id, resultat: losFem(modell) });
  }

  const hamta = (id: LastfallId): FemResultat | undefined =>
    baslastfall.find((b) => b.id === id)?.resultat;

  /* --- Brottgränstillstånd --- */

  const stangKontroller: StangKontroll[] = [];
  const snittkurvor: Analysresultat['snittkurvor'] = [];

  geo.stanger.forEach((stang, elementIndex) => {
    const sekt = indata.sektioner[stang.typ];
    const grade = hittaKvalitet(sekt.kvalitet);
    const { lcY, lcZ, lef } = knacklangder(geo, stang, indata);
    const knack = knackning(grade, sekt.dim, lcY, lcZ);
    const { kcrit } = vippning(grade, sekt.dim, lef);
    const L = stangLangd(geo, stang);

    let basta: StangKontroll | null = null;
    let Nmax = 0;
    let Nmin = 0;
    let Mmax = 0;
    let avgorandeKurva: { N: number[]; M: number[]; V: number[]; x: number[] } | null = null;

    for (const komb of kombinationer) {
      const dv = dimensioneringsvarden(grade, sekt.dim, indata.klimatklass, komb.varaktighet);

      // Superponera snittkrafter
      const referens = baslastfall[0].resultat.element[elementIndex];
      const antalSnitt = referens.snitt.length;
      const N = new Array(antalSnitt).fill(0);
      const M = new Array(antalSnitt).fill(0);
      const V = new Array(antalSnitt).fill(0);
      const x = referens.snitt.map((s) => s.x);

      for (const bl of baslastfall) {
        const f = faktorForLastfall(komb, bl.id);
        if (f === 0) continue;
        const er: ElementResultat = bl.resultat.element[elementIndex];
        for (let i = 0; i < antalSnitt; i++) {
          N[i] += f * er.snitt[i].N;
          M[i] += f * er.snitt[i].M;
          V[i] += f * er.snitt[i].V;
        }
      }

      Nmax = Math.max(Nmax, ...N);
      Nmin = Math.min(Nmin, ...N);
      Mmax = Math.max(Mmax, ...M.map(Math.abs));

      for (let i = 0; i < antalSnitt; i++) {
        const kontroller = kontrolleraSnitt({
          N: N[i],
          M: M[i],
          V: V[i],
          grade,
          dim: sekt.dim,
          dv,
          knack,
          kcrit,
        });
        const varst = kontroller.reduce((a, b) => (b.utnyttjande > a.utnyttjande ? b : a));
        if (!basta || varst.utnyttjande > basta.utnyttjande) {
          basta = {
            stangId: stang.id,
            namn: stang.namn,
            typ: stang.typ,
            langd: L,
            kvalitet: grade.namn,
            dimension: dimensionNamn(sekt.dim),
            dim: sekt.dim,
            utnyttjande: varst.utnyttjande,
            kontroll: varst.typ,
            formel: varst.formel,
            kombination: komb.namn,
            N: N[i],
            M: M[i],
            V: V[i],
            Nmax,
            Nmin,
            Mmax,
            knackning: knack,
            kcrit,
            dimensioneringsvarden: dv,
            kontroller,
          };
          avgorandeKurva = { N: [...N], M: [...M], V: [...V], x };
        }
      }
    }

    if (basta) {
      basta.Nmax = Nmax;
      basta.Nmin = Nmin;
      basta.Mmax = Mmax;
      stangKontroller.push(basta);
    }
    if (avgorandeKurva) {
      snittkurvor.push({ stangId: stang.id, ...avgorandeKurva });
    }
  });

  /* --- Bruksgränstillstånd --- */

  const spannvidd = geo.spannvidd;
  const upplagsNoder = new Set(geo.upplagsnoder);
  const taksprangNoder = new Set<number>();
  for (const s of geo.stanger) {
    if (s.typ === 'taksprang') {
      if (!upplagsNoder.has(s.n1)) taksprangNoder.add(s.n1);
      if (!upplagsNoder.has(s.n2)) taksprangNoder.add(s.n2);
    }
  }

  const maxNedbojning = (res: FemResultat | undefined, inomSpann: boolean): number => {
    if (!res) return 0;
    let max = 0;
    res.forskjutningar.forEach((f, i) => {
      const arTaksprang = taksprangNoder.has(i);
      if (inomSpann === arTaksprang) return;
      max = Math.max(max, -f.uy);
    });
    return max * 1000; // m -> mm
  };

  const uG = maxNedbojning(hamta('egentyngd'), true);
  const snoPsiVarden = snoPsi(indata.sk);
  const uSno = Math.max(
    ...SNOLASTFALL.slice(0, antalSnolastfall).map((id) => maxNedbojning(hamta(id), true)),
  );
  const uNyttig = maxNedbojning(hamta('nyttig'), true);

  const kdefVarde = kdef(hittaKvalitet(indata.sektioner.underram.kvalitet).family, indata.klimatklass);

  // Snölast som huvudlast ger normalt störst nedböjning
  const winstQ = Math.max(
    uSno + laster.nyttiglast.psi[0] * uNyttig,
    uNyttig + snoPsiVarden.psi0 * uSno,
  );
  const wfin =
    uG * (1 + kdefVarde) +
    uSno * (1 + snoPsiVarden.psi2 * kdefVarde) +
    uNyttig * (laster.nyttiglast.psi[0] + laster.nyttiglast.psi[2] * kdefVarde);

  const gransKar = (spannvidd * 1000) / indata.nedbojningKarakteristisk;
  const gransSlut = (spannvidd * 1000) / indata.nedbojningSlutlig;

  const rullNod = geo.upplagsnoder[1];
  let horisontellRorelse = 0;
  for (const id of lastfallIds) {
    const r = hamta(id);
    if (!r) continue;
    horisontellRorelse = Math.max(horisontellRorelse, Math.abs(r.forskjutningar[rullNod].ux));
  }
  horisontellRorelse *= 1000;

  const taksprangNedbojning = Math.max(
    maxNedbojning(hamta('egentyngd'), false),
    ...SNOLASTFALL.slice(0, antalSnolastfall).map((id) => maxNedbojning(hamta(id), false)),
  );

  const nedbojning: Nedbojningsresultat = {
    winstQ,
    winstG: uG,
    wfin,
    gransKarakteristisk: gransKar,
    gransSlutlig: gransSlut,
    utnyttjandeKarakteristisk: winstQ / gransKar,
    utnyttjandeSlutlig: wfin / gransSlut,
    horisontellRorelse,
    taksprangNedbojning,
  };

  /* --- Upplag --- */

  const upplag: Upplagsresultat[] = geo.upplagsnoder.map((nod) => {
    let Rvert = 0;
    let Rhoriz = 0;
    let Rlyft = 0;
    let varstDv: Dimensioneringsvarden | null = null;

    for (const komb of kombinationer) {
      let fy = 0;
      let fx = 0;
      for (const bl of baslastfall) {
        const f = faktorForLastfall(komb, bl.id);
        if (f === 0) continue;
        fy += f * bl.resultat.reaktioner[nod].fy;
        fx += f * bl.resultat.reaktioner[nod].fx;
      }
      if (fy > Rvert) {
        Rvert = fy;
        varstDv = dimensioneringsvarden(
          hittaKvalitet(indata.sektioner.underram.kvalitet),
          indata.sektioner.underram.dim,
          indata.klimatklass,
          komb.varaktighet,
        );
      }
      Rlyft = Math.min(Rlyft, fy);
      Rhoriz = Math.max(Rhoriz, Math.abs(fx));
    }

    // Lyftkontroll med gynnsam egentyngd (0,9·G + 1,5·γd·W)
    if (indata.medVind) {
      const g = hamta('egentyngd');
      const v = hamta('vind');
      if (g && v) {
        const gd = indata.sakerhetsklass === 1 ? 0.83 : indata.sakerhetsklass === 2 ? 0.91 : 1.0;
        const lyft = 0.9 * g.reaktioner[nod].fy + 1.5 * gd * v.reaktioner[nod].fy;
        Rlyft = Math.min(Rlyft, lyft);
      }
    }

    const dv =
      varstDv ??
      dimensioneringsvarden(
        hittaKvalitet(indata.sektioner.underram.kvalitet),
        indata.sektioner.underram.dim,
        indata.klimatklass,
        'medellang',
      );

    const underramGrade = hittaKvalitet(indata.sektioner.underram.kvalitet);
    const kontroll = kontrolleraUpplagstryck(
      Rvert,
      indata.sektioner.underram.dim,
      indata.upplagslangd,
      dv,
      kc90(underramGrade, true),
    );

    return {
      nod,
      Rvert,
      Rhoriz,
      Rlyft,
      kontroll,
      erforderligUpplagslangd: kontroll.erforderligLangd,
    };
  });

  /* --- Sammanställning --- */

  const maxUtnyttjandeBarverk = Math.max(
    ...stangKontroller.map((s) => s.utnyttjande),
    nedbojning.utnyttjandeKarakteristisk,
    nedbojning.utnyttjandeSlutlig,
  );
  const maxUtnyttjande = Math.max(
    maxUtnyttjandeBarverk,
    ...upplag.map((u) => u.kontroll.utnyttjande),
  );

  if (indata.geometri.taklutning < 14 && indata.geometri.modell !== 'parallell') {
    varningar.push(
      'Taklutning under 14° ställer särskilda krav på tätskikt och ger stor risk för snöansamling. Kontrollera även snöfickor och drivbildning.',
    );
  }
  if (indata.sk >= 3 && indata.cc > 1.2) {
    varningar.push(
      'Vid hög snölast bör centrumavståndet mellan takstolarna normalt inte överstiga 1,2 m.',
    );
  }
  if (nedbojning.horisontellRorelse > 15) {
    varningar.push(
      `Den horisontella rörelsen vid upplaget är ${nedbojning.horisontellRorelse.toFixed(1)} mm. Upplaget måste tillåta rörelsen och innerväggar under takstolen får inte belastas.`,
    );
  }
  if (indata.medVind && upplag.some((u) => u.Rlyft < 0)) {
    const max = Math.min(...upplag.map((u) => u.Rlyft));
    varningar.push(
      `Vindsuget ger lyftkraft ${Math.abs(max).toFixed(2)} kN vid upplaget. Takstolen måste förankras mot lyftning, t.ex. med vinkelbeslag eller bandförankring.`,
    );
  }
  const varstUpplag = upplag.reduce((a, b) => (b.kontroll.utnyttjande > a.kontroll.utnyttjande ? b : a));
  if (varstUpplag.kontroll.utnyttjande > 1.0) {
    varningar.push(
      `Trycket vinkelrätt fibrerna vid upplaget överskrids (${(varstUpplag.kontroll.utnyttjande * 100).toFixed(0)} %). Upplagslängden behöver ökas till minst ${Math.ceil(varstUpplag.erforderligUpplagslangd / 10) * 10} mm, alternativt används en tryckfördelande upplagsplatta eller grövre underram.`,
    );
  }
  if (geo.modell === 'pulpet' && indata.geometri.taklutning > 20) {
    varningar.push(
      'Pulpettakstolar utförs normalt med 5–14° taklutning. Med brantare lutning blir stolpen vid den höga sidan lång och tryckt, och den behöver då stagas i sidled eller ersättas med en pelare.',
    );
  }
  if (geo.modell === 'sax') {
    varningar.push(
      'Saxtakstolar ger horisontella upplagskrafter och större nedböjning. Kontrollera att väggarna kan ta de horisontella krafterna.',
    );
  }

  const virkesatgangMap = new Map<string, { typ: StangTyp; langd: number; dimension: string; kvalitet: string }>();
  for (const s of geo.stanger) {
    const sekt = indata.sektioner[s.typ];
    const nyckel = `${s.typ}-${dimensionNamn(sekt.dim)}-${sekt.kvalitet}`;
    const post = virkesatgangMap.get(nyckel) ?? {
      typ: s.typ,
      langd: 0,
      dimension: dimensionNamn(sekt.dim),
      kvalitet: sekt.kvalitet,
    };
    post.langd += stangLangd(geo, s) * s.antal;
    virkesatgangMap.set(nyckel, post);
  }

  // Deformationsfigur för den karakteristiska kombinationen
  const deformation = geo.noder.map((_, i) => {
    let ux = 0;
    let uy = 0;
    for (const bk of brukskombinationer.slice(0, 1)) {
      for (const bl of baslastfall) {
        const f =
          bl.id === 'egentyngd'
            ? bk.faktorer.egentyngd
            : bl.id === 'nyttig'
              ? bk.faktorer.nyttig
              : bl.id === 'vind'
                ? bk.faktorer.vind
                : Number(bl.id.slice(3)) === bk.snolastfall
                  ? bk.faktorer.sno
                  : 0;
        if (f === 0) continue;
        ux += f * bl.resultat.forskjutningar[i].ux;
        uy += f * bl.resultat.forskjutningar[i].uy;
      }
    }
    return { ux, uy };
  });
  return {
    geometri: geo,
    laster,
    kombinationer,
    stanger: stangKontroller,
    nedbojning,
    upplag,
    maxUtnyttjande,
    maxUtnyttjandeBarverk,
    godkand: maxUtnyttjande <= 1.0,
    varningar,
    snittkurvor,
    deformation,
    virkesatgang: [...virkesatgangMap.values()],
  };
}

/* ------------------------------------------------------------------ */
/* Automatisk dimensionering                                           */
/* ------------------------------------------------------------------ */

export interface AutodimResultat {
  sektioner: Record<StangTyp, Sektionsval>;
  resultat: Analysresultat;
  lyckades: boolean;
  iterationer: number;
}

/**
 * Söker minsta standarddimension per stångtyp som klarar alla kontroller.
 * Eftersom systemet är statiskt obestämt itereras beräkningen tills valet
 * är stabilt.
 */
export function autodimensionera(
  indata: Indata,
  tillgangligaDimensioner: Record<StangTyp, Virkesdimension[]>,
  maxIterationer = 20,
): AutodimResultat {
  const typer = Object.keys(indata.sektioner) as StangTyp[];
  const index: Record<StangTyp, number> = {} as Record<StangTyp, number>;
  for (const t of typer) index[t] = 0;

  const sektionerFor = (): Record<StangTyp, Sektionsval> => {
    const s = {} as Record<StangTyp, Sektionsval>;
    for (const t of typer) {
      const lista = tillgangligaDimensioner[t];
      s[t] = { kvalitet: indata.sektioner[t].kvalitet, dim: lista[Math.min(index[t], lista.length - 1)] };
    }
    return s;
  };

  let resultat = analysera({ ...indata, sektioner: sektionerFor() });
  let iterationer = 1;

  while (iterationer < maxIterationer) {
    // Vilka stångtyper är överutnyttjade?
    const behov = new Map<StangTyp, number>();
    for (const s of resultat.stanger) {
      const nuvarande = behov.get(s.typ) ?? 0;
      behov.set(s.typ, Math.max(nuvarande, s.utnyttjande));
    }
    // Nedböjning styr över- och underram
    if (resultat.nedbojning.utnyttjandeKarakteristisk > 1 || resultat.nedbojning.utnyttjandeSlutlig > 1) {
      for (const t of ['overram', 'underram'] as StangTyp[]) {
        behov.set(t, Math.max(behov.get(t) ?? 0, 1.01));
      }
    }

    let andrad = false;
    for (const [typ, utnyttjande] of behov) {
      if (utnyttjande > 1.0 && index[typ] < tillgangligaDimensioner[typ].length - 1) {
        index[typ] += 1;
        andrad = true;
      }
    }
    if (!andrad) break;
    resultat = analysera({ ...indata, sektioner: sektionerFor() });
    iterationer += 1;
  }

  return {
    sektioner: sektionerFor(),
    resultat,
    // Upplagstrycket kan inte lösas genom att välja grövre virke i sig utan
    // styrs av upplagslängden, och ingår därför inte i sökningens utfall.
    lyckades: resultat.maxUtnyttjandeBarverk <= 1.0,
    iterationer,
  };
}

/* ------------------------------------------------------------------ */
/* Kombinationsmatris: virkeskvalitet × snözon                         */
/* ------------------------------------------------------------------ */

export interface MatrisCell {
  kvalitet: string;
  sk: number;
  maxUtnyttjande: number;
  godkand: boolean;
  avgorande: string;
  /** Minsta dimension på överramen som klarar kraven */
  overram?: string;
  underram?: string;
}

export function byggKombinationsmatris(
  indata: Indata,
  kvaliteter: string[],
  snozoner: number[],
  tillgangligaDimensioner: Record<StangTyp, Virkesdimension[]>,
): MatrisCell[] {
  const celler: MatrisCell[] = [];
  for (const kvalitet of kvaliteter) {
    for (const sk of snozoner) {
      const sektioner = { ...indata.sektioner };
      for (const t of Object.keys(sektioner) as StangTyp[]) {
        sektioner[t] = { ...sektioner[t], kvalitet };
      }
      const auto = autodimensionera({ ...indata, sk, sektioner }, tillgangligaDimensioner, 12);
      const avgorandeStang = auto.resultat.stanger.reduce((a, b) =>
        b.utnyttjande > a.utnyttjande ? b : a,
      );
      celler.push({
        kvalitet,
        sk,
        maxUtnyttjande: auto.resultat.maxUtnyttjande,
        godkand: auto.lyckades,
        avgorande: auto.resultat.nedbojning.utnyttjandeSlutlig > avgorandeStang.utnyttjande
          ? 'Nedböjning'
          : `${avgorandeStang.namn}`,
        overram: dimensionNamn(auto.sektioner.overram.dim),
        underram: dimensionNamn(auto.sektioner.underram.dim),
      });
    }
  }
  return celler;
}

export function klimatklassNamn(k: Klimatklass): string {
  switch (k) {
    case 1:
      return 'Klimatklass 1 – uppvärmt inomhusklimat, RF ≤ 65 %';
    case 2:
      return 'Klimatklass 2 – ventilerad kallvind eller uteluftsventilerat utrymme';
    case 3:
      return 'Klimatklass 3 – utomhus eller fuktig miljö';
  }
}
