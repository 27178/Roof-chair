import type { Analysresultat, Indata } from '../domain/analys';
import { klimatklassNamn, sektionFor } from '../domain/analys';
import { KONTROLL_NAMN } from '../domain/ec5';
import { modellInfo, STANGTYP_NAMN } from '../domain/geometri';
import { SAKERHETSKLASS_TEXT } from '../domain/loads';
import { hittaKvalitet } from '../domain/materials';
import { STATUSTEXT, statusband, tal } from '../ui/format';

export function Rapport({ resultat, indata }: { resultat: Analysresultat; indata: Indata }) {
  const info = modellInfo(indata.geometri.modell);
  const varst = [...resultat.stanger].sort((a, b) => b.utnyttjande - a.utnyttjande)[0];
  const datum = new Date().toLocaleDateString('sv-SE');

  return (
    <div className="rapport">
      <h3>Sammanfattning</h3>
      <dl>
        <dt>Konstruktionsmodell</dt>
        <dd>{info.namn}</dd>
        <dt>Verkningssätt</dt>
        <dd>{info.verkningssatt}</dd>
        <dt>Spännvidd</dt>
        <dd>{tal(resultat.geometri.spannvidd, 2)} m</dd>
        <dt>Taklutning</dt>
        <dd>
          {tal(indata.geometri.taklutning, 1)}° / {tal(indata.geometri.taklutningHoger, 1)}°
        </dd>
        <dt>Nockhöjd över underram</dt>
        <dd>{tal(resultat.geometri.nockhojd, 2)} m</dd>
        <dt>Takstolsavstånd</dt>
        <dd>{tal(indata.cc, 2)} m</dd>
        <dt>Säkerhetsklass</dt>
        <dd>{SAKERHETSKLASS_TEXT[indata.sakerhetsklass]}</dd>
        <dt>Klimatklass</dt>
        <dd>{klimatklassNamn(indata.klimatklass)}</dd>
        <dt>Snözon</dt>
        <dd>sk = {tal(indata.sk, 2)} kN/m²</dd>
        <dt>Högsta utnyttjandegrad</dt>
        <dd>
          {tal(resultat.maxUtnyttjande, 2)} – {STATUSTEXT[statusband(resultat.maxUtnyttjande)]} (
          {varst.namn})
        </dd>
        <dt>Bedömning</dt>
        <dd>
          {resultat.godkand
            ? 'Samtliga kontrollerade villkor är uppfyllda med valda dimensioner.'
            : 'Minst ett villkor överskrids – konstruktionen måste ändras.'}
        </dd>
        <dt>Beräkningsdatum</dt>
        <dd>{datum}</dd>
      </dl>

      <h3>Materialdata</h3>
      <div className="tabellsvep">
        <table>
          <thead>
            <tr>
              <th>Stångtyp</th>
              <th>Kvalitet</th>
              <th>Dimension</th>
              <th className="num">fm,k</th>
              <th className="num">ft,0,k</th>
              <th className="num">fc,0,k</th>
              <th className="num">fv,k</th>
              <th className="num">E0,mean</th>
              <th className="num">E0,05</th>
              <th className="num">ρk</th>
            </tr>
          </thead>
          <tbody>
            {[...new Set(resultat.stanger.map((s) => s.typ))].map((typ) => {
              const sekt = sektionFor(indata, typ);
              const g = hittaKvalitet(sekt.kvalitet);
              return (
                <tr key={typ}>
                  <td>{STANGTYP_NAMN[typ]}</td>
                  <td>{g.namn}</td>
                  <td>
                    {sekt.dim.b}×{sekt.dim.h} mm
                  </td>
                  <td className="num">{tal(g.fmk, 1)}</td>
                  <td className="num">{tal(g.ft0k, 1)}</td>
                  <td className="num">{tal(g.fc0k, 1)}</td>
                  <td className="num">{tal(g.fvk, 1)}</td>
                  <td className="num">{g.E0mean}</td>
                  <td className="num">{g.E005}</td>
                  <td className="num">{g.rhok}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="kalla">
        Hållfasthetsvärden i MPa och densitet i kg/m³ enligt SS-EN 338 (konstruktionsvirke) och
        SS-EN 14080 (limträ).
      </p>

      <h3>Dimensionerande hållfastheter för avgörande stång</h3>
      <dl>
        <dt>Stång</dt>
        <dd>
          {varst.namn} ({STANGTYP_NAMN[varst.typ]}), {varst.dimension} mm {varst.kvalitet}
        </dd>
        <dt>Avgörande lastkombination</dt>
        <dd>{varst.kombination}</dd>
        <dt>kmod</dt>
        <dd>{tal(varst.dimensioneringsvarden.kmod, 2)}</dd>
        <dt>kh</dt>
        <dd>{tal(varst.dimensioneringsvarden.kh, 3)}</dd>
        <dt>γM</dt>
        <dd>{tal(varst.dimensioneringsvarden.gammaM, 2)}</dd>
        <dt>fm,d</dt>
        <dd>{tal(varst.dimensioneringsvarden.fmd, 2)} MPa</dd>
        <dt>ft,0,d</dt>
        <dd>{tal(varst.dimensioneringsvarden.ft0d, 2)} MPa</dd>
        <dt>fc,0,d</dt>
        <dd>{tal(varst.dimensioneringsvarden.fc0d, 2)} MPa</dd>
        <dt>fv,d</dt>
        <dd>{tal(varst.dimensioneringsvarden.fvd, 2)} MPa</dd>
        <dt>Slankhetstal λy / λz</dt>
        <dd>
          {tal(varst.knackning.lambdaY, 1)} / {tal(varst.knackning.lambdaZ, 1)}
        </dd>
        <dt>kc,y / kc,z</dt>
        <dd>
          {tal(varst.knackning.kcY, 3)} / {tal(varst.knackning.kcZ, 3)}
        </dd>
        <dt>kcrit (vippning)</dt>
        <dd>{tal(varst.kcrit, 3)}</dd>
      </dl>

      <h3>Kontroller i avgörande snitt</h3>
      <div className="tabellsvep">
        <table>
          <thead>
            <tr>
              <th>Kontroll</th>
              <th>Uttryck</th>
              <th className="num">Utnyttjande</th>
            </tr>
          </thead>
          <tbody>
            {varst.kontroller.map((k) => (
              <tr key={k.typ}>
                <td>{KONTROLL_NAMN[k.typ]}</td>
                <td className="formel">{k.formel}</td>
                <td className="num">{tal(k.utnyttjande, 3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Beräkningsförutsättningar</h3>
      <ul style={{ fontSize: 12.5, color: 'var(--text-secondary)', paddingLeft: 18 }}>
        <li>
          Takstolen beräknas som ett plant ram- och fackverkssystem med balkelement. Överram och
          underram är kontinuerliga över knutpunkterna medan diagonaler och stolpar är ledade.
        </li>
        <li>
          Knutpunkternas eftergivlighet (spikplåtar, spikade förband) ingår inte. Förbanden ska
          dimensioneras separat enligt SS-EN 1995-1-1 kapitel 8, och spikplåtsförband enligt
          SS-EN 1995-1-1 avsnitt 8.8.
        </li>
        <li>
          Knäcklängden ut ur takstolens plan sätts till angivet stagningsavstånd: överram{' '}
          {tal(indata.stagningOverram, 2)} m, underram {tal(indata.stagningUnderram, 2)} m,
          diagonaler {tal(indata.stagningDiagonal, 2)} m. Stagningen förutsätts vara utförd.
        </li>
        <li>
          Snölastens formfaktorer avser tak utan snöfickor, högre byggnadsdelar intill eller
          takutrustning. Drivbildning enligt SS-EN 1991-1-3 avsnitt 5.3.6 och 6 kontrolleras separat.
        </li>
        <li>
          Nedböjningen beräknas med medelelasticitetsmodulen och slutvärdet inkluderar krypning
          med kdef enligt klimatklassen.
        </li>
        <li>
          Takstolens stabilisering i längsled (vindkryss, längsgående stagning, takskiva) ingår inte
          i beräkningen och ska projekteras separat.
        </li>
      </ul>

      <p className="kalla">
        Beräkningen följer SS-EN 1990, SS-EN 1991-1-1, SS-EN 1991-1-3, SS-EN 1991-1-4 och
        SS-EN 1995-1-1 med svenska nationella val enligt Boverkets konstruktionsregler. Verktyget är
        avsett för preliminär dimensionering och överslag. Bygglovs- och byggskedeshandlingar ska
        granskas och signeras av en behörig konstruktör, och färdiga takstolar ska vara CE-märkta
        enligt SS-EN 14250.
      </p>
    </div>
  );
}
