import { describe, it, expect } from 'vitest';
import { beraknaInnermatt, STAHOJD, type HojdUppslag } from './innermatt';
import { byggGeometri, MODELLER, STANDARDPARAMETRAR, type GeometriParametrar } from './geometri';

/** Tvärsnittshöjder i meter, motsvarar 45×170 respektive 45×145 mm. */
const hojd: HojdUppslag = (typ) => {
  switch (typ) {
    case 'overram':
    case 'taksprang':
    case 'hanbjalke':
      return 0.17;
    case 'underram':
    case 'stodben':
      return 0.145;
    default:
      return 0.12;
  }
};

function mattFor(p: Partial<GeometriParametrar>) {
  const parametrar = { ...STANDARDPARAMETRAR, ...p };
  return beraknaInnermatt(byggGeometri(parametrar), parametrar, hojd);
}

describe('Invändiga mått', () => {
  it('ger mått för samtliga konstruktionsmodeller', () => {
    for (const m of MODELLER) {
      const matt = mattFor({ modell: m.id });
      expect(matt.length, `${m.namn} saknar invändiga mått`).toBeGreaterThan(0);
      for (const x of matt) {
        expect(Number.isFinite(x.varde)).toBe(true);
        expect(x.varde).toBeGreaterThan(0);
      }
    }
  });

  it('ger fri höjd i nock som är lägre än nockhöjden', () => {
    const p = { ...STANDARDPARAMETRAR, modell: 'fackverk' as const };
    const geo = byggGeometri(p);
    const nock = mattFor({ modell: 'fackverk' }).find((m) => m.id === 'nockhojd')!;
    // Halva underramen dras bort nedtill och sparrens undersida upptill
    const forvantat = geo.nockhojd - 0.17 / 2 / Math.cos((27 * Math.PI) / 180) - 0.145 / 2;
    expect(nock.varde).toBeCloseTo(forvantat, 6);
    expect(nock.varde).toBeLessThan(geo.nockhojd);
  });

  it('drar bort stödbenens tvärsnitt från rumsbredden', () => {
    const p = { ...STANDARDPARAMETRAR, modell: 'samverkan' as const, taklutning: 40, taklutningHoger: 40 };
    const geo = byggGeometri(p);
    const matt = beraknaInnermatt(geo, p, hojd);
    const bredd = matt.find((m) => m.id === 'rumsbredd')!;

    const stodben = geo.stanger.find((s) => s.typ === 'stodben')!;
    const centrumavstand = geo.spannvidd - 2 * geo.noder[stodben.n1].x;
    // Fritt mått = centrumavstånd minus ett helt stödbenstvärsnitt
    expect(bredd.varde).toBeCloseTo(centrumavstand - 0.145, 6);
    expect(bredd.varde).toBeLessThan(centrumavstand);
  });

  it('ger rumshöjd mätt från underramens ovansida till hanbjälkens undersida', () => {
    const p = {
      ...STANDARDPARAMETRAR,
      modell: 'samverkan' as const,
      taklutning: 40,
      taklutningHoger: 40,
      hanbjalkeHojd: 2.4,
    };
    const geo = byggGeometri(p);
    const matt = beraknaInnermatt(geo, p, hojd);
    const hojdMatt = matt.find((m) => m.id === 'rumshojd')!;

    const hanbjalke = geo.stanger.find((s) => s.typ === 'hanbjalke')!;
    const hanbjalkeY = geo.noder[hanbjalke.n1].y;
    expect(hojdMatt.varde).toBeCloseTo(hanbjalkeY - 0.17 / 2 - 0.145 / 2, 6);
  });

  it('ger smalare fri bredd högre upp i takstolen', () => {
    const matt = mattFor({ modell: 'ramverk' });
    const golv = matt.find((m) => m.id === 'bredd_golv')!;
    const tak = matt.find((m) => m.id === 'bredd_hanbjalke')!;
    expect(tak.varde).toBeLessThan(golv.varde);
  });

  it('ger bredare rum vid brantare taklutning', () => {
    const flack = mattFor({ modell: 'samverkan', taklutning: 30, taklutningHoger: 30 });
    const brant = mattFor({ modell: 'samverkan', taklutning: 45, taklutningHoger: 45 });
    const bredd = (m: ReturnType<typeof mattFor>) => m.find((x) => x.id === 'rumsbredd')!.varde;
    expect(bredd(brant)).toBeGreaterThan(bredd(flack));
  });

  it('utelämnar ståhöjdsbredden när nocken är för låg', () => {
    const lag = mattFor({ modell: 'fackverk', spannvidd: 6, taklutning: 14, taklutningHoger: 14 });
    const hog = mattFor({ modell: 'fackverk', spannvidd: 12, taklutning: 35, taklutningHoger: 35 });
    // 6 m spännvidd och 14° ger nockhöjd 0,75 m, alltså ingen ståhöjd
    expect(lag.find((m) => m.id === 'stahojdsbredd')).toBeUndefined();
    expect(hog.find((m) => m.id === 'stahojdsbredd')).toBeDefined();
  });

  it('placerar ståhöjdsbredden på rätt höjd över golvet', () => {
    const matt = mattFor({ modell: 'fackverk', spannvidd: 12, taklutning: 35, taklutningHoger: 35 });
    const bredd = matt.find((m) => m.id === 'stahojdsbredd')!;
    expect(bredd.fran.y).toBeCloseTo(0.145 / 2 + STAHOJD, 6);
    expect(bredd.fran.y).toBe(bredd.till.y);
  });

  it('ger fritt utrymme mellan ramarna i en parallelltakstol', () => {
    const matt = mattFor({ modell: 'parallell', parallellHojd: 0.6 });
    const fritt = matt.find((m) => m.id === 'konstruktionshojd')!;
    const forvantat = 0.6 * Math.cos((27 * Math.PI) / 180) - 0.17 / 2 - 0.145 / 2;
    expect(fritt.varde).toBeCloseTo(forvantat, 6);
  });

  it('ger mått med start- och slutpunkt som stämmer med värdet', () => {
    for (const m of MODELLER) {
      for (const x of mattFor({ modell: m.id })) {
        const langd =
          x.orientering === 'vertikal' ? x.till.y - x.fran.y : x.till.x - x.fran.x;
        if (x.id === 'konstruktionshojd') continue; // mäts vinkelrätt mot ramarna
        expect(langd, `${m.id}/${x.id}`).toBeCloseTo(x.varde, 6);
      }
    }
  });
});
