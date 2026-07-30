/**
 * 2D ram- och fackverksberäkning med direkta styvhetsmetoden.
 *
 * Varje nod har tre frihetsgrader: ux, uy och rotation rz.
 * Element är balkelement (normalkraft + böjning) och kan ha momentled i
 * ändarna, vilket gör att både fackverk (ledade diagonaler) och ramverk
 * (styva knutpunkter) kan modelleras i samma system.
 *
 * Enheter: längd i m, kraft i kN, moment i kNm, EA i kN, EI i kNm².
 */

export interface FemNod {
  x: number;
  y: number;
}

export interface FemUpplag {
  nod: number;
  ux: boolean;
  uy: boolean;
  rz: boolean;
}

export interface FemElement {
  n1: number;
  n2: number;
  EA: number;
  EI: number;
  /** Momentled vid nod 1 */
  ledStart?: boolean;
  /** Momentled vid nod 2 */
  ledSlut?: boolean;
  /** Utbredd last i globalt x-led, kN per meter elementlängd */
  qx?: number;
  /** Utbredd last i globalt y-led, kN per meter elementlängd (negativ = nedåt) */
  qy?: number;
}

export interface FemNodlast {
  nod: number;
  fx?: number;
  fy?: number;
  mz?: number;
}

export interface FemModell {
  noder: FemNod[];
  element: FemElement[];
  upplag: FemUpplag[];
  nodlaster: FemNodlast[];
}

export interface Snittkraft {
  /** Avstånd från elementets startnod, m */
  x: number;
  /** Normalkraft, kN (drag positiv) */
  N: number;
  /** Tvärkraft, kN */
  V: number;
  /** Böjmoment, kNm (positivt = drag i underkant) */
  M: number;
}

export interface ElementResultat {
  /** Elementändkrafter i lokala koordinater [N1, V1, M1, N2, V2, M2] */
  andkrafter: number[];
  /** Snittkrafter i ett antal punkter längs elementet */
  snitt: Snittkraft[];
  /** Maximal normalkraft (drag positiv) */
  Nmax: number;
  /** Minimal normalkraft (mest tryck) */
  Nmin: number;
  /** Största absoluta tvärkraft */
  Vmax: number;
  /** Största positiva och negativa böjmoment */
  Mmax: number;
  Mmin: number;
  langd: number;
}

export interface FemResultat {
  /** Nodförskjutningar [ux, uy, rz] per nod, m respektive rad */
  forskjutningar: { ux: number; uy: number; rz: number }[];
  element: ElementResultat[];
  /** Upplagsreaktioner per nod (0 för fria noder) */
  reaktioner: { fx: number; fy: number; mz: number }[];
}

const SNITT_PER_ELEMENT = 21;

function elementGeometri(m: FemModell, e: FemElement) {
  const a = m.noder[e.n1];
  const b = m.noder[e.n2];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy);
  if (L < 1e-9) throw new Error('Element med noll längd');
  return { L, c: dx / L, s: dy / L };
}

/** Lokal styvhetsmatris 6×6 för balkelement. */
function lokalStyvhet(EA: number, EI: number, L: number): number[][] {
  const k = Array.from({ length: 6 }, () => new Array(6).fill(0));
  const a = EA / L;
  const b12 = (12 * EI) / L ** 3;
  const b6 = (6 * EI) / L ** 2;
  const b4 = (4 * EI) / L;
  const b2 = (2 * EI) / L;

  k[0][0] = a;
  k[0][3] = -a;
  k[3][0] = -a;
  k[3][3] = a;

  k[1][1] = b12;
  k[1][2] = b6;
  k[1][4] = -b12;
  k[1][5] = b6;
  k[2][1] = b6;
  k[2][2] = b4;
  k[2][4] = -b6;
  k[2][5] = b2;
  k[4][1] = -b12;
  k[4][2] = -b6;
  k[4][4] = b12;
  k[4][5] = -b6;
  k[5][1] = b6;
  k[5][2] = b2;
  k[5][4] = -b6;
  k[5][5] = b4;

  return k;
}

/** Ekvivalenta nodlaster i lokala koordinater för konstant utbredd last. */
function lokalEkvivalentLast(qxL: number, qyL: number, L: number): number[] {
  return [
    (qxL * L) / 2,
    (qyL * L) / 2,
    (qyL * L * L) / 12,
    (qxL * L) / 2,
    (qyL * L) / 2,
    (-qyL * L * L) / 12,
  ];
}

/**
 * Statisk kondensering av frihetsgrader med momentled.
 * Returnerar reducerad styvhetsmatris och lastvektor samt data för
 * återberäkning av de kondenserade rotationerna.
 */
