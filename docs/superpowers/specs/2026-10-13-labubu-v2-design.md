# Labubu v2 — zjednodušení appky

Datum: 2026-10-13 · Soubor: `index.html` (zůstává jeden soubor, bez buildu)

## Cíl
Jednoduchá appka pro zápis lidí, jejich bonusů (kde, kolik, kdy), dárků, které jim posíláme,
stavu objednávky a poznámek. Na první pohled vidět kolik se vydělalo.

## Rozhodnutí uživatele
- Ponechat: Lidé + bonusy, Poznámky, Dárky + stav objednávky, Výdaje + zisk/graf, datumy, filtry.
- Poznámky se zobrazují přímo u člověka (bez rozkliku).
- Vzhled: světlý, čistý, jedna zelená akcentová barva.
- Pryč: samostatná sekce Stránky, `costs` (náklady na dárky/poštovné), „poslední aktivita“,
  výběr období na dashboardu.

## Struktura (3 záložky)
1. **Lidé** (úvodní)
   - Hledání jména + filtry: stav (Vše/Čeká/Objednáno/Na vyzvednutí/Předáno),
     datum (Vše/Tento měsíc/30 dní/7 dní), kde (z již zapsaných hodnot).
   - Karta člověka: jméno, celkem Kč, řádky bonusů
     `datum · kde · Kč · dárky · [stav ▾]`, pod tím poznámky (vždy viditelné).
   - Stav se mění přímo v řádku výběrem.
   - Přidat bonus (malý modál): kde, Kč, datum (default dnes), dárky (Labubu/Dumpling + počet), stav.
   - Přidat člověka, přidat poznámku k člověku; obecné poznámky (bez člověka) nahoře seznamu.
2. **Výdaje**: seznam (název, Kč, datum, kategorie) + součet.
3. **Přehled**: bonusy celkem, výdaje celkem, zisk, počet dárků čekajících na odeslání, graf zisku v čase.

## Data (Firestore `labubu/{uid}`, beze změny struktury)
`people[{id,name}]`, `bonuses[{id,personId,siteId,amount,gifts[{type,qty}],status,date,note}]`,
`expenses[{id,name,amount,date,category,note}]`, `notes[{id,title,text,personId,color,date}]`.
- Nové bonusy ukládají `site` (text „kde“); staré mají `siteId` → zobrazí se název z `sites`.
- `sites` a `costs` zůstávají v dokumentu nedotčené (nemazat). Ukládání dělá `set(data)` s celým
  načteným objektem, takže se neznámá pole zachovají.
- Stavy: `pending|ordered|wait|done`.

## Zachovat z původní appky
Firebase init, přihlášení email/heslo, `initData`/`save` s debounce, manifest/PWA meta.

## Testování
Načíst appku proti reálným datům, ověřit: staré bonusy se zobrazí, změna stavu se uloží,
filtry fungují, součty a zisk sedí s původními čísly, mobilní šířka.

## Mimo rozsah
Nové funkce nad rámec výše, změna Firebase projektu/pravidel.
