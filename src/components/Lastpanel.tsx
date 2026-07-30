import type { Analysresultat, Indata } from '../domain/analys';
import { snoPsi } from '../domain/loads';
import { tal } from '../ui/format';

export function Lastpanel({ resultat, indata }: { resultat: Analysresultat; indata: Indata }) {
  const l = resultat.laster;
  const psi = snoPsi(indata.sk);
  const alfa = (indata.geometri.taklutning * Math.PI) / 180;

  return (
    <div className="rapport">
      <h3>Snölast enligt SS-EN 1991-1-3</h3>
      <dl>
        <dt>Snölast på mark, sk</dt>
        <dd>{tal(l.sno.sk, 2)} kN/m²</dd>
        <dt>Formfaktor μ1 (taklutning {tal(indata.geometri.taklutning, 0)}°)</dt>
        <dd>{tal(l.sno.mu1, 2)}</dd>
        <dt>Exponeringsfaktor Ce</dt>
        <dd>{tal(l.sno.Ce, 2)}</dd>
        <dt>Termisk koefficient Ct</dt>
        <dd>{tal(l.sno.Ct, 2)}</dd>
        <dt>Snölast på tak, s = μ1·Ce·Ct·sk</dt>
        <dd>
          {tal(l.sno.mu1, 2)} · {tal(l.sno.Ce, 2)} · {tal(l.sno.Ct, 2)} · {tal(l.sno.sk, 2)} ={' '}
          <strong>{tal(l.sno.s, 2)} kN/m²</strong>
        </dd>
        <dt>Per takstol (c/c {tal(indata.cc, 2)} m)</dt>
        <dd>{tal(l.snoLinje, 2)} kN/m</dd>
        <dt>Lastvaraktighetsklass</dt>
        <dd>{l.sno.varaktighet === 'lang' ? 'Lång (sk ≥ 3,0 kN/m²)' : 'Medellång'}</dd>
        <dt>Kombinationsfaktorer ψ0 / ψ1 / ψ2</dt>
        <dd>
          {tal(psi.psi0, 2)} / {tal(psi.psi1, 2)} / {tal(psi.psi2, 2)}
        </dd>
      </dl>

      <h3>Snölastfall</h3>
      <div className="tabellsvep">
        <table>
          <thead>
            <tr>
              <th>Lastfall</th>
              <th className="num">Vänster takfall (kN/m²)</th>
              <th className="num">Höger takfall (kN/m²)</th>
            </tr>
          </thead>
          <tbody>
            {l.sno.lastfall.map((f) => (
              <tr key={f.namn}>
                <td>{f.namn}</td>
                <td className="num">{tal(f.vanster, 2)}</td>
                <td className="num">{tal(f.hoger, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Egentyngd</h3>
      <dl>
        <dt>Taktäckning</dt>
        <dd>
          {tal(l.gTak, 2)} kN/m² taklutande yta = {tal(l.gTak / Math.cos(alfa), 2)} kN/m² horisontell
          projektion
        </dd>
        <dt>Taktäckning per takstol</dt>
        <dd>{tal(l.gTakLinje, 2)} kN/m</dd>
        <dt>Innertak och isolering</dt>
        <dd>{tal(l.gInnertak, 2)} kN/m² horisontell yta</dd>
        <dt>Innertak per takstol</dt>
        <dd>{tal(l.gInnertakLinje, 2)} kN/m</dd>
        <dt>Takstolens egentyngd</dt>
        <dd>{tal(l.egentyngdVirke, 2)} kN per takstol</dd>
      </dl>

      <h3>Nyttig last</h3>
      <dl>
        <dt>Kategori</dt>
        <dd>{l.nyttiglast.namn}</dd>
        <dt>qk</dt>
        <dd>{tal(l.nyttiglast.qk, 2)} kN/m²</dd>
        <dt>Per takstol</dt>
        <dd>{tal(l.nyttigLinje, 2)} kN/m</dd>
        <dt>ψ0 / ψ1 / ψ2</dt>
        <dd>{l.nyttiglast.psi.map((p) => tal(p, 1)).join(' / ')}</dd>
      </dl>

      {l.vind && (
        <>
          <h3>Vindlast enligt SS-EN 1991-1-4 (förenklad)</h3>
          <dl>
            <dt>Referensvindhastighet vb</dt>
            <dd>{tal(indata.vb, 0)} m/s</dd>
            <dt>Medelvindhastighet vm(z)</dt>
            <dd>{tal(l.vind.vm, 1)} m/s vid z = {tal(indata.byggnadshojd, 1)} m</dd>
            <dt>Turbulensintensitet Iv</dt>
            <dd>{tal(l.vind.Iv, 3)}</dd>
            <dt>Karakteristiskt hastighetstryck qp(z)</dt>
            <dd>{tal(l.vind.qp, 2)} kN/m²</dd>
            <dt>Nettoformfaktor, sug</dt>
            <dd>{tal(l.vind.cpNettoSug, 2)}</dd>
            <dt>Vindsug på takytan</dt>
            <dd>{tal(l.vind.wSug, 2)} kN/m² (uppåt)</dd>
            <dt>Per takstol</dt>
            <dd>{tal(l.vindLinje ?? 0, 2)} kN/m</dd>
          </dl>
        </>
      )}

      <h3>Lastkombinationer i brottgränstillstånd</h3>
      <div className="tabellsvep">
        <table>
          <thead>
            <tr>
              <th>Kombination</th>
              <th className="num">Egentyngd</th>
              <th className="num">Snölast</th>
              <th className="num">Nyttig last</th>
              <th className="num">Vindlast</th>
              <th>Varaktighet (kmod)</th>
            </tr>
          </thead>
          <tbody>
            {resultat.kombinationer.map((k) => (
              <tr key={k.id}>
                <td>{k.namn}</td>
                <td className="num">{tal(k.faktorer.egentyngd, 3)}</td>
                <td className="num">{tal(k.faktorer.sno, 3)}</td>
                <td className="num">{tal(k.faktorer.nyttig, 3)}</td>
                <td className="num">{tal(k.faktorer.vind, 3)}</td>
                <td>{k.varaktighet}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="kalla">
        Partialkoefficienterna innehåller säkerhetsklassfaktorn γd enligt Boverkets
        konstruktionsregler. Kombination 6.10a avser γd·1,35·Gk och 6.10b avser γd·1,2·Gk +
        γd·1,5·Qk,1 + γd·1,5·Σψ0,i·Qk,i enligt SS-EN 1990.
      </p>
    </div>
  );
}
