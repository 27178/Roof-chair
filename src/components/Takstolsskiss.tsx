import { useMemo, useState } from 'react';
import type { Analysresultat } from '../domain/analys';
import type { Nod, Stang, TakstolGeometri } from '../domain/geometri';
import { STANGTYP_NAMN } from '../domain/geometri';
import { mm, STATUSFARG, statusband, tal } from '../ui/format';

export type Visningslage = 'utnyttjande' | 'normalkraft' | 'moment' | 'tvarkraft' | 'deformation' | 'laster';

export const VISNINGSLAGEN: { id: Visningslage; namn: string }[] = [
  { id: 'utnyttjande', namn: 'Utnyttjandegrad' },
  { id: 'normalkraft', namn: 'Normalkraft' },
  { id: 'moment', namn: 'Böjmoment' },
  { id: 'tvarkraft', namn: 'Tvärkraft' },
  { id: 'deformation', namn: 'Deformation' },
  { id: 'laster', namn: 'Laster' },
];

const BREDD = 1000;
const MARGINAL = { topp: 54, hoger: 158, botten: 84, vanster: 90 };

interface Props {
  resultat: Analysresultat;
  lage: Visningslage;
  visaBeteckningar: boolean;
  visaInnermatt: boolean;
}

interface Ritdata {
  hojd: number;
  skala: number;
  X: (x: number) => number;
  Y: (y: number) => number;
}

function ritdataFor(geo: TakstolGeometri): Ritdata {
  const xs = geo.noder.map((n) => n.x);
  const ys = geo.noder.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const bredd = Math.max(maxX - minX, 0.1);
  const hojdGeo = Math.max(maxY - minY, 0.1);
  const skala = (BREDD - MARGINAL.vanster - MARGINAL.hoger) / bredd;
  const hojd = hojdGeo * skala + MARGINAL.topp + MARGINAL.botten;
  return {
    hojd,
    skala,
    X: (x: number) => MARGINAL.vanster + (x - minX) * skala,
    Y: (y: number) => MARGINAL.topp + (maxY - y) * skala,
  };
}

/** Polygon som visar stångens verkliga tvärsnittshöjd. */
function stangPolygon(r: Ritdata, a: Nod, b: Nod, hojdMm: number): string {
  const x1 = r.X(a.x);
  const y1 = r.Y(a.y);
  const x2 = r.X(b.x);
  const y2 = r.Y(b.y);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const halv = Math.max((hojdMm / 1000) * r.skala, 3) / 2;
  const nx = (-dy / len) * halv;
  const ny = (dx / len) * halv;
  return [
    `${x1 + nx},${y1 + ny}`,
    `${x2 + nx},${y2 + ny}`,
    `${x2 - nx},${y2 - ny}`,
    `${x1 - nx},${y1 - ny}`,
  ].join(' ');
}

function Upplagssymbol({ x, y, rulle }: { x: number; y: number; rulle: boolean }) {
  return (
    <g>
      <polygon
        points={`${x},${y} ${x - 11},${y + 17} ${x + 11},${y + 17}`}
        fill="none"
        stroke="var(--text-secondary)"
        strokeWidth={1.6}
      />
      {rulle ? (
        <>
          <circle cx={x - 6} cy={y + 21} r={3.6} fill="none" stroke="var(--text-secondary)" strokeWidth={1.4} />
          <circle cx={x + 6} cy={y + 21} r={3.6} fill="none" stroke="var(--text-secondary)" strokeWidth={1.4} />
          <line x1={x - 15} y1={y + 25.5} x2={x + 15} y2={y + 25.5} stroke="var(--text-secondary)" strokeWidth={1.6} />
        </>
      ) : (
        <>
          <line x1={x - 15} y1={y + 17} x2={x + 15} y2={y + 17} stroke="var(--text-secondary)" strokeWidth={1.6} />
          {[-12, -6, 0, 6, 12].map((d) => (
            <line
              key={d}
              x1={x + d}
              y1={y + 17}
              x2={x + d - 4}
              y2={y + 23}
              stroke="var(--text-secondary)"
              strokeWidth={1.1}
            />
          ))}
        </>
      )}
    </g>
  );
}

