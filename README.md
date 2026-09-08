# Das Königliche Spiel von Ur

Ein lokales Modul für den Lesezeichen-Hub mit Einzelspieler gegen Browser-KI
oder zwei Spielern an einem Gerät. Es benötigt keine Netzwerkverbindung.

## Im Hub verwenden

1. Die Modulverwaltung im Lesezeichen-Hub öffnen.
2. Den Ordner dieses Moduls lokal registrieren.
3. Das erzeugte Start-Lesezeichen öffnet `index.html`.

Alle Ressourcen werden relativ geladen und funktionieren deshalb unter der vom
Hub vergebenen Moduladresse.

## Historischer Rahmen

Das Brett aus dem Königsfriedhof von Ur im heutigen Irak datiert auf etwa
2600–2400 v. Chr. Die vollständige antike Spielregel ist nicht direkt mit dem
Brett überliefert. Diese Umsetzung folgt der verbreiteten spielbaren
Rekonstruktion des British-Museum-Kurators Irving Finkel, die sich auch auf eine
spätere babylonische Regeltafel stützt.

## Regeln der Rekonstruktion

- Jede Seite hat sieben Steine und durchläuft 14 Felder: sechs sichere eigene
  Felder und acht gemeinsame Kampffelder.
- Vier Tetraederwürfel zeigen je eine markierte (`1`) oder unmarkierte (`0`)
  Seite. Die Summe bestimmt die Schrittzahl von 0 bis 4.
- Mit `0` oder ohne möglichen Zug wird die Zugseite automatisch abgegeben.
- Auf einem eigenen Feld sind Steine sicher. Auf dem gemeinsamen Mittelweg
  werden gegnerische Steine durch Landen auf ihrem Feld geschlagen und kehren in
  die Reserve zurück.
- Die zentrale Rosette des Mittelwegs ist geschützt und kann nicht geschlagen
  werden. Jede Rosette gewährt einen weiteren Wurf.
- Ein Stein verlässt das Brett nur mit exakt passender Augenzahl. Wer alle
  sieben Steine austrägt, gewinnt.

Mögliche Züge erscheinen nach einem Wurf hervorgehoben. Der Verlauf dokumentiert
Würfe, Züge, Rosetten, Schläge und ausgetragene Steine. Laufende Partien werden
nur lokal in diesem Browser gespeichert.

## Tests

```powershell
node --test tests/app.test.js
```