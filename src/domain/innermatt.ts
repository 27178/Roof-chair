/**
 * Invändiga fria mått i takstolen.
 *
 * Måtten är ljusa mått mellan virkets ytor, inte mellan centrumlinjerna:
 * knutpunkterna i beräkningsmodellen ligger i stängernas centrumlinjer, så
 * halva tvärsnittshöjden dras bort på varje begränsande stång. Måtten avser
 * stommen och innehåller alltså inte golvbeläggning, undertak eller isolering.
 */

import type { GeometriParametrar, StangTyp, TakstolGeometri } from './geometri';

export interface Innermatt {
  id: string;
  etikett: string;
  /** Fritt mått i meter */
  varde: number;
  /** Startpunkt i modellens koordinatsystem (m) */
  fran: { x: number; y: number };
  /** Slutpunkt i modellens koordinatsystem (m) */
  till: { x: number; y: number };
  orientering: 'horisontell' | 'vertikal';
  kommentar?: string;
}

/** Tvärsnittshöjd i meter för en stångtyp. */
export type HojdUppslag = (typ: StangTyp) => number;

const rad = (grader: number) => (grader * Math.PI) / 180;

/** Minsta mått som är meningsfullt att redovisa. */
const MINSTA_MATT = 0.15;

/** Ståhöjd som används för att redovisa användbar bredd på vinden. */
export const STAHOJD = 1.9;

/**
 * Horisontellt läge för sparrens undersida på höjden y, räknat från vänster
 * takfot. Sparren lutar α och har tvärsnittshöjden h, vilket gör att
 * undersidan skjuter in (h/2)/sin α horisontellt jämfört med centrumlinjen.
 */
function sparrensUndersidaX(y: number, alfaGrader: number, hSparre: number): number {
  const a = rad(alfaGrader);
  return y / Math.tan(a) + hSparre / 2 / Math.sin(a);
}

/** Fri bredd mellan sparrarnas undersidor på höjden y. */
function friBredd(y: number, L: number, alfaGrader: number, hSparre: number): number {
  return L - 2 * sparrensUndersidaX(y, alfaGrader, hSparre);
}

/** Sparrens undersida i nock, uttryckt som höjd över underramens centrumlinje. */
function nockensUndersida(H: number, alfaGrader: number, hSparre: number): number {
  return H - hSparre / 2 / Math.cos(rad(alfaGrader));
}

function vertikaltMatt(
  id: string,
  etikett: string,
  x: number,
  yFran: number,
  yTill: number,
  kommentar?: string,
): Innermatt | null {
  const varde = yTill - yFran;
  if (!Number.isFinite(varde) || varde < MINSTA_MATT) return null;
  return {
    id,
    etikett,
    varde,
    fran: { x, y: yFran },
    till: { x, y: yTill },
    orientering: 'vertikal',
    kommentar,
  };
}

function horisontelltMatt(
  id: string,
  etikett: string,
  y: number,
  xFran: number,
  xTill: number,
  kommentar?: string,
): Innermatt | null {
  const varde = xTill - xFran;
  if (!Number.isFinite(varde) || varde < MINSTA_MATT) return null;
  return {
    id,
    etikett,
    varde,
    fran: { x: xFran, y },
    till: { x: xTill, y },
    orientering: 'horisontell',
    kommentar,
  };
}

/**
 * Räknar fram de invändiga mått som är intressanta för respektive
 * konstruktionsmodell.
 */
