import { describe, it, expect } from 'vitest';
import {
  analysera,
  autodimensionera,
  standardSektioner,
  STANDARDINDATA,
  type Indata,
} from './analys';
import {
  byggGeometri,
  MODELLER,
  STANDARDPARAMETRAR,
  stangLangd,
  type Konstruktionsmodell,
  type StangTyp,
} from './geometri';
import { berakSnolast, formfaktorMu1, gammaD, genereraKombinationer, NYTTIGLASTER, snoPsi } from './loads';
import { dimensioneringsvarden, knackning } from './ec5';
import { hittaKvalitet, kmod, STANDARDDIMENSIONER } from './materials';

function indataFor(modell: Konstruktionsmodell, extra: Partial<Indata> = {}): Indata {
  return {
    ...STANDARDINDATA,
    geometri: { ...STANDARDPARAMETRAR, modell },
    sektioner: standardSektioner(),
    ...extra,
  };
}

describe('Snölast enligt SS-EN 1991-1-3', () => {
  it('ger formfaktor 0,8 upp till 30° och noll vid 60°', () => {
    expect(formfaktorMu1(0)).toBe(0.8);
    expect(formfaktorMu1(27)).toBe(0.8);
    expect(formfaktorMu1(30)).toBe(0.8);
    expect(formfaktorMu1(45)).toBeCloseTo(0.4, 10);
    expect(formfaktorMu1(60)).toBe(0);
    expect(formfaktorMu1(75)).toBe(0);
  });

  it('ger s = mu1 · Ce · Ct · sk', () => {
    const r = berakSnolast(2.0, 27, 27, 'normal', 1.0);
    expect(r.s).toBeCloseTo(0.8 * 1.0 * 1.0 * 2.0, 10);
    expect(r.Ce).toBe(1.0);
  });

  it('halverar snölasten på ett takfall i de osymmetriska lastfallen', () => {
    const r = berakSnolast(3.0, 27, 27, 'normal', 1.0);
    expect(r.lastfall[1].vanster).toBeCloseTo(0.5 * r.lastfall[0].vanster, 10);
    expect(r.lastfall[1].hoger).toBeCloseTo(r.lastfall[0].hoger, 10);
    expect(r.lastfall[2].hoger).toBeCloseTo(0.5 * r.lastfall[0].hoger, 10);
  });

  it('hänför snölast till lastvaraktighetsklass efter snözon', () => {
    expect(berakSnolast(2.0, 27, 27, 'normal').varaktighet).toBe('medellang');
    expect(berakSnolast(3.5, 27, 27, 'normal').varaktighet).toBe('lang');
  });

  it('använder Ce = 0,8 för vindutsatt och 1,2 för skyddat läge', () => {
    expect(berakSnolast(2.0, 27, 27, 'vindutsatt').Ce).toBe(0.8);
    expect(berakSnolast(2.0, 27, 27, 'skyddad').Ce).toBe(1.2);
  });
});

describe('Lastkombinationer', () => {
  it('ger gamma_d enligt säkerhetsklass', () => {
    expect(gammaD(1)).toBe(0.83);
    expect(gammaD(2)).toBe(0.91);
    expect(gammaD(3)).toBe(1.0);
  });

  it('ger psi-faktorer som ökar med snözonen', () => {
    expect(snoPsi(1.5).psi0).toBe(0.6);
    expect(snoPsi(2.5).psi0).toBe(0.7);
    expect(snoPsi(3.5).psi0).toBe(0.8);
  });

  it('bygger 6.10a med 1,35·gamma_d på egentyngden', () => {
    const k = genereraKombinationer({
      sakerhetsklass: 3,
      sk: 2.0,
      nyttiglast: NYTTIGLASTER[0],
      antalSnolastfall: 3,
      medVind: false,
    });
    const a = k.find((x) => x.id === 'BG-6.10a')!;
    expect(a.faktorer.egentyngd).toBeCloseTo(1.35, 10);
    expect(a.faktorer.sno).toBe(0);
  });

  it('bygger 6.10b med 1,2·G och 1,5·S för varje snölastfall', () => {
    const k = genereraKombinationer({
      sakerhetsklass: 2,
      sk: 2.0,
      nyttiglast: NYTTIGLASTER[0],
      antalSnolastfall: 3,
      medVind: false,
    });
    const b = k.filter((x) => x.huvudlast === 'sno');
    expect(b).toHaveLength(3);
    expect(b[0].faktorer.egentyngd).toBeCloseTo(0.91 * 1.2, 10);
    expect(b[0].faktorer.sno).toBeCloseTo(0.91 * 1.5, 10);
  });
});

