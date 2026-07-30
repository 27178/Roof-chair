/**
 * Geometrigeneratorer för olika takstolstyper.
 *
 * Varje generator returnerar noder och stänger i ett lokalt koordinatsystem
 * med origo i vänstra upplaget, x åt höger och y uppåt (meter).
 * Stängerna klassificeras så att laster och kontroller kan fördelas rätt.
 */

export type Konstruktionsmodell =
  | 'fackverk'
  | 'ramverk'
  | 'sax'
  | 'parallell'
  | 'pulpet'
  | 'samverkan';

export type StangTyp =
  | 'overram'
  | 'underram'
  | 'diagonal'
  | 'stolpe'
  | 'hanbjalke'
  | 'stodben'
  | 'taksprang';

export const STANGTYP_NAMN: Record<StangTyp, string> = {
  overram: 'Överram',
  underram: 'Underram',
  diagonal: 'Diagonal',
  stolpe: 'Stolpe',
  hanbjalke: 'Hanbjälke',
  stodben: 'Stödben',
  taksprang: 'Taksprång',
};

export interface ModellInfo {
  id: Konstruktionsmodell;
  namn: string;
  beskrivning: string;
  /** Vanligt spännviddsintervall i meter */
  spannviddsintervall: [number, number];
  /** Typiskt användningsområde */
  anvandning: string;
  /** Verkningssätt: fackverk (ledade knutar) eller ram (styva knutar) */
  verkningssatt: string;
}

export const MODELLER: ModellInfo[] = [
  {
    id: 'fackverk',
    namn: 'Fackverkstakstol (W-takstol)',
    beskrivning:
      'Ramverk av över- och underram med diagonaler, normalt sammanfogade med spikplåtar. Diagonalerna tar last som drag- och tryckkrafter vilket ger små virkesdimensioner.',
    spannviddsintervall: [4, 16],
    anvandning: 'Standardtakstol för småhus och hallar med kallvind.',
    verkningssatt: 'Fackverk – ledade diagonaler, kontinuerliga ramar',
  },
  {
    id: 'ramverk',
    namn: 'Ramverkstakstol med hanbjälke',
    beskrivning:
      'Sparrar med underram och hanbjälke där knutpunkterna är momentstyva. Ger fri vind utan diagonaler men kräver grövre virke eftersom sparren tar böjmoment.',
    spannviddsintervall: [3, 9],
    anvandning: 'Mindre byggnader, tillbyggnader och konstruktioner med krav på fri vind.',
    verkningssatt: 'Ramverk – momentstyva knutpunkter',
  },
  {
    id: 'samverkan',
    namn: 'Samverkanstakstol med stödben (rumstakstol)',
    beskrivning:
      'Kombinerad ram- och fackverksverkan. Stödben och hanbjälke bildar ett rum på vinden medan diagonalerna ovanför hanbjälken avlastar sparren.',
    spannviddsintervall: [5, 12],
    anvandning: 'Inredd vind, 1½-planshus.',
    verkningssatt: 'Samverkan – styv ram i rumsdelen, fackverk ovanför',
  },
  {
    id: 'sax',
    namn: 'Saxtakstol',
    beskrivning:
      'Underramen lutar uppåt mot mitten vilket ger ett välvt innertak. Ger horisontella upplagskrafter och större nedböjning än en vanlig fackverkstakstol.',
    spannviddsintervall: [5, 14],
    anvandning: 'Rum med snedtak och öppen takfot, kyrkor och samlingslokaler.',
    verkningssatt: 'Fackverk med lutande underram',
  },
  {
    id: 'parallell',
    namn: 'Parallelltakstol (parallellfackverk)',
    beskrivning:
      'Över- och underram med samma lutning och konstant konstruktionshöjd. Ger plant innertak parallellt med taket och plats för isolering.',
    spannviddsintervall: [4, 20],
    anvandning: 'Låglutande tak, hallar, tillbyggnader med snedtak.',
    verkningssatt: 'Fackverk med parallella ramar',
  },
  {
    id: 'pulpet',
    namn: 'Pulpettakstol',
    beskrivning:
      'Enkelsluttande takstol med horisontell underram. Används vid enkelsidigt fall, ofta mot en högre byggnadsdel.',
    spannviddsintervall: [3, 12],
    anvandning: 'Uthus, garage, tillbyggnader och skärmtak.',
    verkningssatt: 'Fackverk med enkelsidig lutning',
  },
];