export function beraknaInnermatt(
  geo: TakstolGeometri,
  p: GeometriParametrar,
  hojd: HojdUppslag,
): Innermatt[] {
  const L = geo.spannvidd;
  const halv = L / 2;
  const H = geo.nockhojd;
  const alfa = p.taklutning;
  const hSparre = hojd('overram');
  const hUnderram = hojd('underram');
  // Golvets ovansida ligger på underramens ovansida
  const golv = hUnderram / 2;
  const matt: (Innermatt | null)[] = [];

  const laggTillStahojdsbredd = (kommentar?: string) => {
    const y = golv + STAHOJD;
    const bredd = friBredd(y, L, alfa, hSparre);
    if (bredd < MINSTA_MATT) return;
    const x1 = sparrensUndersidaX(y, alfa, hSparre);
    matt.push(
      horisontelltMatt(
        'stahojdsbredd',
        `Bredd vid ${STAHOJD.toFixed(2).replace('.', ',')} m ståhöjd`,
        y,
        x1,
        L - x1,
        kommentar,
      ),
    );
  };

  switch (geo.modell) {
    case 'fackverk': {
      matt.push(
        vertikaltMatt(
          'nockhojd',
          'Fri höjd i nock',
          halv,
          golv,
          nockensUndersida(H, alfa, hSparre),
          'Diagonalerna korsar vindsutrymmet och begränsar den användbara ytan.',
        ),
      );
      laggTillStahojdsbredd('Måttet avser fritt mellan sparrarna, utan hänsyn till diagonalerna.');
      break;
    }

    case 'ramverk': {
      const hHan = hanbjalkensHojd(geo);
      const hHanbjalke = hojd('hanbjalke');
      const tak = hHan - hHanbjalke / 2;
      matt.push(
        vertikaltMatt('rumshojd', 'Fri höjd under hanbjälke', halv, golv, tak),
        horisontelltMatt(
          'bredd_hanbjalke',
          'Fri bredd vid hanbjälken',
          tak,
          sparrensUndersidaX(tak, alfa, hSparre),
          L - sparrensUndersidaX(tak, alfa, hSparre),
        ),
        horisontelltMatt(
          'bredd_golv',
          'Fri bredd vid golv',
          golv,
          sparrensUndersidaX(golv, alfa, hSparre),
          L - sparrensUndersidaX(golv, alfa, hSparre),
        ),
      );
      break;
    }

    case 'samverkan': {
      const hHan = hanbjalkensHojd(geo);
      const hHanbjalke = hojd('hanbjalke');
      const hStodben = hojd('stodben');
      const stodbenX = stodbenensX(geo);
      const stodbenY = stodbenensY(geo);
      const tak = hHan - hHanbjalke / 2;

      matt.push(
        horisontelltMatt(
          'rumsbredd',
          'Rumsbredd mellan stödben',
          golv + 0.25,
          stodbenX + hStodben / 2,
          L - stodbenX - hStodben / 2,
        ),
        vertikaltMatt('rumshojd', 'Fri höjd under hanbjälke', halv, golv, tak),
        // Måttlinjen dras en bit in i rummet så den inte hamnar ovanpå stödbenet
        vertikaltMatt(
          'knavagg',
          'Knäväggshöjd vid stödben',
          stodbenX + hStodben / 2 + 0.35,
          golv,
          stodbenY - hSparre / 2 / Math.cos(rad(alfa)),
        ),
        horisontelltMatt(
          'bredd_hanbjalke',
          'Fri bredd vid hanbjälken',
          tak,
          sparrensUndersidaX(tak, alfa, hSparre),
          L - sparrensUndersidaX(tak, alfa, hSparre),
        ),
      );
      break;
    }

    case 'sax': {
      const apex = geo.noder.find((n) => n.etikett === 'Underramens topp');
      const undertakY = (apex?.y ?? 0) + hUnderram / 2;
      matt.push(
        vertikaltMatt(
          'nockhojd',
          'Fri höjd i nock',
          halv,
          undertakY,
          nockensUndersida(H, alfa, hSparre),
          'Mätt från underramens ovansida i mitten upp till sparrens undersida.',
        ),
        vertikaltMatt(
          'innertakshojd',
          'Innertakets lyft mot mitten',
          halv * 0.5,
          hUnderram / 2,
          (apex?.y ?? 0) - hUnderram / 2,
          'Höjdskillnad mellan underramen vid upplaget och i mitten.',
        ),
      );
      break;
    }

    case 'parallell': {
      // Ramarna är parallella, så det fria måttet mäts vinkelrätt mot dem
      const hK = Math.max(p.parallellHojd, 0.2);
      const fritt = hK * Math.cos(rad(alfa)) - hSparre / 2 - hUnderram / 2;
      if (fritt >= MINSTA_MATT) {
        const x = halv * 0.5;
        const yUnder = x * Math.tan(rad(alfa));
        matt.push({
          id: 'konstruktionshojd',
          etikett: 'Fritt mellan ramarna',
          varde: fritt,
          fran: { x, y: yUnder + hUnderram / 2 },
          till: { x, y: yUnder + hK - hSparre / 2 },
          orientering: 'vertikal',
          kommentar: 'Vinkelrätt mot ramarna, det utrymme som kan isoleras.',
        });
      }
      // Underramens centrumlinje i nock ligger konstruktionshöjden under nocken
      const underramINock = H - hK;
      matt.push(
        vertikaltMatt(
          'innertak_nock',
          'Innertakets höjd i nock',
          halv,
          0,
          underramINock - hUnderram / 2,
          'Underramens undersida i nock, räknat från upplagsnivån.',
        ),
      );
      break;
    }

    case 'pulpet': {
      // Mät strax innanför den höga sidan så måttet inte hamnar i stolpen
      const xMat = L - 0.35;
      const takUndersida =
        xMat * Math.tan(rad(alfa)) - hSparre / 2 / Math.cos(rad(alfa));
      matt.push(vertikaltMatt('hojd_hog', 'Fri höjd vid höga sidan', xMat, golv, takUndersida));
      // Bredden där ståhöjd uppnås, mätt från den höga sidan
      const yMal = golv + STAHOJD;
      const xMal = yMal / Math.tan(rad(alfa)) + hSparre / 2 / Math.sin(rad(alfa));
      if (L - xMal >= MINSTA_MATT) {
        matt.push(
          horisontelltMatt(
            'stahojdsbredd',
            `Bredd vid ${STAHOJD.toFixed(2).replace('.', ',')} m ståhöjd`,
            yMal,
            xMal,
            L,
          ),
        );
      }
      break;
    }
  }

  return matt.filter((m): m is Innermatt => m !== null);
}

/** Hanbjälkens höjd över underramen, avläst ur geometrin. */
function hanbjalkensHojd(geo: TakstolGeometri): number {
  const hanbjalke = geo.stanger.find((s) => s.typ === 'hanbjalke');
  if (!hanbjalke) return 0;
  return geo.noder[hanbjalke.n1].y;
}

/** Stödbenets horisontella läge, avläst ur geometrin. */
function stodbenensX(geo: TakstolGeometri): number {
  const stodben = geo.stanger.find((s) => s.typ === 'stodben');
  if (!stodben) return 0;
  return geo.noder[stodben.n1].x;
}

/** Stödbenets övre nod, avläst ur geometrin. */
function stodbenensY(geo: TakstolGeometri): number {
  const stodben = geo.stanger.find((s) => s.typ === 'stodben');
  if (!stodben) return 0;
  return Math.max(geo.noder[stodben.n1].y, geo.noder[stodben.n2].y);
}
