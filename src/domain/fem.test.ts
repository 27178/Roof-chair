import { describe, it, expect } from 'vitest';
import { losFem, type FemModell } from './fem';

/** E = 11 GPa, tvärsnitt 45×195 mm — typiskt takstolsvirke. */
const E = 11_000_000; // kN/m²
const b = 0.045;
const h = 0.195;
const A = b * h;
const I = (b * h ** 3) / 12;
const EA = E * A;
const EI = E * I;

describe('FEM: fritt upplagd balk med jämnt utbredd last', () => {
  const L = 5;
  const w = 3; // kN/m nedåt

  const modell: FemModell = {
    noder: [
      { x: 0, y: 0 },
      { x: L, y: 0 },
    ],
    element: [{ n1: 0, n2: 1, EA, EI, ledStart: true, ledSlut: true, qy: -w }],
    upplag: [
      { nod: 0, ux: true, uy: true, rz: false },
      { nod: 1, ux: false, uy: true, rz: false },
    ],
    nodlaster: [],
  };

  const res = losFem(modell);

  it('ger maxmoment wL²/8 i fältmitt', () => {
    const Mmax = res.element[0].Mmax;
    expect(Mmax).toBeCloseTo((w * L ** 2) / 8, 6);
  });

  it('ger noll moment vid upplagen', () => {
    const snitt = res.element[0].snitt;
    expect(snitt[0].M).toBeCloseTo(0, 8);
    expect(snitt[snitt.length - 1].M).toBeCloseTo(0, 8);
  });

  it('ger tvärkraft wL/2 vid upplagen', () => {
    expect(res.element[0].snitt[0].V).toBeCloseTo((w * L) / 2, 6);
  });

  it('ger nedböjning 5wL⁴/(384EI) i fältmitt', () => {
    // Fältmitt saknar nod, kontrollera via reaktioner och analytisk lösning
    // genom att i stället lösa modellen med en nod i mitten.
    const modell2: FemModell = {
      noder: [
        { x: 0, y: 0 },
        { x: L / 2, y: 0 },
        { x: L, y: 0 },
      ],
      element: [
        { n1: 0, n2: 1, EA, EI, ledStart: true, qy: -w },
        { n1: 1, n2: 2, EA, EI, ledSlut: true, qy: -w },
      ],
      upplag: [
        { nod: 0, ux: true, uy: true, rz: false },
        { nod: 2, ux: false, uy: true, rz: false },
      ],
      nodlaster: [],
    };
    const r2 = losFem(modell2);
    const analytisk = (5 * w * L ** 4) / (384 * EI);
    expect(Math.abs(r2.forskjutningar[1].uy)).toBeCloseTo(analytisk, 6);
  });

  it('ger vertikala reaktioner wL/2', () => {
    expect(res.reaktioner[0].fy).toBeCloseTo((w * L) / 2, 6);
    expect(res.reaktioner[1].fy).toBeCloseTo((w * L) / 2, 6);
  });
});

describe('FEM: inspänd balk', () => {
  const L = 4;
  const w = 2;

  it('ger inspänningsmoment wL²/12 och fältmoment wL²/24', () => {
    const modell: FemModell = {
      noder: [
        { x: 0, y: 0 },
        { x: L / 2, y: 0 },
        { x: L, y: 0 },
      ],
      element: [
        { n1: 0, n2: 1, EA, EI, qy: -w },
        { n1: 1, n2: 2, EA, EI, qy: -w },
      ],
      upplag: [
        { nod: 0, ux: true, uy: true, rz: true },
        { nod: 2, ux: true, uy: true, rz: true },
      ],
      nodlaster: [],
    };
    const res = losFem(modell);
    expect(res.element[0].snitt[0].M).toBeCloseTo(-(w * L ** 2) / 12, 6);
    const Mmitt = res.element[0].snitt[res.element[0].snitt.length - 1].M;
    expect(Mmitt).toBeCloseTo((w * L ** 2) / 24, 6);
  });
});

describe('FEM: konsolbalk med punktlast', () => {
  it('ger nedböjning PL³/(3EI) och inspänningsmoment PL', () => {
    const L = 2.5;
    const P = 4;
    const modell: FemModell = {
      noder: [
        { x: 0, y: 0 },
        { x: L, y: 0 },
      ],
      element: [{ n1: 0, n2: 1, EA, EI }],
      upplag: [{ nod: 0, ux: true, uy: true, rz: true }],
      nodlaster: [{ nod: 1, fy: -P }],
    };
    const res = losFem(modell);
    expect(Math.abs(res.forskjutningar[1].uy)).toBeCloseTo((P * L ** 3) / (3 * EI), 8);
    expect(res.element[0].snitt[0].M).toBeCloseTo(-P * L, 6);
    expect(res.reaktioner[0].mz).toBeCloseTo(P * L, 6);
  });
});

describe('FEM: enkelt fackverk', () => {
  it('ger korrekta stångkrafter i en symmetrisk trekant', () => {
    // Trekant med spännvidd 6 m, höjd 2 m, punktlast 10 kN i nocken.
    const P = 10;
    const modell: FemModell = {
      noder: [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 3, y: 2 },
      ],
      element: [
        { n1: 0, n2: 2, EA, EI: EI * 1e-6, ledStart: true, ledSlut: true },
        { n1: 2, n2: 1, EA, EI: EI * 1e-6, ledStart: true, ledSlut: true },
        { n1: 0, n2: 1, EA, EI: EI * 1e-6, ledStart: true, ledSlut: true },
      ],
      upplag: [
        { nod: 0, ux: true, uy: true, rz: false },
        { nod: 1, ux: false, uy: true, rz: false },
      ],
      nodlaster: [{ nod: 2, fy: -P }],
    };
    const res = losFem(modell);

    // Takfall: längd = sqrt(3² + 2²) = 3,6056, vertikalkomposant 2/3,6056
    const langd = Math.hypot(3, 2);
    const forvantatTakfall = -((P / 2) * (langd / 2)); // tryck
    expect(res.element[0].Nmin).toBeCloseTo(forvantatTakfall, 4);

    // Underram: drag = H = (P/2)·(3/2)
    const forvantatUnderram = (P / 2) * (3 / 2);
    expect(res.element[2].Nmax).toBeCloseTo(forvantatUnderram, 4);
  });
});

describe('FEM: jämviktskontroll', () => {
  it('summan av reaktioner motsvarar pålagd last', () => {
    const w = 2.5;
    const L = 8;
    const modell: FemModell = {
      noder: [
        { x: 0, y: 0 },
        { x: 4, y: 1.5 },
        { x: 8, y: 0 },
      ],
      element: [
        { n1: 0, n2: 1, EA, EI, qy: -w },
        { n1: 1, n2: 2, EA, EI, qy: -w },
      ],
      upplag: [
        { nod: 0, ux: true, uy: true, rz: false },
        { nod: 2, ux: false, uy: true, rz: false },
      ],
      nodlaster: [],
    };
    const res = losFem(modell);
    const langd = 2 * Math.hypot(4, 1.5);
    const summa = res.reaktioner[0].fy + res.reaktioner[2].fy;
    expect(summa).toBeCloseTo(w * langd, 6);
  });
});