export function modellInfo(id: Konstruktionsmodell): ModellInfo {
  const m = MODELLER.find((x) => x.id === id);
  if (!m) throw new Error(`Okänd konstruktionsmodell: ${id}`);
  return m;
}

export interface Nod {
  x: number;
  y: number;
  etikett?: string;
}

export interface Stang {
  id: string;
  namn: string;
  typ: StangTyp;
  n1: number;
  n2: number;
  /** Ledad i båda ändar (fackverksstång) */
  ledad: boolean;
  /** Belastad av taklast; anger vilket takfall stången tillhör */
  takfall?: 'vanster' | 'hoger';
  /** Belastad av bjälklagslast (innertak och nyttig last) */
  bjalklag?: boolean;
  /**
   * Antal likadana stänger i takstolen (t.ex. dubbla diagonaler).
   * Används inte i beräkningen men visas i materiallistan.
   */
  antal: number;
}

export interface TakstolGeometri {
  modell: Konstruktionsmodell;
  noder: Nod[];
  stanger: Stang[];
  /** Nodindex för upplagen (vänster, höger) */
  upplagsnoder: [number, number];
  spannvidd: number;
  nockhojd: number;
  /** Total höjd inklusive eventuell taksprångsdel under upplagen */
  minY: number;
  maxY: number;
}

export interface GeometriParametrar {
  modell: Konstruktionsmodell;
  /** Spännvidd mellan upplagens centrum, m */
  spannvidd: number;
  /** Taklutning vänster takfall, grader */
  taklutning: number;
  /** Taklutning höger takfall, grader (samma som vänster vid symmetrisk takstol) */
  taklutningHoger: number;
  /** Horisontellt taksprång utanför upplaget, m */
  taksprang: number;
  /** Antal diagonalpar per halva (fackverk, parallell, pulpet) */
  antalFack: number;
  /** Hanbjälkens höjd över underramen, m (ramverk och samverkan) */
  hanbjalkeHojd: number;
  /** Stödbenens avstånd från upplaget, m (samverkan) */
  stodbenAvstand: number;
  /** Stödbenens höjd, m (samverkan) */
  stodbenHojd: number;
  /** Underramens lutning, grader (saxtakstol) */
  saxLutning: number;
  /** Konstruktionshöjd vinkelrätt ramarna, m (parallelltakstol) */
  parallellHojd: number;
}

export const STANDARDPARAMETRAR: GeometriParametrar = {
  modell: 'fackverk',
  spannvidd: 9,
  taklutning: 27,
  taklutningHoger: 27,
  taksprang: 0.4,
  antalFack: 2,
  hanbjalkeHojd: 2.4,
  stodbenAvstand: 1.2,
  stodbenHojd: 1.8,
  saxLutning: 14,
  parallellHojd: 0.6,
};

const rad = (grader: number) => (grader * Math.PI) / 180;

let stangRaknare = 0;
function nyStang(
  typ: StangTyp,
  namn: string,
  n1: number,
  n2: number,
  ledad: boolean,
  extra: Partial<Stang> = {},
): Stang {
  stangRaknare += 1;
  return { id: `S${stangRaknare}`, namn, typ, n1, n2, ledad, antal: 1, ...extra };
}

/** Lägger till taksprångselement utanför upplagen. */
function laggTillTaksprang(
  noder: Nod[],
  stanger: Stang[],
  p: GeometriParametrar,
  vansterNod: number,
  hogerNod: number,
) {
  if (p.taksprang <= 0) return;
  const dyV = p.taksprang * Math.tan(rad(p.taklutning));
  const dyH = p.taksprang * Math.tan(rad(p.taklutningHoger));

  const v = noder[vansterNod];
  noder.push({ x: v.x - p.taksprang, y: v.y - dyV, etikett: 'Taksprång v' });
  stanger.push(
    nyStang('taksprang', 'Taksprång vänster', noder.length - 1, vansterNod, false, {
      takfall: 'vanster',
    }),
  );

  const h = noder[hogerNod];
  noder.push({ x: h.x + p.taksprang, y: h.y - dyH, etikett: 'Taksprång h' });
  stanger.push(
    nyStang('taksprang', 'Taksprång höger', hogerNod, noder.length - 1, false, {
      takfall: 'hoger',
    }),
  );
}