function kondensera(k: number[][], feq: number[], slappa: number[]) {
  if (slappa.length === 0) {
    return { k, feq, slappa, kcc: [] as number[][], kcr: [] as number[][] };
  }
  const behall = [0, 1, 2, 3, 4, 5].filter((i) => !slappa.includes(i));
  const kcc = slappa.map((i) => slappa.map((j) => k[i][j]));
  const kcr = slappa.map((i) => behall.map((j) => k[i][j]));
  const krc = behall.map((i) => slappa.map((j) => k[i][j]));
  const kccInv = inversMatris(kcc);

  const kNy = k.map((rad) => rad.slice());
  const feqNy = feq.slice();

  // k* = k_rr - k_rc · k_cc⁻¹ · k_cr
  const krcKcc = matmul(krc, kccInv);
  const korr = matmul(krcKcc, kcr);
  for (let i = 0; i < behall.length; i++) {
    for (let j = 0; j < behall.length; j++) {
      kNy[behall[i]][behall[j]] = k[behall[i]][behall[j]] - korr[i][j];
    }
  }
  // Nollställ rader/kolumner för de släppta frihetsgraderna
  for (const i of slappa) {
    for (let j = 0; j < 6; j++) {
      kNy[i][j] = 0;
      kNy[j][i] = 0;
    }
    // Liten diagonalterm så att systemet förblir lösbart lokalt;
    // rotationen återberäknas separat.
    kNy[i][i] = 0;
  }

  // f* = f_r - k_rc · k_cc⁻¹ · f_c
  const fc = slappa.map((i) => feq[i]);
  const korrF = matvec(krcKcc, fc);
  for (let i = 0; i < behall.length; i++) {
    feqNy[behall[i]] = feq[behall[i]] - korrF[i];
  }
  for (const i of slappa) feqNy[i] = 0;

  return { k: kNy, feq: feqNy, slappa, kcc: kccInv, kcr };
}

function matmul(a: number[][], b: number[][]): number[][] {
  const n = a.length;
  const m = b[0].length;
  const p = b.length;
  const out = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < n; i++)
    for (let kk = 0; kk < p; kk++) {
      const aik = a[i][kk];
      if (aik === 0) continue;
      for (let j = 0; j < m; j++) out[i][j] += aik * b[kk][j];
    }
  return out;
}

function matvec(a: number[][], v: number[]): number[] {
  return a.map((rad) => rad.reduce((s, x, j) => s + x * v[j], 0));
}

function inversMatris(a: number[][]): number[][] {
  const n = a.length;
  const m = a.map((rad, i) => [...rad, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    if (Math.abs(m[pivot][col]) < 1e-12) throw new Error('Singulär matris vid kondensering');
    [m[col], m[pivot]] = [m[pivot], m[col]];
    const d = m[col][col];
    for (let j = 0; j < 2 * n; j++) m[col][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = m[r][col];
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j++) m[r][j] -= f * m[col][j];
    }
  }
  return m.map((rad) => rad.slice(n));
}

/** Transformationsmatris från globala till lokala koordinater. */
function transformation(c: number, s: number): number[][] {
  const T = Array.from({ length: 6 }, () => new Array(6).fill(0));
  const blocks = [0, 3];
  for (const o of blocks) {
    T[o][o] = c;
    T[o][o + 1] = s;
    T[o + 1][o] = -s;
    T[o + 1][o + 1] = c;
    T[o + 2][o + 2] = 1;
  }
  return T;
}

function losLinjartSystem(K: number[][], F: number[]): number[] {
  const n = F.length;
  const M = K.map((rad, i) => [...rad, F[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    if (Math.abs(M[pivot][col]) < 1e-10) {
      throw new Error(
        'Systemet är instabilt (singulär styvhetsmatris). Kontrollera upplag och stångindelning.',
      );
    }
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / M[col][col];
      if (f === 0) continue;
      for (let j = col; j <= n; j++) M[r][j] -= f * M[col][j];
    }
  }
  const u = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * u[j];
    u[i] = s / M[i][i];
  }
  return u;
}

