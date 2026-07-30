import { useEffect, useMemo, useState } from 'react';
import {
  analysera,
  autodimensionera,
  standardSektioner,
  STANDARDINDATA,
  VALBARA_STANGTYPER,
  type Analysresultat,
  type Indata,
} from './domain/analys';
import { byggGeometri, modellInfo, STANDARDPARAMETRAR, type StangTyp } from './domain/geometri';
import { dimensionerFor, hittaKvalitet } from './domain/materials';
import { Indatapanel } from './components/Indatapanel';
import { Lastpanel } from './components/Lastpanel';
import { Matrispanel } from './components/Matrispanel';
import { Rapport } from './components/Rapport';
import { Resultatpanel } from './components/Resultatpanel';
import { Takstolsskiss, VISNINGSLAGEN, type Visningslage } from './components/Takstolsskiss';
import { STATUSFARG, STATUSIKON, STATUSTEXT, statusband, tal } from './ui/format';

const LAGRINGSNYCKEL = 'takstolsberakning.indata.v1';

function standardIndata(): Indata {
  return {
    ...STANDARDINDATA,
    geometri: { ...STANDARDPARAMETRAR },
    sektioner: standardSektioner(),
  };
}

function laddaIndata(): Indata {
  try {
    const sparad = localStorage.getItem(LAGRINGSNYCKEL);
    if (!sparad) return standardIndata();
    const parsad = JSON.parse(sparad) as Indata;
    // Slå ihop med standardvärden så att nya fält får värden
    return {
      ...standardIndata(),
      ...parsad,
      geometri: { ...STANDARDPARAMETRAR, ...parsad.geometri },
      sektioner: { ...standardSektioner(), ...parsad.sektioner },
    };
  } catch {
    return standardIndata();
  }
}

type Flik = 'skiss' | 'resultat' | 'laster' | 'matris' | 'rapport';

const FLIKAR: { id: Flik; namn: string }[] = [
  { id: 'skiss', namn: 'Skiss' },
  { id: 'resultat', namn: 'Resultat' },
  { id: 'laster', namn: 'Laster' },
  { id: 'matris', namn: 'Kombinationer' },
  { id: 'rapport', namn: 'Beräkningsrapport' },
];