function avsluta(
  modell: Konstruktionsmodell,
  noder: Nod[],
  stanger: Stang[],
  upplagsnoder: [number, number],
  spannvidd: number,
  nockhojd: number,
): TakstolGeometri {
  return {
    modell,
    noder,
    stanger,
    upplagsnoder,
    spannvidd,
    nockhojd,
    minY: Math.min(...noder.map((n) => n.y)),
    maxY: Math.max(...noder.map((n) => n.y)),
  };
}

/**
 * W-fackverk (fink). Överramen delas i lika delar och underramen får
 * knutpunkter mellan dem så att diagonalerna bildar ett W-mönster.
 */
function byggFackverk(p: GeometriParametrar): TakstolGeometri {
  const L = p.spannvidd;
  const halv = L / 2;
  const H = halv * Math.tan(rad(p.taklutning));
  const m = Math.max(1, Math.min(4, Math.round(p.antalFack)));

  const noder: Nod[] = [
    { x: 0, y: 0, etikett: 'A' },
    { x: L, y: 0, etikett: 'B' },
    { x: halv, y: H, etikett: 'Nock' },
  ];
  const stanger: Stang[] = [];

  // Överramens knutpunkter per halva
  const toppFraktioner: number[] = [];
  for (let j = 1; j < m; j++) toppFraktioner.push(j / m);
  // Underramens knutpunkter per halva
  const bottenFraktioner: number[] = [];
  for (let k = 1; k <= m - 1; k++) bottenFraktioner.push((2 * k) / (2 * m - 1));

  const bygghalva = (sida: 'vanster' | 'hoger') => {
    const tecken = sida === 'vanster' ? 1 : -1;
    const bas = sida === 'vanster' ? 0 : L;
    const eaveNod = sida === 'vanster' ? 0 : 1;

    const toppNoder: number[] = [eaveNod];
    for (const f of toppFraktioner) {
      noder.push({ x: bas + tecken * f * halv, y: f * H });
      toppNoder.push(noder.length - 1);
    }
    toppNoder.push(2); // nock

    const bottenNoder: number[] = [eaveNod];
    for (const f of bottenFraktioner) {
      noder.push({ x: bas + tecken * f * halv, y: 0 });
      bottenNoder.push(noder.length - 1);
    }

    // Överram i segment (kontinuerlig – ej ledad mellan segmenten)
    for (let i = 0; i < toppNoder.length - 1; i++) {
      stanger.push(
        nyStang(
          'overram',
          `Överram ${sida === 'vanster' ? 'v' : 'h'}${i + 1}`,
          toppNoder[i],
          toppNoder[i + 1],
          false,
          { takfall: sida },
        ),
      );
    }

    // Underram i segment fram till halva spännvidden
    const mittNodIndex = (() => {
      if (sida === 'vanster') {
        noder.push({ x: halv, y: 0, etikett: 'Mitt' });
        return noder.length - 1;
      }
      return noder.findIndex((n) => n.etikett === 'Mitt');
    })();

    const underramKedja = [...bottenNoder, mittNodIndex];
    for (let i = 0; i < underramKedja.length - 1; i++) {
      stanger.push(
        nyStang(
          'underram',
          `Underram ${sida === 'vanster' ? 'v' : 'h'}${i + 1}`,
          underramKedja[i],
          underramKedja[i + 1],
          false,
          { bjalklag: true },
        ),
      );
    }

    // Diagonaler i W-mönster: upp till överram, ner till underram, ...
    let d = 1;
    for (let i = 0; i < m - 1; i++) {
      stanger.push(
        nyStang(
          'diagonal',
          `Diagonal ${sida === 'vanster' ? 'v' : 'h'}${d++}`,
          bottenNoder[i],
          toppNoder[i + 1],
          true,
        ),
      );
      stanger.push(
        nyStang(
          'diagonal',
          `Diagonal ${sida === 'vanster' ? 'v' : 'h'}${d++}`,
          toppNoder[i + 1],
          bottenNoder[i + 1],
          true,
        ),
      );
    }
    // Sista diagonalen upp mot nock
    stanger.push(
      nyStang(
        'diagonal',
        `Diagonal ${sida === 'vanster' ? 'v' : 'h'}${d++}`,
        bottenNoder[bottenNoder.length - 1],
        2,
        true,
      ),
    );
  };

  bygghalva('vanster');
  bygghalva('hoger');
  laggTillTaksprang(noder, stanger, p, 0, 1);

  return avsluta('fackverk', noder, stanger, [0, 1], L, H);
}

