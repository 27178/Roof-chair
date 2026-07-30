# Arbetssätt

## Branchstrategi: trunk based development

Projektet använder **trunk based development**. Det innebär i praktiken:

- `master` är trunk och ska alltid gå att bygga och släppa. Allt arbete utgår
  från den senaste versionen av trunk.
- Arbete sker i **kortlivade branchar** som lever timmar till ett par dagar, inte
  veckor. Namnge dem efter uppgiften, till exempel
  `claude/takstol-calculator-app-vc9gn5`.
- **Små, kompletta commits.** Varje commit ska lämna trunk i ett fungerande
  läge – tester gröna, typkontroll ren och bygget utan fel. Dela hellre upp
  arbetet i flera commits än att samla ihop en stor ändring.
- **Integrera ofta.** Merga tillbaka till trunk så snart en avgränsad del är
  klar och testad, i stället för att låta branchen ligga och driva isär.
- **Inga långlivade utvecklings- eller släppgrenar.** Halvfärdig funktionalitet
  hålls tillbaka i koden, inte i en branch – exempelvis genom att en ny
  konstruktionsmodell inte läggs till i listan `MODELLER` förrän den är klar.
- **Rebasa i stället för att merga in trunk** i den egna branchen, så att
  historiken förblir rak och lätt att följa.

### Innan du pushar

```bash
npm test           # enhetstester
npm run build      # typkontroll och produktionsbygge
```

Båda ska vara gröna. En commit som gör trunk röd rullas tillbaka i stället för
att lagas i efterhand.

## Kodprinciper

- **Beräkningen är skild från gränssnittet.** Allt i `src/domain/` är rena
  funktioner utan beroende på React, och kan därför testas direkt. Gränssnittet i
  `src/components/` innehåller ingen dimensionering.
- **Normvärden ska vara spårbara.** Varje konstant som kommer från en standard
  ska ha en kommentar med standardens beteckning och avsnitt eller tabell.
  Exempel: `kmod` enligt SS-EN 1995-1-1 tabell 3.1.
- **Enheter i signaturer.** Ange enheten i kommentaren till varje fält och
  parameter. Beräkningskärnan använder kN, m, kNm internt och MPa, mm för
  materialdata – blanda inte utan att konvertera explicit.
- **Svenska i domänkoden.** Typer, funktioner och variabler namnges på svenska
  med branschens termer (`overram`, `hanbjalke`, `knacklangd`) så att koden går
  att läsa mot en konstruktionshandbok.
- **Nya kontroller ska testas mot ett känt värde** – ett analytiskt fall, ett
  räkneexempel ur en handbok eller en handräkning som redovisas i testet.

## Lägga till en ny takstolstyp

1. Lägg till id:t i `Konstruktionsmodell` och en post i `MODELLER` i
   `src/domain/geometri.ts`.
2. Skriv en generatorfunktion som returnerar noder och stänger, och koppla in den
   i `byggGeometri`.
3. Märk stängerna rätt: `takfall` för dem som bär taklast, `bjalklag` för dem som
   bär innertak och nyttig last, och `ledad` för fackverksstänger.
4. Lägg till eventuella nya geometriparametrar i `GeometriParametrar` och
   `STANDARDPARAMETRAR`, och visa dem i `Indatapanel` för just den modellen.
5. Testerna i `analys.test.ts` går igenom alla modeller i `MODELLER` automatiskt:
   geometrin ska hänga ihop och modellen ska gå att autodimensionera.

## Uppdatera normvärden

När Boverkets konstruktionsregler ändras behöver normalt bara två filer röras:

- `src/domain/loads.ts` – snözoner, formfaktorer, ψ-faktorer, γd och
  lastkombinationer.
- `src/domain/materials.ts` – hållfasthetsklasser, kmod, kdef och γM.

Uppdatera kommentarens hänvisning till föreskriften samtidigt som värdet, och
komplettera testerna i `analys.test.ts` som låser fast de värden som ändrats.
