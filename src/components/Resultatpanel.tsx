import type { Analysresultat } from '../domain/analys';
import { KONTROLL_NAMN } from '../domain/ec5';
import { STANGTYP_NAMN } from '../domain/geometri';
import { mm, STATUSFARG, STATUSIKON, STATUSTEXT, statusband, tal } from '../ui/format';

function Statusmarke({ utnyttjande, etikett }: { utnyttjande: number; etikett?: string }) {
  const band = statusband(utnyttjande);
  return (
    <span className={`status status-${band}`}>
      <span aria-hidden="true">{STATUSIKON[band]}</span>
      {etikett ?? STATUSTEXT[band]} {tal(utnyttjande, 2)}
    </span>
  );
}

function Nyckeltal({
  etikett,
  varde,
  enhet,
  not,
}: {
  etikett: string;
  varde: string;
  enhet?: string;
  not?: string;
}) {
  return (
    <div className="nyckeltal-kort">
      <span className="etikett">{etikett}</span>
      <span className="varde">
        {varde}
        {enhet ? <span className="enhet"> {enhet}</span> : null}
      </span>
      {not ? <span className="not">{not}</span> : null}
    </div>
  );
}

export function Resultatpanel({ resultat }: { resultat: Analysresultat }) {
  const sorterade = [...resultat.stanger].sort((a, b) => b.utnyttjande - a.utnyttjande);
  const varst = sorterade[0];
  const n = resultat.nedbojning;

  return (
    <div>
      <div className="nyckeltal">
        <Nyckeltal
          etikett="Högsta utnyttjandegrad"
          varde={tal(resultat.maxUtnyttjande, 2)}
          not={`${STATUSTEXT[statusband(resultat.maxUtnyttjande)]} · ${varst.namn}`}
        />
        <Nyckeltal
          etikett="Momentan nedböjning"
          varde={tal(n.winstQ, 1)}
          enhet="mm"
          not={`Krav L/${tal(resultat.geometri.spannvidd / (n.gransKarakteristisk / 1000), 0)} = ${tal(n.gransKarakteristisk, 0)} mm`}
        />
        <Nyckeltal
          etikett="Slutlig nedböjning"
          varde={tal(n.wfin, 1)}
          enhet="mm"
          not={`Krav ${tal(n.gransSlutlig, 0)} mm · utnyttjande ${tal(n.utnyttjandeSlutlig, 2)}`}
        />
        <Nyckeltal
          etikett="Upplagsreaktion"
          varde={tal(Math.max(...resultat.upplag.map((u) => u.Rvert)), 1)}
          enhet="kN"
          not={`Horisontellt ${tal(Math.max(...resultat.upplag.map((u) => u.Rhoriz)), 1)} kN`}
        />
      </div>

      {resultat.varningar.map((v, i) => (
        <div className="varning" key={i}>
          <span className="ikon" aria-hidden="true">
            !
          </span>
          <span>{v}</span>
        </div>
      ))}

      {!resultat.godkand && (
        <div className="varning fel">
          <span className="ikon" aria-hidden="true">
            ✕
          </span>
          <span>
            Bärförmågan räcker inte med valda dimensioner. Öka virkesdimensionen, välj en högre
            hållfasthetsklass, minska takstolsavståndet eller täta stagningen.
          </span>
        </div>
      )}

      <h3 style={{ fontSize: 14, margin: '16px 0 8px' }}>Kontroll av stänger</h3>
      <div className="tabellsvep">
        <table>
          <thead>
            <tr>
              <th>Stång</th>
              <th>Typ</th>
              <th>Dimension</th>
              <th className="num">L (mm)</th>
              <th className="num">N (kN)</th>
              <th className="num">M (kNm)</th>
              <th className="num">V (kN)</th>
              <th>Avgörande kontroll</th>
              <th>Lastkombination</th>
              <th className="num">Utnyttjande</th>
            </tr>
          </thead>
          <tbody>
            {sorterade.map((s) => {
              const band = statusband(s.utnyttjande);
              return (
                <tr key={s.stangId}>
                  <td>{s.namn}</td>
                  <td>{STANGTYP_NAMN[s.typ]}</td>
                  <td>
                    {s.dimension} {s.kvalitet}
                  </td>
                  <td className="num">{mm(s.langd)}</td>
                  <td className="num">{tal(s.N, 1)}</td>
                  <td className="num">{tal(s.M, 2)}</td>
                  <td className="num">{tal(s.V, 1)}</td>
                  <td>{KONTROLL_NAMN[s.kontroll]}</td>
                  <td>{s.kombination}</td>
                  <td className="num" style={{ fontWeight: 600 }}>
                    <span style={{ color: STATUSFARG[band] }} aria-hidden="true">
                      {STATUSIKON[band]}{' '}
                    </span>
                    {tal(s.utnyttjande, 2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3 style={{ fontSize: 14, margin: '20px 0 8px' }}>Nedböjning</h3>
      <div className="tabellsvep">
        <table>
          <thead>
            <tr>
              <th>Kontroll</th>
              <th className="num">Nedböjning (mm)</th>
              <th className="num">Krav (mm)</th>
              <th className="num">Utnyttjande</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Momentan nedböjning av variabel last, winst</td>
              <td className="num">{tal(n.winstQ, 1)}</td>
              <td className="num">{tal(n.gransKarakteristisk, 1)}</td>
              <td className="num">{tal(n.utnyttjandeKarakteristisk, 2)}</td>
            </tr>
            <tr>
              <td>Slutlig nedböjning inklusive krypning, wfin</td>
              <td className="num">{tal(n.wfin, 1)}</td>
              <td className="num">{tal(n.gransSlutlig, 1)}</td>
              <td className="num">{tal(n.utnyttjandeSlutlig, 2)}</td>
            </tr>
            <tr>
              <td>Nedböjning av egentyngd</td>
              <td className="num">{tal(n.winstG, 1)}</td>
              <td className="num">–</td>
              <td className="num">–</td>
            </tr>
            <tr>
              <td>Horisontell rörelse vid rörligt upplag</td>
              <td className="num">{tal(n.horisontellRorelse, 1)}</td>
              <td className="num">–</td>
              <td className="num">–</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 style={{ fontSize: 14, margin: '20px 0 8px' }}>Upplag</h3>
      <div className="tabellsvep">
        <table>
          <thead>
            <tr>
              <th>Upplag</th>
              <th className="num">Vertikal reaktion (kN)</th>
              <th className="num">Horisontell reaktion (kN)</th>
              <th className="num">Lyftkraft (kN)</th>
              <th className="num">Erforderlig upplagslängd (mm)</th>
              <th className="num">Tryck vinkelrätt fibrerna</th>
            </tr>
          </thead>
          <tbody>
            {resultat.upplag.map((u, i) => (
              <tr key={u.nod}>
                <td>{i === 0 ? 'Vänster (fast)' : 'Höger (rörligt)'}</td>
                <td className="num">{tal(u.Rvert, 1)}</td>
                <td className="num">{tal(u.Rhoriz, 1)}</td>
                <td className="num">{u.Rlyft < 0 ? tal(u.Rlyft, 1) : '–'}</td>
                <td className="num">{tal(Math.ceil(u.erforderligUpplagslangd), 0)}</td>
                <td className="num">
                  <Statusmarke utnyttjande={u.kontroll.utnyttjande} etikett="" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resultat.innermatt.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, margin: '20px 0 8px' }}>Invändiga fria mått</h3>
          <div className="tabellsvep">
            <table>
              <thead>
                <tr>
                  <th>Mått</th>
                  <th className="num">Fritt mått (mm)</th>
                  <th>Kommentar</th>
                </tr>
              </thead>
              <tbody>
                {resultat.innermatt.map((m) => (
                  <tr key={m.id}>
                    <td>{m.etikett}</td>
                    <td className="num">{mm(m.varde)}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{m.kommentar ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="kalla">
            Måtten är fria mått mellan virkets ytor. Golvbeläggning, undertak, isolering och
            invändiga ytskikt är inte avdragna.
          </p>
        </>
      )}

      <h3 style={{ fontSize: 14, margin: '20px 0 8px' }}>Virkesåtgång per takstol</h3>
      <div className="tabellsvep">
        <table>
          <thead>
            <tr>
              <th>Stångtyp</th>
              <th>Dimension</th>
              <th>Kvalitet</th>
              <th className="num">Längd (mm)</th>
              <th className="num">Volym (m³)</th>
            </tr>
          </thead>
          <tbody>
            {resultat.virkesatgang.map((v) => {
              const [b, h] = v.dimension.split('×').map(Number);
              return (
                <tr key={`${v.typ}-${v.dimension}`}>
                  <td>{STANGTYP_NAMN[v.typ]}</td>
                  <td>{v.dimension} mm</td>
                  <td>{v.kvalitet}</td>
                  <td className="num">{mm(v.langd)}</td>
                  <td className="num">{tal((b / 1000) * (h / 1000) * v.langd, 4)}</td>
                </tr>
              );
            })}
            <tr>
              <td colSpan={3} style={{ fontWeight: 600 }}>
                Summa
              </td>
              <td className="num" style={{ fontWeight: 600 }}>
                {mm(resultat.virkesatgang.reduce((s, v) => s + v.langd, 0))}
              </td>
              <td className="num" style={{ fontWeight: 600 }}>
                {tal(
                  resultat.virkesatgang.reduce((s, v) => {
                    const [b, h] = v.dimension.split('×').map(Number);
                    return s + (b / 1000) * (h / 1000) * v.langd;
                  }, 0),
                  4,
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