/** Ramverkstakstol: sparrar, underram och hanbjälke med momentstyva knutar. */
function byggRamverk(p: GeometriParametrar): TakstolGeometri {
  const L = p.spannvidd;
  const halv = L / 2;
  const H = halv * Math.tan(rad(p.taklutning));
  const hHan = Math.min(p.hanbjalkeHojd, H * 0.85);
  // Hanbjälkens anslutningspunkter på sparrarna
  const xHan = hHan / Math.tan(rad(p.taklutning));

  const noder: Nod[] = [
    { x: 0, y: 0, etikett: 'A' },
    { x: L, y: 0, etikett: 'B' },
    { x: halv, y: H, etikett: 'Nock' },
    { x: xHan, y: hHan },
    { x: L - xHan, y: hHan },
    { x: halv, y: 0, etikett: 'Mitt' },
  ];

  const stanger: Stang[] = [
    nyStang('overram', 'Sparre v1', 0, 3, false, { takfall: 'vanster' }),
    nyStang('overram', 'Sparre v2', 3, 2, false, { takfall: 'vanster' }),
    nyStang('overram', 'Sparre h2', 2, 4, false, { takfall: 'hoger' }),
    nyStang('overram', 'Sparre h1', 4, 1, false, { takfall: 'hoger' }),
    nyStang('underram', 'Underram v', 0, 5, false, { bjalklag: true }),
    nyStang('underram', 'Underram h', 5, 1, false, { bjalklag: true }),
    nyStang('hanbjalke', 'Hanbjälke', 3, 4, true),
  ];

  laggTillTaksprang(noder, stanger, p, 0, 1);
  return avsluta('ramverk', noder, stanger, [0, 1], L, H);
}

/** Samverkanstakstol med stödben – ger ett inrett rum på vinden. */
function byggSamverkan(p: GeometriParametrar): TakstolGeometri {
  const L = p.spannvidd;
  const halv = L / 2;
  const H = halv * Math.tan(rad(p.taklutning));
  const a = Math.min(Math.max(p.stodbenAvstand, 0.3), halv - 0.5);
  const hStod = Math.min(p.stodbenHojd, H * 0.8);
  const hHan = Math.min(Math.max(p.hanbjalkeHojd, hStod + 0.2), H * 0.9);
  const xStodTopp = a + hStod / Math.tan(rad(p.taklutning));
  const xHan = hHan / Math.tan(rad(p.taklutning));

  const noder: Nod[] = [
    { x: 0, y: 0, etikett: 'A' },
    { x: L, y: 0, etikett: 'B' },
    { x: halv, y: H, etikett: 'Nock' },
    { x: a, y: 0 }, // 3 stödbensfot v
    { x: L - a, y: 0 }, // 4 stödbensfot h
    { x: xStodTopp, y: hStod }, // 5 stödbenstopp v
    { x: L - xStodTopp, y: hStod }, // 6 stödbenstopp h
    { x: xHan, y: hHan }, // 7 hanbjälke v
    { x: L - xHan, y: hHan }, // 8 hanbjälke h
    { x: halv, y: 0, etikett: 'Mitt' }, // 9
  ];

  const stanger: Stang[] = [
    nyStang('overram', 'Sparre v1', 0, 5, false, { takfall: 'vanster' }),
    nyStang('overram', 'Sparre v2', 5, 7, false, { takfall: 'vanster' }),
    nyStang('overram', 'Sparre v3', 7, 2, false, { takfall: 'vanster' }),
    nyStang('overram', 'Sparre h3', 2, 8, false, { takfall: 'hoger' }),
    nyStang('overram', 'Sparre h2', 8, 6, false, { takfall: 'hoger' }),
    nyStang('overram', 'Sparre h1', 6, 1, false, { takfall: 'hoger' }),
    nyStang('underram', 'Underram v1', 0, 3, false, { bjalklag: true }),
    nyStang('underram', 'Underram v2', 3, 9, false, { bjalklag: true }),
    nyStang('underram', 'Underram h2', 9, 4, false, { bjalklag: true }),
    nyStang('underram', 'Underram h1', 4, 1, false, { bjalklag: true }),
    nyStang('stodben', 'Stödben v', 3, 5, false),
    nyStang('stodben', 'Stödben h', 4, 6, false),
    nyStang('hanbjalke', 'Hanbjälke', 7, 8, false),
    nyStang('diagonal', 'Diagonal v', 5, 7, true),
    nyStang('diagonal', 'Diagonal h', 6, 8, true),
  ];

  laggTillTaksprang(noder, stanger, p, 0, 1);
  return avsluta('samverkan', noder, stanger, [0, 1], L, H);
}

