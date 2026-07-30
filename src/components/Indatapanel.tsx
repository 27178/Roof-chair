import type { Indata, Sektionsval } from '../domain/analys';
import { klimatklassNamn } from '../domain/analys';
import {
  ALLA_KVALITETER,
  dimensionNamn,
  dimensionerFor,
  hittaKvalitet,
  KONSTRUKTIONSVIRKE,
  LIMTRA,
  type Klimatklass,
} from '../domain/materials';
import {
  EXPONERING_TEXT,
  INNERTAK,
  NYTTIGLASTER,
  SAKERHETSKLASS_TEXT,
  SNOZONER,
  TAKTACKNINGAR,
  type Exponering,
  type Sakerhetsklass,
} from '../domain/loads';
import {
  MODELLER,
  rumsbredd,
  STANGTYP_NAMN,
  stodbensAvstand,
  type Konstruktionsmodell,
  type StangTyp,
} from '../domain/geometri';
import { REFERENSVINDHASTIGHETER, TERRANG_TEXT, type Terrangtyp } from '../domain/vind';
import { tal } from '../ui/format';

interface Props {
  indata: Indata;
  anvandaStangtyper: StangTyp[];
  onChange: (indata: Indata) => void;
  onAutodimensionera: () => void;
  onAterstall: () => void;
}

function Falt({
  etikett,
  varde,
  onChange,
  steg = 0.1,
  min,
  max,
  enhet,
}: {
  etikett: string;
  varde: number;
  onChange: (v: number) => void;
  steg?: number;
  min?: number;
  max?: number;
  enhet?: string;
}) {
  return (
    <div className="falt">
      <label htmlFor={`f-${etikett}`}>
        {etikett}
        {enhet ? ` (${enhet})` : ''}
      </label>
      <input
        id={`f-${etikett}`}
        type="number"
        value={Number.isFinite(varde) ? varde : 0}
        step={steg}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
      />
    </div>
  );
}