function Mattlinje({
  x1,
  y1,
  x2,
  y2,
  text,
  forskjutning = 0,
  lodrat = false,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  text: string;
  forskjutning?: number;
  lodrat?: boolean;
}) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <g stroke="var(--text-muted)" strokeWidth={0.9} fill="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <line
        x1={x1}
        y1={lodrat ? y1 : y1 - 5}
        x2={lodrat ? x1 + 5 : x1}
        y2={lodrat ? y1 : y1 + 5}
      />
      <line
        x1={x2}
        y1={lodrat ? y2 : y2 - 5}
        x2={lodrat ? x2 + 5 : x2}
        y2={lodrat ? y2 : y2 + 5}
      />
      <text
        x={lodrat ? mx + 8 : mx}
        y={lodrat ? my : my - 6 + forskjutning}
        textAnchor={lodrat ? 'start' : 'middle'}
        dominantBaseline={lodrat ? 'middle' : 'auto'}
        fill="var(--text-secondary)"
        stroke="none"
        fontSize={12}
        fontFamily="var(--font)"
      >
        {text}
      </text>
    </g>
  );
}

/**
 * Invändigt fritt mått, ritat inuti takstolen med måttpilar i båda ändar.
 * Ritas i en egen färg så att det inte förväxlas med yttermåtten.
 */
function Innermattlinje({
  x1,
  y1,
  x2,
  y2,
  text,
  vertikal,
  etikettUnder = false,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  text: string;
  vertikal: boolean;
  /** Lägg etiketten under måttlinjen i stället för över */
  etikettUnder?: boolean;
}) {
  // Stängernas egna etiketter sitter alltid på mittpunkten, så måttetiketten
  // läggs en bit vid sidan om för att inte hamna ovanpå dem
  const mx = vertikal ? (x1 + x2) / 2 : x1 + 0.34 * (x2 - x1);
  const my = vertikal ? (y1 + y2) / 2 : (y1 + y2) / 2;
  const pil = 4.5;
  return (
    <g stroke="var(--series-3)" strokeWidth={1.2} fill="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      {/* Ändmarkeringar vinkelrätt mot måttlinjen */}
      {[
        [x1, y1],
        [x2, y2],
      ].map(([px, py], i) => (
        <line
          key={i}
          x1={vertikal ? px - pil : px}
          y1={vertikal ? py : py - pil}
          x2={vertikal ? px + pil : px}
          y2={vertikal ? py : py + pil}
        />
      ))}
      <text
        x={vertikal ? mx + 7 : mx}
        y={vertikal ? my : my + (etikettUnder ? 13 : -5)}
        textAnchor={vertikal ? 'start' : 'middle'}
        dominantBaseline={vertikal ? 'middle' : 'auto'}
        fill="var(--series-3)"
        stroke="var(--surface-1)"
        strokeWidth={2.8}
        paintOrder="stroke"
        fontSize={11}
        fontWeight={600}
        fontFamily="var(--font)"
      >
        {text}
      </text>
    </g>
  );
}