/** Saxtakstol – underramen lutar uppåt mot mitten. */
function byggSax(p: GeometriParametrar): TakstolGeometri {
  const L = p.spannvidd;
  const halv = L / 2;
  const H = halv * Math.tan(rad(p.taklutning));
  const lutUnder = Math.min(p.saxLutning, p.taklutning - 5);
  const hUnder = halv * Math.tan(rad(Math.max(lutUnder, 2)));

  const noder: Nod[] = [
    { x: 0, y: 0, etikett: 'A' },
    { x: L, y: 0, etikett: 'B' },
    { x: halv, y: H, etikett: 'Nock' },
    { x: halv, y: hUnder, etikett: 'Underramens topp' },
    { x: halv / 2, y: H / 2 }, // 4 överram v mitt
    { x: L - halv / 2, y: H / 2 }, // 5 överram h mitt
    { x: halv / 2, y: hUnder / 2 }, // 6 underram v mitt
    { x: L - halv / 2, y: hUnder / 2 }, // 7 underram h mitt
  ];

  const stanger: Stang[] = [
    nyStang('overram', 'Överram v1', 0, 4, false, { takfall: 'vanster' }),
    nyStang('overram', 'Överram v2', 4, 2, false, { takfall: 'vanster' }),
    nyStang('overram', 'Överram h2', 2, 5, false, { takfall: 'hoger' }),
    nyStang('overram', 'Överram h1', 5, 1, false, { takfall: 'hoger' }),
    nyStang('underram', 'Underram v1', 0, 6, false, { bjalklag: true }),
    nyStang('underram', 'Underram v2', 6, 3, false, { bjalklag: true }),
    nyStang('underram', 'Underram h2', 3, 7, false, { bjalklag: true }),
    nyStang('underram', 'Underram h1', 7, 1, false, { bjalklag: true }),
    nyStang('stolpe', 'Nockstolpe', 3, 2, true),
    nyStang('diagonal', 'Diagonal v', 6, 2, true),
    nyStang('diagonal', 'Diagonal h', 7, 2, true),
    nyStang('diagonal', 'Diagonal v2', 4, 3, true),
    nyStang('diagonal', 'Diagonal h2', 5, 3, true),
  ];

  laggTillTaksprang(noder, stanger, p, 0, 1);
  return avsluta('sax', noder, stanger, [0, 1], L, H);
}