export function Indatapanel({
  indata,
  anvandaStangtyper,
  onChange,
  onAutodimensionera,
  onAterstall,
}: Props) {
  const uppdatera = (delta: Partial<Indata>) => onChange({ ...indata, ...delta });
  const uppdateraGeometri = (delta: Partial<Indata['geometri']>) =>
    onChange({ ...indata, geometri: { ...indata.geometri, ...delta } });
  const uppdateraSektion = (typ: StangTyp, delta: Partial<Sektionsval>) =>
    onChange({
      ...indata,
      sektioner: { ...indata.sektioner, [typ]: { ...indata.sektioner[typ], ...delta } },
    });

  const modell = indata.geometri.modell;
  const visarHanbjalke = modell === 'ramverk' || modell === 'samverkan';
  const visarStodben = modell === 'samverkan';
  const visarFack = modell === 'fackverk' || modell === 'parallell' || modell === 'pulpet';

  return (
    <div className="panel sidopanel">
      <details className="grupp" open>
        <summary>Konstruktionsmodell</summary>
        <div className="grupp-innehall">
          <div className="falt-bred">
            <label htmlFor="modell">Takstolstyp</label>
            <select
              id="modell"
              value={modell}
              onChange={(e) => uppdateraGeometri({ modell: e.target.value as Konstruktionsmodell })}
            >
              {MODELLER.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.namn}
                </option>
              ))}
            </select>
          </div>
          <p className="hjalptext">{MODELLER.find((m) => m.id === modell)?.beskrivning}</p>
          <p className="hjalptext">
            Vanlig spännvidd:{' '}
            {MODELLER.find((m) => m.id === modell)?.spannviddsintervall.map((v) => `${v} m`).join(' – ')}
          </p>
        </div>
      </details>

      <details className="grupp" open>
        <summary>Geometri</summary>
        <div className="grupp-innehall">
          <Falt
            etikett="Spännvidd"
            enhet="m"
            varde={indata.geometri.spannvidd}
            steg={0.1}
            min={1}
            max={30}
            onChange={(v) => uppdateraGeometri({ spannvidd: v })}
          />
          <Falt
            etikett="Taklutning"
            enhet="°"
            varde={indata.geometri.taklutning}
            steg={1}
            min={1}
            max={70}
            onChange={(v) =>
              uppdateraGeometri({
                taklutning: v,
                taklutningHoger: indata.geometri.taklutning === indata.geometri.taklutningHoger ? v : indata.geometri.taklutningHoger,
              })
            }
          />
          {modell !== 'pulpet' && modell !== 'parallell' && (
            <Falt
              etikett="Taklutning höger"
              enhet="°"
              varde={indata.geometri.taklutningHoger}
              steg={1}
              min={1}
              max={70}
              onChange={(v) => uppdateraGeometri({ taklutningHoger: v })}
            />
          )}
          {modell !== 'parallell' && modell !== 'pulpet' && (
            <Falt
              etikett="Taksprång"
              enhet="m"
              varde={indata.geometri.taksprang}
              steg={0.05}
              min={0}
              max={2}
              onChange={(v) => uppdateraGeometri({ taksprang: v })}
            />
          )}
          {visarFack && (
            <Falt
              etikett="Antal fack per halva"
              varde={indata.geometri.antalFack}
              steg={1}
              min={1}
              max={4}
              onChange={(v) => uppdateraGeometri({ antalFack: Math.round(v) })}
            />
          )}
          {visarHanbjalke && (
            <Falt
              etikett="Hanbjälkens höjd"
              enhet="m"
              varde={indata.geometri.hanbjalkeHojd}
              steg={0.1}
              min={0.5}
              onChange={(v) => uppdateraGeometri({ hanbjalkeHojd: v })}
            />
          )}
          {visarStodben && (
            <>
              <Falt
                etikett="Stödbenets höjd"
                enhet="m"
                varde={indata.geometri.stodbenHojd}
                steg={0.1}
                min={0.5}
                onChange={(v) => uppdateraGeometri({ stodbenHojd: v })}
              />
              <p className="hjalptext">
                Stödbenen är lodräta och möter sparren, så de hamnar{' '}
                {tal(stodbensAvstand(indata.geometri), 2)} m från upplaget. Rummets bredd mellan
                stödbenen blir {tal(rumsbredd(indata.geometri), 2)} m.
                {rumsbredd(indata.geometri) < 1.8
                  ? ' Öka taklutningen eller minska stödbenshöjden för ett bredare rum.'
                  : ''}
              </p>
            </>
          )}
          {modell === 'sax' && (
            <Falt
              etikett="Underramens lutning"
              enhet="°"
              varde={indata.geometri.saxLutning}
              steg={1}
              min={2}
              max={45}
              onChange={(v) => uppdateraGeometri({ saxLutning: v })}
            />
          )}
          {modell === 'parallell' && (
            <Falt
              etikett="Konstruktionshöjd"
              enhet="m"
              varde={indata.geometri.parallellHojd}
              steg={0.05}
              min={0.2}
              onChange={(v) => uppdateraGeometri({ parallellHojd: v })}
            />
          )}
          <Falt
            etikett="Takstolsavstånd c/c"
            enhet="m"
            varde={indata.cc}
            steg={0.05}
            min={0.3}
            max={6}
            onChange={(v) => uppdatera({ cc: v })}
          />
        </div>
      </details>

      <details className="grupp" open>
        <summary>Snölast och klimat</summary>
        <div className="grupp-innehall">
          <div className="falt-bred">
            <label htmlFor="snozon">Snözon (sk på mark)</label>
            <select
              id="snozon"
              value={indata.sk}
              onChange={(e) => uppdatera({ sk: Number(e.target.value) })}
            >
              {SNOZONER.map((z) => (
                <option key={z.sk} value={z.sk}>
                  {z.etikett} kN/m² – {z.exempel}
                </option>
              ))}
            </select>
          </div>
          <p className="hjalptext">
            Bindande värde läses ur lastkartan i Boverkets konstruktionsregler. Nära en zongräns
            väljs det högre värdet.
          </p>
          <div className="falt-bred">
            <label htmlFor="exponering">Exponering (Ce)</label>
            <select
              id="exponering"
              value={indata.exponering}
              onChange={(e) => uppdatera({ exponering: e.target.value as Exponering })}
            >
              {(Object.keys(EXPONERING_TEXT) as Exponering[]).map((e) => (
                <option key={e} value={e}>
                  {EXPONERING_TEXT[e]}
                </option>
              ))}
            </select>
          </div>
          <div className="falt-bred">
            <label htmlFor="klimatklass">Klimatklass</label>
            <select
              id="klimatklass"
              value={indata.klimatklass}
              onChange={(e) => uppdatera({ klimatklass: Number(e.target.value) as Klimatklass })}
            >
              {[1, 2, 3].map((k) => (
                <option key={k} value={k}>
                  {klimatklassNamn(k as Klimatklass)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </details>

      <details className="grupp" open>
        <summary>Egentyngd och nyttig last</summary>
        <div className="grupp-innehall">
          <div className="falt-bred">
            <label htmlFor="taktackning">Taktäckning</label>
            <select
              id="taktackning"
              value={
                TAKTACKNINGAR.find((t) => t.tyngd === indata.taktackningTyngd)?.id ?? 'egen'
              }
              onChange={(e) => {
                const t = TAKTACKNINGAR.find((x) => x.id === e.target.value);
                if (t) uppdatera({ taktackningTyngd: t.tyngd });
              }}
            >
              {TAKTACKNINGAR.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.namn} – {tal(t.tyngd, 2)} kN/m²
                </option>
              ))}
            </select>
          </div>
          <Falt
            etikett="Taktäckning"
            enhet="kN/m² taklutande"
            varde={indata.taktackningTyngd}
            steg={0.05}
            min={0}
            onChange={(v) => uppdatera({ taktackningTyngd: v })}
          />
          <div className="falt-bred">
            <label htmlFor="innertak">Innertak och isolering</label>
            <select
              id="innertak"
              value={INNERTAK.find((t) => t.tyngd === indata.innertakTyngd)?.id ?? 'egen'}
              onChange={(e) => {
                const t = INNERTAK.find((x) => x.id === e.target.value);
                if (t) uppdatera({ innertakTyngd: t.tyngd });
              }}
            >
              {INNERTAK.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.namn} – {tal(t.tyngd, 2)} kN/m²
                </option>
              ))}
            </select>
          </div>
          <Falt
            etikett="Innertak"
            enhet="kN/m² horisontellt"
            varde={indata.innertakTyngd}
            steg={0.05}
            min={0}
            onChange={(v) => uppdatera({ innertakTyngd: v })}
          />
          <div className="falt-bred">
            <label htmlFor="nyttig">Nyttig last på bjälklaget</label>
            <select
              id="nyttig"
              value={indata.nyttiglastId}
              onChange={(e) => uppdatera({ nyttiglastId: e.target.value })}
            >
              {NYTTIGLASTER.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.namn} – {tal(n.qk, 1)} kN/m²
                </option>
              ))}
            </select>
          </div>
        </div>
      </details>

      <details className="grupp">
        <summary>Vindlast (förenklad)</summary>
        <div className="grupp-innehall">
          <label className="checkbox-rad">
            <input
              type="checkbox"
              checked={indata.medVind}
              onChange={(e) => uppdatera({ medVind: e.target.checked })}
            />
            Ta med vindlast och kontrollera lyftning
          </label>
          {indata.medVind && (
            <>
              <div className="falt-bred">
                <label htmlFor="vb">Referensvindhastighet vb</label>
                <select id="vb" value={indata.vb} onChange={(e) => uppdatera({ vb: Number(e.target.value) })}>
                  {REFERENSVINDHASTIGHETER.map((v) => (
                    <option key={v} value={v}>
                      {v} m/s
                    </option>
                  ))}
                </select>
              </div>
              <div className="falt-bred">
                <label htmlFor="terrang">Terrängtyp</label>
                <select
                  id="terrang"
                  value={indata.terrang}
                  onChange={(e) => uppdatera({ terrang: Number(e.target.value) as Terrangtyp })}
                >
                  {([0, 1, 2, 3, 4] as Terrangtyp[]).map((t) => (
                    <option key={t} value={t}>
                      {TERRANG_TEXT[t]}
                    </option>
                  ))}
                </select>
              </div>
              <Falt
                etikett="Byggnadens nockhöjd"
                enhet="m"
                varde={indata.byggnadshojd}
                steg={0.5}
                min={2}
                onChange={(v) => uppdatera({ byggnadshojd: v })}
              />
              <p className="hjalptext">
                Formfaktorerna avser takets inre zon. Randzoner ger högre sug och kontrolleras
                separat för infästning av taktäckning och förankring.
              </p>
            </>
          )}
        </div>
      </details>

      <details className="grupp" open>
        <summary>Virke och dimensioner</summary>
        <div className="grupp-innehall">
          <div className="knapprad">
            <button type="button" className="knapp knapp-primar" onClick={onAutodimensionera}>
              Dimensionera automatiskt
            </button>
          </div>
          <p className="hjalptext">
            Söker minsta standarddimension per stångtyp som klarar samtliga kontroller.
          </p>
          {anvandaStangtyper.map((typ) => {
            const sektion = indata.sektioner[typ];
            const grade = hittaKvalitet(sektion.kvalitet);
            const dimensioner = dimensionerFor(grade.family);
            return (
              <div key={typ} className="falt-bred">
                <label>{STANGTYP_NAMN[typ]}</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select
                    aria-label={`Kvalitet ${STANGTYP_NAMN[typ]}`}
                    value={sektion.kvalitet}
                    onChange={(e) => {
                      const nyGrade = hittaKvalitet(e.target.value);
                      const nyaDim = dimensionerFor(nyGrade.family);
                      const finns = nyaDim.some(
                        (d) => d.b === sektion.dim.b && d.h === sektion.dim.h,
                      );
                      uppdateraSektion(typ, {
                        kvalitet: e.target.value,
                        dim: finns ? sektion.dim : nyaDim[Math.floor(nyaDim.length / 2)],
                      });
                    }}
                  >
                    <optgroup label="Konstruktionsvirke">
                      {KONSTRUKTIONSVIRKE.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.namn}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Limträ">
                      {LIMTRA.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.namn}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <select
                    aria-label={`Dimension ${STANGTYP_NAMN[typ]}`}
                    value={dimensionNamn(sektion.dim)}
                    onChange={(e) => {
                      const d = dimensioner.find((x) => dimensionNamn(x) === e.target.value);
                      if (d) uppdateraSektion(typ, { dim: d });
                    }}
                  >
                    {dimensioner.map((d) => (
                      <option key={dimensionNamn(d)} value={dimensionNamn(d)}>
                        {dimensionNamn(d)} mm
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
          <div className="knapprad">
            <button
              type="button"
              className="knapp"
              onClick={() => {
                const kvalitet = indata.sektioner.overram.kvalitet;
                const sektioner = { ...indata.sektioner };
                for (const t of Object.keys(sektioner) as StangTyp[]) {
                  const grade = hittaKvalitet(kvalitet);
                  const dimensioner = dimensionerFor(grade.family);
                  const finns = dimensioner.some(
                    (d) => d.b === sektioner[t].dim.b && d.h === sektioner[t].dim.h,
                  );
                  sektioner[t] = {
                    kvalitet,
                    dim: finns ? sektioner[t].dim : dimensioner[Math.floor(dimensioner.length / 2)],
                  };
                }
                onChange({ ...indata, sektioner });
              }}
            >
              Samma kvalitet överallt
            </button>
          </div>
          <p className="hjalptext">
            Tillgängliga kvaliteter:{' '}
            {ALLA_KVALITETER.filter((g) => g.kommentar)
              .map((g) => g.namn)
              .join(', ')}{' '}
            m.fl.
          </p>
        </div>
      </details>

      <details className="grupp">
        <summary>Stagning och knäcklängder</summary>
        <div className="grupp-innehall">
          <Falt
            etikett="Sidostagning överram"
            enhet="m"
            varde={indata.stagningOverram}
            steg={0.1}
            min={0.1}
            onChange={(v) => uppdatera({ stagningOverram: v })}
          />
          <p className="hjalptext">
            Normalt takläktens avstånd när taket har genomgående läkt eller råspont.
          </p>
          <Falt
            etikett="Sidostagning underram"
            enhet="m"
            varde={indata.stagningUnderram}
            steg={0.1}
            min={0.1}
            onChange={(v) => uppdatera({ stagningUnderram: v })}
          />
          <Falt
            etikett="Livstag på diagonaler"
            enhet="m"
            varde={indata.stagningDiagonal}
            steg={0.1}
            min={0.1}
            onChange={(v) => uppdatera({ stagningDiagonal: v })}
          />
          <p className="hjalptext">
            Stagningen måste finnas på plats i verkligheten, annars är knäcklängden hela
            stångens längd.
          </p>
          <Falt
            etikett="Knäcklängdsfaktor i planet"
            varde={indata.knacklangdsfaktor}
            steg={0.05}
            min={0.5}
            max={2}
            onChange={(v) => uppdatera({ knacklangdsfaktor: v })}
          />
        </div>
      </details>

      <details className="grupp">
        <summary>Säkerhet och krav</summary>
        <div className="grupp-innehall">
          <div className="falt-bred">
            <label htmlFor="sakerhetsklass">Säkerhetsklass</label>
            <select
              id="sakerhetsklass"
              value={indata.sakerhetsklass}
              onChange={(e) => uppdatera({ sakerhetsklass: Number(e.target.value) as Sakerhetsklass })}
            >
              {([1, 2, 3] as Sakerhetsklass[]).map((k) => (
                <option key={k} value={k}>
                  {SAKERHETSKLASS_TEXT[k]}
                </option>
              ))}
            </select>
          </div>
          <Falt
            etikett="Nedböjningskrav, momentan L/"
            varde={indata.nedbojningKarakteristisk}
            steg={50}
            min={100}
            onChange={(v) => uppdatera({ nedbojningKarakteristisk: v })}
          />
          <Falt
            etikett="Nedböjningskrav, slutlig L/"
            varde={indata.nedbojningSlutlig}
            steg={50}
            min={100}
            onChange={(v) => uppdatera({ nedbojningSlutlig: v })}
          />
          <Falt
            etikett="Upplagslängd"
            enhet="mm"
            varde={indata.upplagslangd}
            steg={5}
            min={30}
            onChange={(v) => uppdatera({ upplagslangd: v })}
          />
        </div>
      </details>

      <details className="grupp">
        <summary>Återställ</summary>
        <div className="grupp-innehall">
          <button type="button" className="knapp" onClick={onAterstall}>
            Återställ till standardvärden
          </button>
        </div>
      </details>
    </div>
  );
}