export function losFem(modell: FemModell): FemResultat {
  const nNoder = modell.noder.length;
  const nDof = nNoder * 3;
  const K = Array.from({ length: nDof }, () => new Array(nDof).fill(0));
  const F = new Array(nDof).fill(0);

  interface ElementData {
    kLokal: number[][];
    kKond: number[][];
    feqLokal: number[];
    feqKond: number[];
    T: number[][];
    L: number;
    qxL: number;
    qyL: number;
    slappa: number[];
    kccInv: number[][];
    kcr: number[][];
    dofs: number[];
  }
  const elementData: ElementData[] = [];

  for (const e of modell.element) {
    const { L, c, s } = elementGeometri(modell, e);
    const kLokal = lokalStyvhet(e.EA, e.EI, L);
    // Global utbredd last projiceras på lokala axlar
    const qx = e.qx ?? 0;
    const qy = e.qy ?? 0;
    const qxL = qx * c + qy * s;
    const qyL = -qx * s + qy * c;
    const feqLokal = lokalEkvivalentLast(qxL, qyL, L);

    const slappa: number[] = [];
    if (e.ledStart) slappa.push(2);
    if (e.ledSlut) slappa.push(5);
    const kond = kondensera(kLokal, feqLokal, slappa);

    const T = transformation(c, s);
    const Tt = transponera(T);
    const kGlobal = matmul(matmul(Tt, kond.k), T);
    const feqGlobal = matvec(Tt, kond.feq);

    const dofs = [e.n1 * 3, e.n1 * 3 + 1, e.n1 * 3 + 2, e.n2 * 3, e.n2 * 3 + 1, e.n2 * 3 + 2];
    for (let i = 0; i < 6; i++) {
      F[dofs[i]] += feqGlobal[i];
      for (let j = 0; j < 6; j++) K[dofs[i]][dofs[j]] += kGlobal[i][j];
    }

    elementData.push({
      kLokal,
      kKond: kond.k,
      feqLokal,
      feqKond: kond.feq,
      T,
      L,
      qxL,
      qyL,
      slappa,
      kccInv: kond.kcc,
      kcr: kond.kcr,
      dofs,
    });
  }

  for (const l of modell.nodlaster) {
    F[l.nod * 3] += l.fx ?? 0;
    F[l.nod * 3 + 1] += l.fy ?? 0;
    F[l.nod * 3 + 2] += l.mz ?? 0;
  }

  // Frihetsgrader som är låsta av upplag
  const last = new Array(nDof).fill(false);
  for (const u of modell.upplag) {
    if (u.ux) last[u.nod * 3] = true;
    if (u.uy) last[u.nod * 3 + 1] = true;
    if (u.rz) last[u.nod * 3 + 2] = true;
  }
  // Rotationsfrihetsgrader utan styvhet (alla anslutande element har led)
  // låses för att undvika singulär matris.
  for (let i = 0; i < nDof; i++) {
    if (!last[i] && Math.abs(K[i][i]) < 1e-9) last[i] = true;
  }

  const fria: number[] = [];
  for (let i = 0; i < nDof; i++) if (!last[i]) fria.push(i);

  const Kred = fria.map((i) => fria.map((j) => K[i][j]));
  const Fred = fria.map((i) => F[i]);
  const ured = losLinjartSystem(Kred, Fred);

  const U = new Array(nDof).fill(0);
  fria.forEach((dof, i) => {
    U[dof] = ured[i];
  });

  // Elementändkrafter och snittkrafter
  const elementResultat: ElementResultat[] = modell.element.map((_, idx) => {
    const d = elementData[idx];
    const uGlobal = d.dofs.map((dof) => U[dof]);
    const uLokal = matvec(d.T, uGlobal);

    // Återberäkna släppta rotationer: u_c = -k_cc⁻¹ (k_cr u_r + FEF_c)
    if (d.slappa.length > 0) {
      const behall = [0, 1, 2, 3, 4, 5].filter((i) => !d.slappa.includes(i));
      const ur = behall.map((i) => uLokal[i]);
      const kcrUr = matvec(d.kcr, ur);
      const fc = d.slappa.map((i) => -d.feqLokal[i]); // FEF = -feq
      const rhs = kcrUr.map((v, i) => v + fc[i]);
      const uc = matvec(d.kccInv, rhs).map((v) => -v);
      d.slappa.forEach((dofIdx, i) => {
        uLokal[dofIdx] = uc[i];
      });
    }

    const p = matvec(d.kLokal, uLokal).map((v, i) => v - d.feqLokal[i]);

    const snitt: Snittkraft[] = [];
    for (let i = 0; i < SNITT_PER_ELEMENT; i++) {
      const x = (d.L * i) / (SNITT_PER_ELEMENT - 1);
      const N = -(p[0] + d.qxL * x);
      const V = p[1] + d.qyL * x;
      const M = -p[2] + p[1] * x + (d.qyL * x * x) / 2;
      snitt.push({ x, N, V, M });
    }

    return {
      andkrafter: p,
      snitt,
      Nmax: Math.max(...snitt.map((s) => s.N)),
      Nmin: Math.min(...snitt.map((s) => s.N)),
      Vmax: Math.max(...snitt.map((s) => Math.abs(s.V))),
      Mmax: Math.max(...snitt.map((s) => s.M)),
      Mmin: Math.min(...snitt.map((s) => s.M)),
      langd: d.L,
    };
  });

  // Reaktioner: R = K·U − F för låsta frihetsgrader
  const reaktioner = Array.from({ length: nNoder }, () => ({ fx: 0, fy: 0, mz: 0 }));
  for (const u of modell.upplag) {
    const komponenter: [keyof (typeof reaktioner)[0], number, boolean][] = [
      ['fx', u.nod * 3, u.ux],
      ['fy', u.nod * 3 + 1, u.uy],
      ['mz', u.nod * 3 + 2, u.rz],
    ];
    for (const [namn, dof, aktiv] of komponenter) {
      if (!aktiv) continue;
      let s = -F[dof];
      for (let j = 0; j < nDof; j++) s += K[dof][j] * U[j];
      reaktioner[u.nod][namn] = s;
    }
  }

  return {
    forskjutningar: Array.from({ length: nNoder }, (_, i) => ({
      ux: U[i * 3],
      uy: U[i * 3 + 1],
      rz: U[i * 3 + 2],
    })),
    element: elementResultat,
    reaktioner,
  };
}

function transponera(a: number[][]): number[][] {
  return a[0].map((_, j) => a.map((rad) => rad[j]));
}