export function Takstolsskiss({ resultat, lage, visaBeteckningar, visaInnermatt }: Props) {
  const geo = resultat.geometri;
  const [hovrad, setHovrad] = useState<string | null>(null);
  const r = useMemo(() => ritdataFor(geo), [geo]);

  const kontrollFor = (stangId: string) => resultat.stanger.find((s) => s.stangId === stangId);
  const kurvaFor = (stangId: string) => resultat.snittkurvor.find((s) => s.stangId === stangId);

  // Skalfaktor för snittkraftsdiagram
  const maxSnitt = useMemo(() => {
    let N = 0;
    let M = 0;
    let V = 0;
    for (const k of resultat.snittkurvor) {
      N = Math.max(N, ...k.N.map(Math.abs));
      M = Math.max(M, ...k.M.map(Math.abs));
      V = Math.max(V, ...k.V.map(Math.abs));
    }
    return { N: N || 1, M: M || 1, V: V || 1 };
  }, [resultat]);

  const maxDeformation = useMemo(
    () => Math.max(...resultat.deformation.map((d) => Math.hypot(d.ux, d.uy)), 1e-6),
    [resultat],
  );

  const stangFarg = (stang: Stang): string => {
    if (lage !== 'utnyttjande') return 'var(--virke)';
    const k = kontrollFor(stang.id);
    if (!k) return 'var(--virke)';
    return STATUSFARG[statusband(k.utnyttjande)];
  };

  const diagram = (stang: Stang, typ: 'N' | 'M' | 'V') => {
    const kurva = kurvaFor(stang.id);
    if (!kurva) return null;
    const varden = typ === 'N' ? kurva.N : typ === 'M' ? kurva.M : kurva.V;
    const max = typ === 'N' ? maxSnitt.N : typ === 'M' ? maxSnitt.M : maxSnitt.V;
    const a = geo.noder[stang.n1];
    const b = geo.noder[stang.n2];
    const x1 = r.X(a.x);
    const y1 = r.Y(a.y);
    const x2 = r.X(b.x);
    const y2 = r.Y(b.y);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const amplitud = 46;

    const punkter = varden.map((v, i) => {
      const t = i / (varden.length - 1);
      const px = x1 + dx * t;
      const py = y1 + dy * t;
      const o = (v / max) * amplitud;
      return { x: px + nx * o, y: py + ny * o, v };
    });

    const positiv = punkter.filter((p) => p.v >= 0).length >= punkter.length / 2;
    const path = [
      `M ${x1},${y1}`,
      ...punkter.map((p) => `L ${p.x},${p.y}`),
      `L ${x2},${y2}`,
      'Z',
    ].join(' ');

    return (
      <g key={`d-${stang.id}`}>
        <path
          d={path}
          fill={positiv ? 'var(--div-pos)' : 'var(--div-neg)'}
          fillOpacity={0.28}
          stroke={positiv ? 'var(--div-pos)' : 'var(--div-neg)'}
          strokeWidth={1.6}
        />
      </g>
    );
  };

  const lastpilar = () => {
    const pilar: JSX.Element[] = [];
    const takstanger = geo.stanger.filter((s) => s.takfall);
    for (const s of takstanger) {
      const a = geo.noder[s.n1];
      const b = geo.noder[s.n2];
      const antal = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) * 2));
      for (let i = 0; i <= antal; i++) {
        const t = i / antal;
        const px = r.X(a.x + (b.x - a.x) * t);
        const py = r.Y(a.y + (b.y - a.y) * t);
        pilar.push(
          <g key={`p-${s.id}-${i}`} stroke="var(--series-1)" strokeWidth={1.4}>
            <line x1={px} y1={py - 34} x2={px} y2={py - 6} />
            <polygon points={`${px},${py - 3} ${px - 3.4},${py - 10} ${px + 3.4},${py - 10}`} fill="var(--series-1)" stroke="none" />
          </g>,
        );
      }
    }
    return pilar;
  };

  const deformationsfigur = () => {
    const skalning = (55 / maxDeformation) * 1;
    return geo.stanger.map((s) => {
      const a = geo.noder[s.n1];
      const b = geo.noder[s.n2];
      const da = resultat.deformation[s.n1];
      const db = resultat.deformation[s.n2];
      return (
        <line
          key={`def-${s.id}`}
          x1={r.X(a.x + da.ux * skalning)}
          y1={r.Y(a.y + da.uy * skalning)}
          x2={r.X(b.x + db.ux * skalning)}
          y2={r.Y(b.y + db.uy * skalning)}
          stroke="var(--series-1)"
          strokeWidth={2}
          strokeLinecap="round"
        />
      );
    });
  };

  const upplagsY = Math.max(...geo.upplagsnoder.map((n) => r.Y(geo.noder[n].y)));
  const mattY = r.Y(Math.min(...geo.noder.map((n) => n.y))) + 46;
  const vansterUpplag = geo.noder[geo.upplagsnoder[0]];
  const hogerUpplag = geo.noder[geo.upplagsnoder[1]];
  const nockNod = geo.noder.reduce((a, b) => (b.y > a.y ? b : a), geo.noder[0]);
  const hojdmattX = BREDD - MARGINAL.hoger + 46;
  // Takfallets lutning ritas ut vid vänstra takfoten
  const takfallVanster = geo.stanger.find((s) => s.takfall === 'vanster' && s.typ !== 'taksprang');
  const lutningGrader = takfallVanster
    ? (Math.atan2(
        Math.abs(geo.noder[takfallVanster.n2].y - geo.noder[takfallVanster.n1].y),
        Math.abs(geo.noder[takfallVanster.n2].x - geo.noder[takfallVanster.n1].x),
      ) *
        180) /
      Math.PI
    : 0;
  const lutningRad = (lutningGrader * Math.PI) / 180;
  const hovradKontroll = hovrad ? kontrollFor(hovrad) : null;
  const hovradStang = hovrad ? geo.stanger.find((s) => s.id === hovrad) : null;

  return (
    <svg
      className="skiss"
      viewBox={`0 0 ${BREDD} ${r.hojd}`}
      role="img"
      aria-label={`Skiss av ${geo.modell} med spännvidd ${mm(geo.spannvidd)} millimeter`}
    >
      {/* Marklinje vid upplagen */}
      <line
        x1={MARGINAL.vanster - 40}
        y1={upplagsY + 26}
        x2={BREDD - MARGINAL.hoger + 40}
        y2={upplagsY + 26}
        stroke="var(--gridline)"
        strokeWidth={1}
      />

      {lage === 'deformation' && (
        <g opacity={0.35}>
          {geo.stanger.map((s) => (
            <line
              key={`odef-${s.id}`}
              x1={r.X(geo.noder[s.n1].x)}
              y1={r.Y(geo.noder[s.n1].y)}
              x2={r.X(geo.noder[s.n2].x)}
              y2={r.Y(geo.noder[s.n2].y)}
              stroke="var(--baseline)"
              strokeWidth={1.4}
              strokeDasharray="4 3"
            />
          ))}
        </g>
      )}

      {/* Stänger ritade med verklig tvärsnittshöjd */}
      {geo.stanger.map((s) => {
        const k = kontrollFor(s.id);
        const hojdMm = k?.dim.h ?? 145;
        return (
          <polygon
            key={s.id}
            points={stangPolygon(r, geo.noder[s.n1], geo.noder[s.n2], hojdMm)}
            fill={stangFarg(s)}
            fillOpacity={lage === 'utnyttjande' ? 0.85 : 0.95}
            stroke={hovrad === s.id ? 'var(--text-primary)' : 'var(--virke-kant)'}
            strokeWidth={hovrad === s.id ? 2 : 1}
            onMouseEnter={() => setHovrad(s.id)}
            onMouseLeave={() => setHovrad(null)}
            style={{ cursor: 'pointer' }}
          >
            <title>
              {`${s.namn} (${STANGTYP_NAMN[s.typ]})`}
              {k ? ` – ${k.dimension} ${k.kvalitet}, utnyttjande ${tal(k.utnyttjande, 2)}` : ''}
            </title>
          </polygon>
        );
      })}

      {/* Knutpunkter */}
      {geo.noder.map((n, i) => (
        <circle key={i} cx={r.X(n.x)} cy={r.Y(n.y)} r={2.6} fill="var(--text-secondary)" />
      ))}

      {lage === 'normalkraft' && geo.stanger.map((s) => diagram(s, 'N'))}
      {lage === 'moment' && geo.stanger.map((s) => diagram(s, 'M'))}
      {lage === 'tvarkraft' && geo.stanger.map((s) => diagram(s, 'V'))}
      {lage === 'deformation' && deformationsfigur()}
      {lage === 'laster' && lastpilar()}

      {/* Upplag */}
      <Upplagssymbol x={r.X(vansterUpplag.x)} y={r.Y(vansterUpplag.y)} rulle={false} />
      <Upplagssymbol x={r.X(hogerUpplag.x)} y={r.Y(hogerUpplag.y)} rulle />

      {/* Måttsättning */}
      <Mattlinje
        x1={r.X(vansterUpplag.x)}
        y1={mattY}
        x2={r.X(hogerUpplag.x)}
        y2={mattY}
        text={`Spännvidd ${mm(geo.spannvidd)} mm`}
      />
      <g stroke="var(--gridline)" strokeWidth={0.8}>
        <line x1={r.X(nockNod.x)} y1={r.Y(nockNod.y)} x2={hojdmattX + 6} y2={r.Y(nockNod.y)} />
        <line
          x1={r.X(hogerUpplag.x)}
          y1={r.Y(vansterUpplag.y)}
          x2={hojdmattX + 6}
          y2={r.Y(vansterUpplag.y)}
        />
      </g>
      <Mattlinje
        x1={hojdmattX}
        y1={r.Y(nockNod.y)}
        x2={hojdmattX}
        y2={r.Y(vansterUpplag.y)}
        text={`h = ${mm(geo.nockhojd)} mm`}
        lodrat
      />

      {/* Taklutning vid takfoten */}
      <g>
        <path
          d={`M ${r.X(vansterUpplag.x) + 46},${r.Y(vansterUpplag.y)} A 46 46 0 0 0 ${
            r.X(vansterUpplag.x) + 46 * Math.cos(lutningRad)
          },${r.Y(vansterUpplag.y) - 46 * Math.sin(lutningRad)}`}
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth={0.9}
        />
        <text
          x={r.X(vansterUpplag.x) + 54}
          y={r.Y(vansterUpplag.y) - 16}
          fontSize={11}
          fill="var(--text-secondary)"
          fontFamily="var(--font)"
        >
          {tal(lutningGrader, 0)}°
        </text>
      </g>

      {/* Invändiga fria mått */}
      {visaInnermatt &&
        resultat.innermatt.map((m) => (
          <Innermattlinje
            key={m.id}
            x1={r.X(m.fran.x)}
            y1={r.Y(m.fran.y)}
            x2={r.X(m.till.x)}
            y2={r.Y(m.till.y)}
            text={`${mm(m.varde)} mm`}
            vertikal={m.orientering === 'vertikal'}
            etikettUnder={m.etikettUnder ?? false}
          />
        ))}

      {/* Beteckningar */}
      {visaBeteckningar &&
        geo.stanger.map((s) => {
          const a = geo.noder[s.n1];
          const b = geo.noder[s.n2];
          const k = kontrollFor(s.id);
          const dx = r.X(b.x) - r.X(a.x);
          const dy = r.Y(b.y) - r.Y(a.y);
          const len = Math.hypot(dx, dy) || 1;
          // Etiketten läggs vid sidan av stången så att den inte döljs av virket.
          // Taksprånget får etiketten på ovansidan så att den inte hamnar över
          // upplagssymbolen.
          const sida = s.typ === 'taksprang' ? -1 : 1;
          const avstand =
            (Math.max((k?.dim.h ?? 145) / 1000 / 2, 0.05) * r.skala + 9) * sida;
          return (
            <text
              key={`t-${s.id}`}
              x={r.X((a.x + b.x) / 2) + (-dy / len) * avstand}
              y={r.Y((a.y + b.y) / 2) + (dx / len) * avstand + 3}
              textAnchor="middle"
              fontSize={9.5}
              fill="var(--text-primary)"
              fontFamily="var(--font)"
              stroke="var(--surface-1)"
              strokeWidth={2.6}
              paintOrder="stroke"
              style={{ pointerEvents: 'none' }}
            >
              {lage === 'utnyttjande' && k ? tal(k.utnyttjande, 2) : s.id}
            </text>
          );
        })}

      {/* Etikett för hovrad stång */}
      {hovradKontroll && hovradStang && (
        <g style={{ pointerEvents: 'none' }}>
          <rect
            x={12}
            y={10}
            width={430}
            height={34}
            rx={7}
            fill="var(--surface-1)"
            stroke="var(--border-stark)"
          />
          <text x={22} y={24} fontSize={12} fontWeight={600} fill="var(--text-primary)" fontFamily="var(--font)">
            {hovradStang.namn} · {STANGTYP_NAMN[hovradStang.typ]} · {hovradKontroll.dimension}{' '}
            {hovradKontroll.kvalitet} · L = {mm(hovradKontroll.langd)} mm
          </text>
          <text x={22} y={38} fontSize={11} fill="var(--text-secondary)" fontFamily="var(--font)">
            N = {tal(hovradKontroll.N, 1)} kN · M = {tal(hovradKontroll.M, 2)} kNm · V ={' '}
            {tal(hovradKontroll.V, 1)} kN · utnyttjande {tal(hovradKontroll.utnyttjande, 2)}
          </text>
        </g>
      )}
    </svg>
  );
}
