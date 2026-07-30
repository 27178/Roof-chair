import { useState } from 'react';
import { byggKombinationsmatris, type Indata, type MatrisCell } from '../domain/analys';
import { dimensionerFor, hittaKvalitet, KONSTRUKTIONSVIRKE, LIMTRA } from '../domain/materials';
import { SNOZONER } from '../domain/loads';
import type { StangTyp } from '../domain/geometri';
import { STATUSFARG, STATUSIKON, statusband, tal } from '../ui/format';

const STANGTYPER: StangTyp[] = [
  'overram',
  'underram',
  'diagonal',
  'stolpe',
  'hanbjalke',
  'stodben',
  'taksprang',
];

export function Matrispanel({ indata }: { indata: Indata }) {
  const [valdaKvaliteter, setValdaKvaliteter] = useState<string[]>(['C14', 'C18', 'C24', 'C30']);
  const [valdaZoner, setValdaZoner] = useState<number[]>([1.5, 2.0, 2.5, 3.0, 3.5, 4.5]);
  const [celler, setCeller] = useState<MatrisCell[] | null>(null);
  const [beraknar, setBeraknar] = useState(false);

  const berakna = () => {
    setBeraknar(true);
    // Låt webbläsaren rita om innan den tunga beräkningen startar
    setTimeout(() => {
      const dimensioner = {} as Record<StangTyp, ReturnType<typeof dimensionerFor>>;
      for (const t of STANGTYPER) {
        const family = hittaKvalitet(indata.sektioner[t].kvalitet).family;
        dimensioner[t] = dimensionerFor(family).filter((d) => d.b >= 45);
      }
      try {
        setCeller(byggKombinationsmatris(indata, valdaKvaliteter, valdaZoner, dimensioner));
      } finally {
        setBeraknar(false);
      }
    }, 30);
  };

  const vaxla = <T,>(lista: T[], varde: T, satt: (v: T[]) => void) => {
    satt(lista.includes(varde) ? lista.filter((x) => x !== varde) : [...lista, varde]);
  };

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 0 }}>
        Matrisen visar minsta standarddimension på över- och underram för varje kombination av
        virkeskvalitet och snözon, med övriga indata oförändrade. Övriga stångtyper
        dimensioneras samtidigt men redovisas i resultatfliken.
      </p>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <strong style={{ fontSize: 12.5 }}>Virkeskvaliteter</strong>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
            {[...KONSTRUKTIONSVIRKE, ...LIMTRA].map((g) => (
              <label key={g.id} className="checkbox-rad">
                <input
                  type="checkbox"
                  checked={valdaKvaliteter.includes(g.id)}
                  onChange={() => vaxla(valdaKvaliteter, g.id, setValdaKvaliteter)}
                />
                {g.namn}
              </label>
            ))}
          </div>
        </div>
        <div>
          <strong style={{ fontSize: 12.5 }}>Snözoner (kN/m²)</strong>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
            {SNOZONER.map((z) => (
              <label key={z.sk} className="checkbox-rad">
                <input
                  type="checkbox"
                  checked={valdaZoner.includes(z.sk)}
                  onChange={() => vaxla(valdaZoner, z.sk, setValdaZoner)}
                />
                {z.etikett}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="knapprad" style={{ marginBottom: 14 }}>
        <button
          type="button"
          className="knapp knapp-primar"
          onClick={berakna}
          disabled={beraknar || valdaKvaliteter.length === 0 || valdaZoner.length === 0}
        >
          {beraknar
            ? 'Beräknar …'
            : `Beräkna ${valdaKvaliteter.length * valdaZoner.length} kombinationer`}
        </button>
      </div>

      {celler && (
        <div className="tabellsvep">
          <table>
            <thead>
              <tr>
                <th>Kvalitet</th>
                {valdaZoner
                  .slice()
                  .sort((a, b) => a - b)
                  .map((z) => (
                    <th key={z} className="num">
                      sk = {tal(z, 1)}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {valdaKvaliteter.map((k) => (
                <tr key={k}>
                  <td style={{ fontWeight: 600 }}>{k}</td>
                  {valdaZoner
                    .slice()
                    .sort((a, b) => a - b)
                    .map((z) => {
                      const cell = celler.find((c) => c.kvalitet === k && c.sk === z);
                      if (!cell) return <td key={z}>–</td>;
                      const band = cell.godkand ? statusband(cell.maxUtnyttjande) : 'critical';
                      return (
                        <td key={z} className="num">
                          <div
                            className="matris-cell"
                            style={{
                              background: `color-mix(in srgb, ${STATUSFARG[band]} 16%, transparent)`,
                              border: `1px solid ${STATUSFARG[band]}`,
                            }}
                            title={`Avgörande: ${cell.avgorande}`}
                          >
                            <span aria-hidden="true">{STATUSIKON[band]} </span>
                            {cell.godkand ? (
                              <>
                                <strong>{cell.overram}</strong>
                                <br />
                                underram {cell.underram}
                                <br />
                                <span style={{ color: 'var(--text-secondary)' }}>
                                  η = {tal(cell.maxUtnyttjande, 2)}
                                </span>
                              </>
                            ) : (
                              <>
                                Otillräcklig
                                <br />
                                <span style={{ color: 'var(--text-secondary)' }}>
                                  η = {tal(cell.maxUtnyttjande, 2)}
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                      );
                    })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {celler && (
        <p className="kalla">
          Dimensionerna avser bredd × höjd i mm. ”Otillräcklig” betyder att inte ens den grövsta
          standarddimensionen i listan klarar kraven – välj då en annan konstruktionsmodell, minskat
          takstolsavstånd eller limträ. Upplagstrycket ingår inte i sökningen eftersom det styrs av
          upplagslängden.
        </p>
      )}
    </div>
  );
}