/** Parallelltakstol – över- och underram med samma lutning. */
function byggParallell(p: GeometriParametrar): TakstolGeometri {
  const L = p.spannvidd;
  const alfa = rad(p.taklutning);
  const H = L * Math.tan(alfa);
  const hK = Math.max(p.parallellHojd, 0.2);
  const m = Math.max(2, Math.min(8, Math.round(p.antalFack * 2)));

  const noder: Nod[] = [];
  const overram: number[] = [];
  const underram: number[] = [];

  for (let i = 0; i <= m; i++) {
    const x = (i / m) * L;
    const yTop = x * Math.tan(alfa);
    noder.push({ x, y: yTop });
    overram.push(noder.length - 1);
    noder.push({ x, y: yTop - hK });
    underram.push(noder.length - 1);
  }

  const stanger: Stang[] = [];
  for (let i = 0; i < m; i++) {
    stanger.push(
      nyStang('overram', `Överram ${i + 1}`, overram[i], overram[i + 1], false, {
        takfall: 'vanster',
      }),
    );
    stanger.push(
      nyStang('underram', `Underram ${i + 1}`, underram[i], underram[i + 1], false, {
        bjalklag: true,
      }),
    );
  }
  for (let i = 0; i <= m; i++) {
    stanger.push(nyStang('stolpe', `Stolpe ${i + 1}`, underram[i], overram[i], true));
  }
  for (let i = 0; i < m; i++) {
    // Diagonaler i N-mönster, vända mot mitten
    if (i < m / 2) {
      stanger.push(nyStang('diagonal', `Diagonal ${i + 1}`, underram[i], overram[i + 1], true));
    } else {
      stanger.push(nyStang('diagonal', `Diagonal ${i + 1}`, overram[i], underram[i + 1], true));
    }
  }

  // Upplag i under-/överramens ändar
  const vansterUpplag = underram[0];
  const hogerUpplag = underram[m];

  return avsluta('parallell', noder, stanger, [vansterUpplag, hogerUpplag], L, H);
}

/** Pulpettakstol – enkelsidig lutning med horisontell underram. */
function byggPulpet(p: GeometriParametrar): TakstolGeometri {
  const L = p.spannvidd;
  const alfa = rad(p.taklutning);
  const H = L * Math.tan(alfa);
  const m = Math.max(2, Math.min(8, Math.round(p.antalFack * 2)));

  const noder: Nod[] = [];
  const overram: number[] = [];
  const underram: number[] = [];
  for (let i = 0; i <= m; i++) {
    const x = (i / m) * L;
    noder.push({ x, y: x * Math.tan(alfa) });
    overram.push(noder.length - 1);
    noder.push({ x, y: 0 });
    underram.push(noder.length - 1);
  }

  const stanger: Stang[] = [];
  for (let i = 0; i < m; i++) {
    stanger.push(
      nyStang('overram', `Överram ${i + 1}`, overram[i], overram[i + 1], false, {
        takfall: 'vanster',
      }),
    );
    stanger.push(
      nyStang('underram', `Underram ${i + 1}`, underram[i], underram[i + 1], false, {
        bjalklag: true,
      }),
    );
  }
  // Stolpar och diagonaler (första noden sammanfaller i takfoten)
  for (let i = 1; i <= m; i++) {
    stanger.push(nyStang('stolpe', `Stolpe ${i}`, underram[i], overram[i], true));
  }
  for (let i = 0; i < m; i++) {
    stanger.push(nyStang('diagonal', `Diagonal ${i + 1}`, underram[i], overram[i + 1], true));
  }

  return avsluta('pulpet', noder, stanger, [underram[0], underram[m]], L, H);
}

export function byggGeometri(p: GeometriParametrar): TakstolGeometri {
  stangRaknare = 0;
  switch (p.modell) {
    case 'fackverk':
      return byggFackverk(p);
    case 'ramverk':
      return byggRamverk(p);
    case 'samverkan':
      return byggSamverkan(p);
    case 'sax':
      return byggSax(p);
    case 'parallell':
      return byggParallell(p);
    case 'pulpet':
      return byggPulpet(p);
  }
}

/** Stångens längd i meter. */
export function stangLangd(g: TakstolGeometri, s: Stang): number {
  const a = g.noder[s.n1];
  const b = g.noder[s.n2];
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Stångens lutning mot horisontalplanet i grader. */
export function stangLutning(g: TakstolGeometri, s: Stang): number {
  const a = g.noder[s.n1];
  const b = g.noder[s.n2];
  return (Math.atan2(Math.abs(b.y - a.y), Math.abs(b.x - a.x)) * 180) / Math.PI;
}

/** Total virkeslängd per stångtyp, m. */
export function virkeslangder(g: TakstolGeometri): Record<StangTyp, number> {
  const summa = {
    overram: 0,
    underram: 0,
    diagonal: 0,
    stolpe: 0,
    hanbjalke: 0,
    stodben: 0,
    taksprang: 0,
  } as Record<StangTyp, number>;
  for (const s of g.stanger) summa[s.typ] += stangLangd(g, s) * s.antal;
  return summa;
}