export default function App() {
  const [indata, setIndata] = useState<Indata>(laddaIndata);
  const [flik, setFlik] = useState<Flik>('skiss');
  const [lage, setLage] = useState<Visningslage>('utnyttjande');
  const [visaBeteckningar, setVisaBeteckningar] = useState(true);

  useEffect(() => {
    try {
      localStorage.setItem(LAGRINGSNYCKEL, JSON.stringify(indata));
    } catch {
      // Lagring kan vara blockerad – beräkningen fungerar ändå
    }
  }, [indata]);

  const { resultat, fel } = useMemo((): { resultat: Analysresultat | null; fel: string | null } => {
    try {
      return { resultat: analysera(indata), fel: null };
    } catch (e) {
      return { resultat: null, fel: e instanceof Error ? e.message : 'Okänt beräkningsfel' };
    }
  }, [indata]);

  const anvandaStangtyper = useMemo(() => {
    try {
      const geo = byggGeometri(indata.geometri);
      const typer = new Set<StangTyp>(geo.stanger.map((s) => s.typ));
      // Taksprånget följer överramen och väljs inte separat
      return VALBARA_STANGTYPER.filter((t) => typer.has(t));
    } catch {
      return [] as StangTyp[];
    }
  }, [indata.geometri]);

  const kor = (fn: () => void) => {
    try {
      fn();
    } catch {
      // Ignorera – felet visas via analysresultatet
    }
  };

  const autodimensionering = () =>
    kor(() => {
      const dimensioner = {} as Record<StangTyp, ReturnType<typeof dimensionerFor>>;
      for (const t of Object.keys(indata.sektioner) as StangTyp[]) {
        const family = hittaKvalitet(indata.sektioner[t].kvalitet).family;
        dimensioner[t] = dimensionerFor(family).filter((d) => d.b >= 45);
      }
      const auto = autodimensionera(indata, dimensioner);
      setIndata({ ...indata, sektioner: auto.sektioner });
    });

  const band = resultat ? statusband(resultat.maxUtnyttjande) : 'critical';

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Takstolsberäkning</h1>
          <p className="undertitel">
            Dimensionering enligt Eurokod 5 med snölast och svenska konstruktionsregler
          </p>
        </div>
        <div className="topbar-hoger">
          {resultat && (
            <span className={`status status-${band}`}>
              <span aria-hidden="true">{STATUSIKON[band]}</span>
              {STATUSTEXT[band]} · η = {tal(resultat.maxUtnyttjande, 2)}
            </span>
          )}
          <button type="button" className="knapp" onClick={() => window.print()}>
            Skriv ut
          </button>
        </div>
      </header>

      <div className="layout">
        <Indatapanel
          indata={indata}
          anvandaStangtyper={anvandaStangtyper}
          onChange={setIndata}
          onAutodimensionera={autodimensionering}
          onAterstall={() => setIndata(standardIndata())}
        />

        <main>
          {fel && (
            <div className="varning fel">
              <span className="ikon" aria-hidden="true">
                ✕
              </span>
              <span>
                Beräkningen kunde inte genomföras: {fel}. Kontrollera geometrin, till exempel att
                spännvidd, taklutning och höjder är rimliga.
              </span>
            </div>
          )}

          {resultat && (
            <>
              <div className="flikar" role="tablist">
                {FLIKAR.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    aria-selected={flik === f.id}
                    className="flik"
                    onClick={() => setFlik(f.id)}
                  >
                    {f.namn}
                  </button>
                ))}
              </div>

              {flik === 'skiss' && (
                <div className="skiss-holje">
                  <div className="skiss-verktyg">
                    {VISNINGSLAGEN.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        className={`knapp${lage === v.id ? ' knapp-primar' : ''}`}
                        onClick={() => setLage(v.id)}
                      >
                        {v.namn}
                      </button>
                    ))}
                    <label className="checkbox-rad" style={{ marginLeft: 'auto' }}>
                      <input
                        type="checkbox"
                        checked={visaBeteckningar}
                        onChange={(e) => setVisaBeteckningar(e.target.checked)}
                      />
                      Beteckningar
                    </label>
                  </div>

                  <Takstolsskiss
                    resultat={resultat}
                    lage={lage}
                    visaBeteckningar={visaBeteckningar}
                  />

                  <div className="legend">
                    {lage === 'utnyttjande' &&
                      (['good', 'warning', 'serious', 'critical'] as const).map((b) => (
                        <span className="legend-post" key={b}>
                          <span
                            className="legend-prick"
                            style={{ background: STATUSFARG[b] }}
                            aria-hidden="true"
                          />
                          {STATUSTEXT[b]}{' '}
                          {b === 'good'
                            ? '(η ≤ 0,75)'
                            : b === 'warning'
                              ? '(0,75 < η ≤ 0,90)'
                              : b === 'serious'
                                ? '(0,90 < η ≤ 1,00)'
                                : '(η > 1,00)'}
                        </span>
                      ))}
                    {(lage === 'normalkraft' || lage === 'moment' || lage === 'tvarkraft') && (
                      <>
                        <span className="legend-post">
                          <span
                            className="legend-prick"
                            style={{ background: 'var(--div-pos)' }}
                            aria-hidden="true"
                          />
                          {lage === 'normalkraft' ? 'Drag' : 'Positivt värde'}
                        </span>
                        <span className="legend-post">
                          <span
                            className="legend-prick"
                            style={{ background: 'var(--div-neg)' }}
                            aria-hidden="true"
                          />
                          {lage === 'normalkraft' ? 'Tryck' : 'Negativt värde'}
                        </span>
                        <span className="legend-post">
                          Diagrammen visar den avgörande lastkombinationen för varje stång.
                        </span>
                      </>
                    )}
                    {lage === 'deformation' && (
                      <span className="legend-post">
                        Deformationen är kraftigt förstorad. Största nedböjning{' '}
                        {tal(resultat.nedbojning.winstG + resultat.nedbojning.winstQ, 1)} mm i
                        karakteristisk kombination.
                      </span>
                    )}
                    {lage === 'laster' && (
                      <span className="legend-post">
                        Pilarna visar var taklast (egentyngd och snö) angriper. Storleken redovisas
                        under fliken Laster.
                      </span>
                    )}
                    <span className="legend-post" style={{ marginLeft: 'auto' }}>
                      {modellInfo(indata.geometri.modell).namn}
                    </span>
                  </div>
                </div>
              )}

              {flik === 'resultat' && (
                <div className="panel">
                  <Resultatpanel resultat={resultat} />
                </div>
              )}
              {flik === 'laster' && (
                <div className="panel">
                  <Lastpanel resultat={resultat} indata={indata} />
                </div>
              )}
              {flik === 'matris' && (
                <div className="panel">
                  <Matrispanel indata={indata} />
                </div>
              )}
              {flik === 'rapport' && (
                <div className="panel">
                  <Rapport resultat={resultat} indata={indata} />
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