describe('Materialdata och Eurokod 5', () => {
  it('ger kmod 0,8 för medellång last i klimatklass 2', () => {
    expect(kmod(2, 'medellang')).toBe(0.8);
    expect(kmod(3, 'medellang')).toBe(0.65);
  });

  it('räknar fram fm,d för C24 med kmod och gamma_M', () => {
    const c24 = hittaKvalitet('C24');
    const dv = dimensioneringsvarden(c24, { b: 45, h: 195 }, 2, 'medellang');
    // fm,d = kmod · kh · fm,k / gammaM = 0,8 · 1,0 · 24 / 1,3
    expect(dv.fmd).toBeCloseTo((0.8 * 24) / 1.3, 6);
    expect(dv.kh).toBe(1.0);
  });

  it('tillämpar höjdfaktorn kh för klena tvärsnitt', () => {
    const c24 = hittaKvalitet('C24');
    const dv = dimensioneringsvarden(c24, { b: 45, h: 95 }, 2, 'medellang');
    expect(dv.kh).toBeCloseTo(Math.min((150 / 95) ** 0.2, 1.3), 6);
    expect(dv.kh).toBeGreaterThan(1);
  });

  it('ger kc = 1 för korta stänger och sjunkande kc vid ökande slankhet', () => {
    const c24 = hittaKvalitet('C24');
    const kort = knackning(c24, { b: 45, h: 145 }, 0.2, 0.2);
    expect(kort.kcY).toBe(1);
    const lang = knackning(c24, { b: 45, h: 145 }, 3.0, 3.0);
    expect(lang.kcZ).toBeLessThan(0.3);
    expect(lang.kcY).toBeGreaterThan(lang.kcZ);
  });
});

describe('Geometrigeneratorer', () => {
  for (const m of MODELLER) {
    it(`bygger ${m.namn} med sammanhängande stänger`, () => {
      const g = byggGeometri({ ...STANDARDPARAMETRAR, modell: m.id });
      expect(g.noder.length).toBeGreaterThan(2);
      expect(g.stanger.length).toBeGreaterThan(2);
      for (const s of g.stanger) {
        expect(stangLangd(g, s)).toBeGreaterThan(0.05);
        expect(g.noder[s.n1]).toBeDefined();
        expect(g.noder[s.n2]).toBeDefined();
      }
      // Alla noder ska vara anslutna till minst en stång
      const anslutna = new Set<number>();
      for (const s of g.stanger) {
        anslutna.add(s.n1);
        anslutna.add(s.n2);
      }
      expect(anslutna.size).toBe(g.noder.length);
    });
  }

  it('ger nockhöjd enligt taklutningen', () => {
    const g = byggGeometri({ ...STANDARDPARAMETRAR, modell: 'fackverk', spannvidd: 10, taklutning: 27, taklutningHoger: 27 });
    expect(g.nockhojd).toBeCloseTo(5 * Math.tan((27 * Math.PI) / 180), 6);
  });

  it('lägger till taksprång utanför upplagen', () => {
    const utan = byggGeometri({ ...STANDARDPARAMETRAR, modell: 'fackverk', taksprang: 0 });
    const med = byggGeometri({ ...STANDARDPARAMETRAR, modell: 'fackverk', taksprang: 0.5 });
    expect(med.noder.length).toBe(utan.noder.length + 2);
    expect(med.stanger.filter((s) => s.typ === 'taksprang')).toHaveLength(2);
  });
});

describe('Analys av takstol', () => {
  it('ger jämvikt mellan upplagsreaktioner och total last', () => {
    const indata = indataFor('fackverk');
    const res = analysera(indata);
    const L = res.geometri.spannvidd;
    const utsprang = 2 * indata.geometri.taksprang;
    const alfa = (indata.geometri.taklutning * Math.PI) / 180;
    // Karakteristisk last: egentyngd tak + snö, projicerad på horisontalplanet
    const gTakHoriz = res.laster.gTak / Math.cos(alfa);
    const kar = (gTakHoriz + res.laster.sno.s) * indata.cc * (L + utsprang)
      + res.laster.gInnertak * indata.cc * L
      + res.laster.egentyngdVirke;
    const summaReaktioner = res.upplag.reduce((s, u) => s + u.Rvert, 0);
    // Reaktionerna innehåller partialkoefficienter, så jämför storleksordning
    expect(summaReaktioner).toBeGreaterThan(kar);
    expect(summaReaktioner).toBeLessThan(kar * 1.8);
  });

  it('ger drag i underramen och tryck i överramen för en fackverkstakstol', () => {
    const res = analysera(indataFor('fackverk'));
    const underram = res.stanger.filter((s) => s.typ === 'underram');
    const overram = res.stanger.filter((s) => s.typ === 'overram');
    expect(Math.max(...underram.map((s) => s.Nmax))).toBeGreaterThan(0);
    expect(Math.min(...overram.map((s) => s.Nmin))).toBeLessThan(0);
  });

  it('ökar utnyttjandegraden när snözonen ökar', () => {
    const lag = analysera(indataFor('fackverk', { sk: 1.0 }));
    const hog = analysera(indataFor('fackverk', { sk: 4.5 }));
    expect(hog.maxUtnyttjande).toBeGreaterThan(lag.maxUtnyttjande);
  });

  it('ger lägre utnyttjande med bättre virkeskvalitet', () => {
    const c14 = indataFor('fackverk');
    for (const t of Object.keys(c14.sektioner) as (keyof typeof c14.sektioner)[]) {
      c14.sektioner[t] = { ...c14.sektioner[t], kvalitet: 'C14' };
    }
    const c30 = indataFor('fackverk');
    for (const t of Object.keys(c30.sektioner) as (keyof typeof c30.sektioner)[]) {
      c30.sektioner[t] = { ...c30.sektioner[t], kvalitet: 'C30' };
    }
    expect(analysera(c30).maxUtnyttjande).toBeLessThan(analysera(c14).maxUtnyttjande);
  });

  it('ger högre utnyttjande i säkerhetsklass 3 än i säkerhetsklass 1', () => {
    const sk1 = analysera(indataFor('fackverk', { sakerhetsklass: 1 }));
    const sk3 = analysera(indataFor('fackverk', { sakerhetsklass: 3 }));
    expect(sk3.maxUtnyttjande).toBeGreaterThan(sk1.maxUtnyttjande);
    // Förhållandet ska följa gamma_d
    expect(sk3.maxUtnyttjande / sk1.maxUtnyttjande).toBeCloseTo(1.0 / 0.83, 1);
  });

  it('kan analysera samtliga konstruktionsmodeller utan fel', () => {
    for (const m of MODELLER) {
      const res = analysera(indataFor(m.id));
      expect(res.stanger.length).toBe(res.geometri.stanger.length);
      expect(Number.isFinite(res.maxUtnyttjande)).toBe(true);
      expect(res.maxUtnyttjande).toBeGreaterThan(0);
      expect(res.nedbojning.wfin).toBeGreaterThanOrEqual(res.nedbojning.winstG);
    }
  });

  it('hanterar vindlast och rapporterar lyftkraft', () => {
    const res = analysera(
      indataFor('fackverk', { medVind: true, vb: 26, terrang: 1, taktackningTyngd: 0.1 }),
    );
    expect(res.laster.vind).toBeDefined();
    expect(res.laster.vind!.qp).toBeGreaterThan(0.4);
    expect(res.upplag.every((u) => Number.isFinite(u.Rlyft))).toBe(true);
  });

  it('ger större nedböjning vid längre spännvidd', () => {
    const kort = analysera(indataFor('fackverk', { geometri: { ...STANDARDPARAMETRAR, spannvidd: 6 } }));
    const lang = analysera(indataFor('fackverk', { geometri: { ...STANDARDPARAMETRAR, spannvidd: 12 } }));
    expect(lang.nedbojning.winstQ).toBeGreaterThan(kort.nedbojning.winstQ);
  });
});

describe('Automatisk dimensionering', () => {
  it('hittar en dimension som klarar kraven', () => {
    const indata = indataFor('fackverk', { sk: 2.5 });
    const dimensioner = {
      overram: STANDARDDIMENSIONER.filter((d) => d.b >= 45),
      underram: STANDARDDIMENSIONER.filter((d) => d.b >= 45),
      diagonal: STANDARDDIMENSIONER.filter((d) => d.b >= 45),
      stolpe: STANDARDDIMENSIONER.filter((d) => d.b >= 45),
      hanbjalke: STANDARDDIMENSIONER.filter((d) => d.b >= 45),
      stodben: STANDARDDIMENSIONER.filter((d) => d.b >= 45),
      taksprang: STANDARDDIMENSIONER.filter((d) => d.b >= 45),
    };
    const auto = autodimensionera(indata, dimensioner);
    expect(auto.lyckades).toBe(true);
    // Upplagstrycket styrs av upplagslängden och ingår inte i sökningen
    expect(auto.resultat.maxUtnyttjandeBarverk).toBeLessThanOrEqual(1.0);
  });

  it('anger erforderlig upplagslängd när trycket vinkelrätt fibrerna överskrids', () => {
    const res = analysera(indataFor('fackverk', { sk: 3.0, upplagslangd: 45 }));
    const upplag = res.upplag[0];
    expect(upplag.kontroll.utnyttjande).toBeGreaterThan(1);
    expect(upplag.erforderligUpplagslangd).toBeGreaterThan(45);
    expect(res.varningar.some((v) => v.includes('Upplagslängden'))).toBe(true);
  });

  it('hittar dimensioner för samtliga konstruktionsmodeller', () => {
    const dimensioner = Object.fromEntries(
      (
        ['overram', 'underram', 'diagonal', 'stolpe', 'hanbjalke', 'stodben', 'taksprang'] as const
      ).map((t) => [t, STANDARDDIMENSIONER.filter((d) => d.b >= 45)]),
    ) as Record<StangTyp, typeof STANDARDDIMENSIONER>;

    for (const m of MODELLER) {
      const auto = autodimensionera(indataFor(m.id), dimensioner);
      expect(auto.lyckades, `${m.namn} gick inte att dimensionera`).toBe(true);
      expect(auto.resultat.maxUtnyttjandeBarverk).toBeLessThanOrEqual(1.0);
      // Ingen stång ska kräva orimligt grovt virke för ett vanligt fall
      expect(auto.sektioner.overram.dim.h).toBeLessThanOrEqual(245);
    }
  });

  it('kräver grövre virke vid högre snölast', () => {
    const dimensioner = {
      overram: STANDARDDIMENSIONER.filter((d) => d.b >= 45),
      underram: STANDARDDIMENSIONER.filter((d) => d.b >= 45),
      diagonal: STANDARDDIMENSIONER.filter((d) => d.b >= 45),
      stolpe: STANDARDDIMENSIONER.filter((d) => d.b >= 45),
      hanbjalke: STANDARDDIMENSIONER.filter((d) => d.b >= 45),
      stodben: STANDARDDIMENSIONER.filter((d) => d.b >= 45),
      taksprang: STANDARDDIMENSIONER.filter((d) => d.b >= 45),
    };
    const lag = autodimensionera(indataFor('fackverk', { sk: 1.0 }), dimensioner);
    const hog = autodimensionera(indataFor('fackverk', { sk: 5.5 }), dimensioner);
    expect(hog.sektioner.overram.dim.h).toBeGreaterThanOrEqual(lag.sektioner.overram.dim.h);
  });
});
