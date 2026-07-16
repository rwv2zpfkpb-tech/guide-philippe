> **Pflicht:** Diese Datei muss nach **jeder** strukturellen Änderung sofort aktualisiert werden — immer, ohne Ausnahme: neue Routen, neue Tabellen/Migrationen, neue Server Actions, neue Komponenten, geänderte Auth-/Berechtigungslogik, neue Env-Variablen. Sie ist der primäre Kontext für KI-Assistenten — veraltete Inhalte führen zu falschen Empfehlungen. Lieber zu viel aktualisieren als zu wenig.

# Guide Philippe — Projektübersicht

Restaurant-Guide-App. Admins pflegen Restaurants, eingeloggte + freigeschaltete Nutzer hinterlassen Kommentare. **Kein anonymer Zugriff:** die gesamte App ist login-pflichtig, neue Registrierungen müssen zusätzlich von einem Admin freigeschaltet werden (s. „Auth & Berechtigungen").

## Tech-Stack

| Schicht | Technologie |
|---|---|
| Framework | Next.js 16 (App Router, React 19) |
| Datenbank + Auth | Supabase (PostgreSQL + Row Level Security) |
| Styling | Tailwind CSS v4 |
| Karten | `@vis.gl/react-google-maps` + Google Places API (New) |
| Sprache | TypeScript strict |

## Verzeichnisstruktur

```
app/
  layout.tsx              – Root-Layout (Cormorant Garamond + DM Sans Fonts, Theme-Cookie, Body-Wrapper, `appleWebApp`-Metadata für iOS-Homescreen-Titel)
  page.tsx                – Startseite (Server Component, lädt Restaurants). Im Normal-Modus (keine Ortssuche) unterhalb der Suchleiste optional eine „Neu hinzugefügt"-Reihe (`getRecentRestaurants()`, letzte 30 Tage), ganz unten `<InstallPwaInstructions>` (PWA-Installationsanleitung)
  loading.tsx             – Suspense-Fallback für die Startseite
  error.tsx               – Error Boundary für die Startseite (fängt z.B. transiente Supabase-Fetch-Fehler ab), zeigt Retry-Button
  manifest.ts             – Next.js-Dateikonvention, generiert `/manifest.webmanifest` (PWA-Metadaten, Icons)
  icon.tsx                – Next.js-Dateikonvention: Favicon (32×32) via `next/og` `ImageResponse`, „GP"-Wortmarke (`lib/pwa-icon.tsx`)
  apple-icon.tsx          – wie `icon.tsx`, aber 180×180 für iOS „Zum Home-Bildschirm" (Next hängt automatisch `<link rel="apple-touch-icon">` ein)
  icons/192/route.tsx, icons/512/route.tsx – Route Handlers für die im Manifest referenzierten 192px/512px-PNG-Icons (ebenfalls `ImageResponse`)
  globals.css
  login/
    page.tsx              – Server Component: redirect wenn eingeloggt
    LoginForm.tsx          – Client Component: Login/Signup-Tabs
  auth/confirm/
    page.tsx              – Server Component: Ziel des Signup-Bestätigungslinks. Tauscht PKCE-`code` gegen Session (`exchangeCodeForSession`), zeigt Erfolgs-/Fehler-Screen
  pending/
    page.tsx              – Server Component: Screen für eingeloggte, aber noch nicht admin-freigeschaltete Accounts (`profiles.status = 'pending'/'rejected'`). Ziel des proxy-Redirects, s.u.
  restaurant/[id]/
    page.tsx              – Detailseite (Places-Details, Fazit + Kategorie-Bewertungen, Aufenthalts-Historie, Kommentare). Fazit wird als Headline (erster Satz) + restlicher Fließtext gerendert (`ReviewContent`), nicht mehr als Headline + vollständig wiederholtem Text. Öffnungszeiten stehen in einem `<details>`-Block (`.oh-details`-CSS in `globals.css`), standardmäßig eingeklappt, mit rotierendem Chevron als Ausklapp-Indikator. Spoon-Verdict-Box + Dots sind farbcodiert (`SPOON_RATING_COLORS`); auf schmalen Viewports (`.restaurant-hero-row`/`.restaurant-hero-verdict`, `max-width: 640px`) stapelt sich die Identity-Zeile statt die Verdict-Box isoliert in eine sonst leere Zeile umbrechen zu lassen
    loading.tsx
    CommentForm.tsx        – Client Component: Kommentar abgeben (0–5 Sterne, 150-Zeichen-Limit)
  actions/                – Alle Server Actions ("use server")
    auth.ts               – signIn / signUp / signOut
    profiles.ts           – getPendingProfiles / approveProfile / rejectProfile (Admin-Schutz, Registrierungs-Freischaltung)
    restaurants.ts        – CRUD Restaurants (Admin-Schutz)
    reviews.ts             – createReview / updateReview — Aufenthalte (Fazit + Kategorie-Bewertungen) eines Restaurants, Admin-Schutz
    comments.ts            – CRUD Kommentare (Auth + RLS-Schutz)
    csvImport.ts           – previewCsvImport / confirmCsvImport — Google-Takeout-CSV-Import mit Abgleich gg. bestehende Restaurants (Admin-Schutz)
    places.ts              – Google Places Details (Server-only API-Key)
  admin/
    dashboard/
      page.tsx            – Server Component: Auth-Guard + Datenladen
      AdminDashboard.tsx  – Client Component: gesamte Admin-UI
  api/
    auth/email/route.ts   – Route Handler: Supabase "Send Email" Auth-Hook, verschickt Auth-Mails via Resend (s.u.) — bewusste Ausnahme von „Kein API-Layer", da Supabase dies als HTTP-Webhook aufruft

components/
  Header.tsx, Footer.tsx   – Layout-Rahmen (Server Components)
  ThemeToggle.tsx          – Client Component: Hell-/Dunkelmodus-Umschalter
  NavigationProgress.tsx   – Client Component: Ladebalken bei Routenwechsel
  HeroSearch.tsx           – Client Component: hält den lokal gestagten Filter-Zustand der Landing-Page-Suche (s. „Landing-Page-Suche" unten), rendert LocationSearch + FilterBar
  FilterBar.tsx            – Client Component: Küche/Preis/Bewertung-Filterchips. **Controlled** (kein eigener Router-/URL-Zugriff mehr) — Mehrfachauswahl je Kategorie, Zustand kommt von HeroSearch als Props
  LocationSearch.tsx       – Client Component: Orts-/Restaurantsuche (Google Places). `size="large"` (Landing-Page-Hero): löst erst beim Klick auf „Suchen" aus, s.u. `size="compact"` (Suchleiste in SearchResultsView): navigiert weiterhin sofort bei Auswahl/Enter
  SearchResultsView.tsx    – Client Component: Liste + Karte für Ortssuche. Desktop: klassisches Nebeneinander (Liste 420px fest + Karte flex). Mobile (< 900px, s. `.sr-viewport`/`.sr-list-panel`/`.sr-map-panel` in `globals.css`): Liste und Karte liegen nebeneinander in einem doppelt breiten Viewport, ein fixierter Toggle-Button verschiebt den Viewport per CSS-`transform` um 50% (Liste ↔ Karte) statt hart umzuschalten — beide Panels bleiben gemountet (Karteninstanz bleibt erhalten). Eigene Filter-Chips sind wie auf der Landing-Page gestaged (s. „Landing-Page-Suche" unten) — Klick ändert nur lokalen State, erst „Übernehmen" navigiert; die ganze Komponente ist mit `key={JSON.stringify(activeFilters)}` verdrahtet, damit der gestagte State nach jeder Navigation zurückgesetzt wird (kein `useEffect`-Sync). Kein Bild-Platzhalter mehr in den Listenkarten (s. „Kein Self-Hosting von Bildern" unten) — Spoon-Rating stattdessen farbcodiert (`SPOON_RATING_COLORS`)
  RestaurantCard.tsx       – Karte in der Restaurant-Grid-Ansicht. Kein Bild-Platzhalter (s. „Kein Self-Hosting von Bildern" unten) — stattdessen farbcodierter oberer Rand + Label passend zur Spoon-Rating-Stufe (`SPOON_RATING_COLORS` aus `lib/ratings.ts`)
  PriceLevelDots.tsx       – Gemeinsame Preisanzeige (0 = „Kostenlos", 1–4 = €-Symbole)
  RatingDots.tsx           – Generische gefüllte/leere Kreis-Anzeige (`value`/`min`/`max`, optional `onChange` für klickbare Admin-Picker, optional `color` für farbcodierte Dots) — für Spoon-Rating (min=0, max=3, `color` aus `SPOON_RATING_COLORS`) und Kategorie-Bewertungen (min=1, max=5 — 5 statt 6 wählbare Werte)
  StarRating.tsx           – Nutzer-Sterne-Durchschnitt mit Halb-Stern-Füllung (CSS-Clip-Technik), neben „Reader Experiences"
  NavigateButton.tsx       – Client Component: „Route planen"-Button auf der Restaurant-Detailseite. Erkennt beim Klick per `navigator.userAgent`, ob iOS/Android/Desktop: iOS → Apple-Maps-Universal-Link (`maps.apple.com/?daddr=...`), Android → `geo:`-URI (öffnet die installierte Karten-App per Intent), sonst (Desktop) → Google-Maps-Routenplaner im neuen Tab (`google.com/maps/dir/?api=1&destination=...&destination_place_id=...`)
  admin/
    PlacesAutocomplete.tsx – Google Places Autocomplete (Client). Liefert bei Auswahl neben Name/Place-ID/Koordinaten auch einen best-effort Cuisine-Vorschlag aus Googles Place-Type (`primaryTypeDisplayName`/`primaryType`/`types`), s. „Admin-Dashboard" unten
  map/
    MapView.tsx            – Kartenansicht (Client). Marker-Farben kommen aus `SPOON_RATING_COLORS` (`lib/ratings.ts`) statt bespoke Hex-Werten — damit auch im Dark Mode korrekt statt fix eingefärbt

lib/
  ratings.ts               – Single Source of Truth für Spoon-Rating-Emoji/Labels, Kategorie-Labels/-Reihenfolge und `computeAverageRating()`
  resend.ts                – getResendClient() Factory + RESEND_FROM_EMAIL (Server-only)
  auth-emails.ts           – Deutsche HTML-Templates für Supabase-Auth-Mails (signup, recovery, ...)
  admin.ts                 – PRIMARY_ADMIN_EMAIL (hardcoded Haupt-Admin, s. „Auth & Berechtigungen")

utils/supabase/
  server.ts        – createClient() für Server Components / Actions
  client.ts        – createClient() für Client Components
  admin.ts         – createAdminClient() (Service-Role-Key, nur Server)
  proxy.ts         – updateSession() — Session-Refresh
  auth-helpers.ts  – requireAuth() / requireAdmin()

types/
  database.ts      – Alle DB-Typen, händisch gepflegt (Supabase-Schema)

proxy.ts           – Läuft auf jeder Route außer statischen Assets (Next.js 16: ehem. middleware.ts)
public/
  map-style.json   – Custom Google Maps Stil
```

## Datenbank-Schema (Supabase)

Typen sind in [types/database.ts](types/database.ts) definiert. Nach Schema-Änderungen neu generieren:
```
npx supabase gen types typescript --project-id <id> > types/database.ts
```

### Tabellen

**`restaurants`** — Kernentität
- `id` uuid PK
- `name` text (Pflicht)
- `google_place_id` text | null — für Live-Daten von Google
- `lat`, `lng` float | null
- `cuisine` text | null
- `price_level` 0–4 | null (0 = kostenlos, 1–4 = € bis €€€€)
- `spoon_rating` 0–3 (Kern-Bewertungssystem, s.u.) — **kein direkt editierbares Feld mehr**, sondern per DB-Trigger (`sync_restaurant_spoon_rating`) immer aus dem `restaurant_reviews`-Eintrag mit dem höchsten `(visited_at, created_at)` für dieses Restaurant abgeleitet
- `status` `'draft'|'published'` (Default `'published'`, Migration `20260715000007_restaurant_status.sql`) — `draft` ist für normale Nutzer per RLS komplett unsichtbar (s. „Auth & Berechtigungen"), im Admin-Dashboard aber voll sichtbar/editierbar (Badge „Entwurf"). Neu importierte CSV-Einträge (s. `csvImport.ts`) landen immer als `draft`, bis ein Admin sie vervollständigt und veröffentlicht
- `official_review` **entfernt** (Migration `20260715000006`) — ersetzt durch `restaurant_reviews.fazit` + `restaurant_review_categories`

**`restaurant_reviews`** — ein redaktioneller Aufenthalt („Fazit" + Endbewertung). Jedes Restaurant hat immer ≥1 Zeile (Invariante, s. Backfill in Migration `20260715000006`)
- `id` uuid PK, `restaurant_id` uuid FK → restaurants (on delete cascade)
- `visited_at` date (Default heute) — Datum des Aufenthalts, bestimmt „aktuell" vs. „Historie"
- `spoon_rating` 0–3 — Endbewertung dieses Aufenthalts
- `fazit` text — ersetzt das frühere `restaurants.official_review`

**`restaurant_review_categories`** — bis zu 4 unabhängige, optionale Unterbewertungen je Aufenthalt
- `id` uuid PK, `review_id` uuid FK → restaurant_reviews (on delete cascade)
- `category` `'service'|'location'|'geschmack'|'preis_leistung'` (fix, s. `REVIEW_CATEGORY_ORDER` in `lib/ratings.ts`), unique je `(review_id, category)`
- `heading` text | null, `body` text | null — leer = Kategorie wird auf der Detailseite ausgeblendet
- `rating` 0–5 | null

**`profiles`** — Erstellt automatisch via Supabase Auth Trigger
- `id` uuid (= auth.users.id)
- `username` text | null
- `role` `'user'` | `'admin'`
- `status` `'pending'` | `'approved'` | `'rejected'` — neue Registrierungen starten `pending`, erst nach Admin-Freischaltung (`approveProfile`) `approved`. Ohne `approved` überall gesperrt (s. „Auth & Berechtigungen")

**`comments`** — Nutzerkommentare zu Restaurants
- `restaurant_id` uuid FK → restaurants
- `user_id` uuid FK → profiles
- `content` text — max. 150 Zeichen (nur App-seitig validiert in `addComment`/`updateComment`, kein DB-Constraint)
- `secondary_rating` int 0–5 | null — 0 ist ein gültiger, von `null` verschiedener Wert (analog `price_level`, s. `PriceLevelDots.tsx`-Hinweis unten)

**`data_sources`** — Tracking externer Datenquellen (geplant)
- `freq` `'manual'|'hourly'|'daily'|'weekly'`
- `status` `'pending'|'syncing'|'synced'|'error'`

### Spoon-Rating-System
```
0 = 🫗  Not Recommended
1 = 🥄  Remembering
2 = 🍴  Worth Mentioning
3 = 🍽️  Absolute Recommendation
```

### Supabase-Funktionen
- `is_admin()` — RLS-Hilfsfunktion, prüft ob aktueller User `role = 'admin'` hat.
- `is_approved()` — RLS-Hilfsfunktion, prüft ob aktueller User `profiles.status = 'approved'` hat.

## Auth & Berechtigungen

**Kein anonymer Zugriff.** `proxy.ts` gated jede Route: nicht eingeloggt → `/login`, eingeloggt aber nicht `approved` → `/pending`. Öffentlich erreichbar bleiben nur `/login`, `/auth/confirm`, `/pending` und `/api/auth/email` (Supabase-Webhook, kein Nutzer-Session-Kontext).

### Zugriffsebenen

| Ebene | Supabase-Zustand | Zugang |
|---|---|---|
| Pending/Rejected | eingeloggt, `status ≠ 'approved'` | nur `/pending`-Screen + Logout |
| User | eingeloggt + `status = 'approved'` | Restaurant-Liste lesen (nur `status = 'published'`), Kommentare erstellen/bearbeiten/löschen |
| Admin | eingeloggt + `role = 'admin'` (Admins werden bei der Migration automatisch auf `approved` gesetzt) | Restaurants CRUD (inkl. `draft`-Einträge), CSV-Import, Registrierungen freischalten/ablehnen, Nutzerverwaltung |

`restaurants` mit `status = 'draft'` sind per RLS (`20260715000007_restaurant_status.sql`) für `approved`-Nutzer unsichtbar — nur Admins (`is_admin()`) sehen sie. Damit sind unfertige/private Einträge (z.B. frisch aus dem CSV-Import) nie versehentlich öffentlich sichtbar.

Neue Registrierungen landen mit `status = 'pending'` in der Datenbank (Spalten-Default, s. Migration `20260715000001_registration_approval.sql`) und müssen im Admin-Dashboard (Sektion „Registrierungen ausstehend") freigeschaltet werden, bevor sie über `/pending` hinauskommen.

### Hardcoded Haupt-Admin (`lib/admin.ts`)

`PRIMARY_ADMIN_EMAIL = "uhllucas@icloud.com"` (Site-Owner) ist **fest im Code** hinterlegt, nicht nur in der Datenbank:
- Migration `20260715000004_hardcode_primary_admin.sql` setzt dieses Konto auf `role = 'admin'`, `status = 'approved'` (idempotent, sicher erneut ausführbar)
- `assertNotPrimaryAdmin()` in `app/actions/profiles.ts` blockiert `demoteFromAdmin`/`deleteUserAccount` für dieses Konto **immer** — unabhängig von der Anzahl übriger Admins (anders als `assertNotLastAdmin`, das nur bei genau einem verbleibenden Admin greift)
- Im Admin-Dashboard (Nutzerverwaltung) zeigt diese Zeile ein „Haupt-Admin"-Badge und hat **keine** Demote-/Lösch-Buttons (auch UI-seitig unterdrückt, nicht nur serverseitig blockiert)
- Ändern des Haupt-Admins erfordert bewusst eine Code-Änderung (`lib/admin.ts`) + neue Migration — kein Env-Var, damit es nicht versehentlich per Konfigurationsfehler geändert werden kann

### Wie Auth-Prüfung funktioniert

In Server Actions immer `requireAuth()`, `requireApproved()` oder `requireAdmin()` aus `utils/supabase/auth-helpers.ts` verwenden — diese werfen bei Verstoß einen Error.

```ts
// Für eingeloggte Nutzer (unabhängig vom Freischaltungsstatus)
const { user } = await requireAuth();

// Für eingeloggte UND admin-freigeschaltete Nutzer (z.B. addComment)
const { user } = await requireApproved();

// Für Admins
await requireAdmin(); // wirft 'Forbidden' wenn kein Admin
```

Die RLS-Policies in Supabase sind **zusätzliche Absicherung** — nicht der einzige Schutz. `restaurants`/`comments`-SELECT und `comments`-INSERT sind in RLS ebenfalls an `is_approved()` gebunden.

### Session-Refresh + Zugriffs-Gate (Proxy)

`proxy.ts` (Next.js-16-Nachfolger von `middleware.ts`) ruft `updateSession()` auf jeder Route auf — hält Supabase-JWT frisch **und** entscheidet über Redirects (`/login` bzw. `/pending`, s.o.). Läuft **nicht** auf `_next/static`, `_next/image` und Bilddateien. Proxy läuft standardmäßig im Node.js-Runtime (nicht mehr Edge).

### E-Mail-Versand (Resend statt Supabase-SMTP)

Supabase Auth verschickt Bestätigungslinks etc. weiterhin selbst (Token-Erzeugung, Verifizierung über den gehosteten `/auth/v1/verify`-Endpunkt bleibt unverändert) — aber **nicht mehr per eigenem SMTP**, sondern über den [Send Email Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook):

1. Supabase ruft bei jeder Auth-Mail (`signup`, `recovery`, `magiclink`, `invite`, `email_change`, `reauthentication`) `POST /api/auth/email` auf (`app/api/auth/email/route.ts`) — signiert nach dem [Standard-Webhooks](https://www.standardwebhooks.com/)-Format.
2. Die Route verifiziert die Signatur mit dem Paket `standardwebhooks` (Secret: `SEND_EMAIL_HOOK_SECRET`, Format `v1,whsec_...`).
3. Aus `token_hash` / `email_action_type` / `redirect_to` wird die gleiche Bestätigungs-URL gebaut, die auch Supabases eigene Default-Templates verwenden (`${SUPABASE_URL}/auth/v1/verify?token=...&type=...&redirect_to=...`) — es gibt **keine eigene Verify-Route**, GoTrue übernimmt Prüfung + Redirect wie gehabt.
4. Das passende deutsche HTML-Template kommt aus `lib/auth-emails.ts`, verschickt wird über `lib/resend.ts` (`getResendClient()`, Absender `RESEND_FROM_EMAIL`).
5. Bei `reauthentication` gibt es keinen Link, sondern einen 6-stelligen Code (`email_data.token`) zum manuellen Eingeben.

Konfiguration in Supabase Dashboard → Authentication → Hooks → Send Email Hook → URL auf `/api/auth/email` zeigen lassen, Secret dort kopieren und als `SEND_EMAIL_HOOK_SECRET` setzen. Ohne konfiguriertes `RESEND_API_KEY`/`SEND_EMAIL_HOOK_SECRET` antwortet die Route mit HTTP 500 (bricht den Auth-Flow bewusst ab, statt E-Mails zu verschlucken).

**Bestätigungsscreen nach Signup** (`app/auth/confirm/page.tsx`): `signUp()` in `app/actions/auth.ts` setzt `emailRedirectTo: ${origin}/auth/confirm`. GoTrue verifiziert den Token selbst (hosteter `/auth/v1/verify`-Endpoint) und redirected danach mit einem PKCE-`code` an diese Seite; sie tauscht den Code per `exchangeCodeForSession` gegen eine Session und zeigt Erfolgs- (eingeloggt, Link zur Startseite) oder Fehler-Screen (Link zum Login). **Wichtig:** `${origin}/auth/confirm` muss in Supabase Dashboard → Authentication → URL Configuration → Redirect URLs eingetragen sein, sonst verwirft GoTrue die Redirect-URL still und fällt auf die Site-URL zurück.

## Server Actions (`app/actions/`)

Alle Actions haben `"use server"` und laufen auf dem Server. API-Keys verlassen den Server nie.

### `restaurants.ts`
- `getRestaurants(filters?)` — Liste, optional gefiltert nach `cuisine`, `price_level`, `spoon_rating`. Alle drei sind **Arrays** (Mehrfachauswahl je Kategorie, z.B. mehrere Küchen gleichzeitig) — intern per Supabase `.in()` statt `.eq()`
- `getCuisines()` — Alle distinct `cuisine`-Werte **ungefiltert** (ignoriert aktive Such-Filter). Wichtig: die Küche-Filterchips in `FilterBar`/`SearchResultsView` müssen aus dieser Funktion stammen statt aus dem (evtl. bereits gefilterten) `getRestaurants()`-Ergebnis — sonst verschwinden Küche-Chips beim Kombinieren mehrerer Filter, weil dann nur noch Küchen der übrig gebliebenen Treffer auftauchen
- `getRecentRestaurants(limit = 8)` — Restaurants mit `created_at` innerhalb der letzten 30 Tage, neueste zuerst; speist die „Neu hinzugefügt"-Reihe auf der Landing-Page (`app/page.tsx`). RLS blendet Entwürfe für Nicht-Admins bereits automatisch aus, kein explizites `status`-Filter nötig
- `getRestaurantById(id)` — Einzelnes Restaurant inkl. verschachtelter Comments + Profiles sowie `reviews` (alle Aufenthalte inkl. `categories`, client-seitig nach `visited_at`/`created_at` absteigend sortiert — `reviews[0]` ist immer der aktuelle Aufenthalt, s. `restaurant_reviews` oben)
- `createRestaurant(payload, review)` — Admin-only, legt Restaurant **und** dessen ersten Aufenthalt in einem Aufruf an (ruft intern `createReview` aus `reviews.ts`), `revalidatePath("/", "layout")`. `payload` enthält **kein** `spoon_rating`/`official_review` mehr — das kommt aus `review`
- `updateRestaurant(id, payload)` — Admin-only, revalidiert Startseite + Detailseite (nur Stammdaten: Name/Küche/Preis/Places-Felder — Bewertungsinhalte laufen über `reviews.ts`)
- `deleteRestaurant(id)` — Admin-only

Adresse und Bilder werden **nicht** in der DB gespeichert — kommen live von der Google Places API.

### `csvImport.ts`
Import einer Google-Takeout-„Gespeicherte Orte"-Liste (Spalten `Title`/`Titel`, `Note`/`Notiz`, `URL`) mit Abgleich gg. bestehende Restaurants — zweistufiger Flow (Preview → Confirm), damit der Admin vor dem eigentlichen Import sieht, was neu ist und was bereits existiert:
- `previewCsvImport(csvText)` — Admin-only, reiner Dry-Run (keine DB-Schreibzugriffe, keine Places-API-Aufrufe). Parst die CSV client-unabhängig serverseitig (eigener kleiner RFC4180-artiger Parser, keine Library-Abhängigkeit — behandelt gequotete Felder/eingebettete Kommas/Zeilenumbrüche), extrahiert pro Zeile eine `google_place_id` aus der `URL`-Spalte (`place_id:...` oder `query_place_id=...`-Muster) sowie optional eine `note` aus der `Note`/`Notiz`-Spalte (nur zur späteren Fazit-Vorbefüllung, kein Pflichtfeld), und gleicht dann gegen alle bestehenden Restaurants ab: zuerst per `google_place_id`, sonst per case-insensitivem Namensvergleich. Erkennt die Titel-Spalte sowohl als `Title` (EN) als auch `Titel` (DE, je nach Kontosprache des Google-Takeout-Exports); wirft einen Fehler, wenn weder `Title`/`Titel` noch `URL`-Spalte gefunden wird (falsches Export-Format). **Bekannte Einschränkung:** moderne Google-Maps-„Gespeicherte Orte"-Exporte enthalten in der `URL`-Spalte oft Share-Links im Format `.../data=!4m2!3m1!1s0x...:0x...` (ein Feature-/CID-Hash) statt eines klassischen `place_id:...`/`query_place_id=...`-Musters — daraus lässt sich hier keine `google_place_id` extrahieren (wird aber in `confirmCsvImport` per Namenssuche nachgeholt, s.u.). Betroffene Zeilen landen trotzdem korrekt als „Neu" (Matching fällt auf Namensvergleich zurück) und zeigen im Preview einen „Maps ↗"-Link zur manuellen Kontrolle
- `confirmCsvImport(selection)` — Admin-only, `selection` ist die vom Admin im Preview bestätigte Teilmenge der als „neu" markierten Zeilen (`{ name, googlePlaceId, note }[]`). Legt für jede Zeile **einzeln** (nicht per Batch-Insert, um Restaurant↔Notiz eindeutig zuzuordnen) ein Restaurant mit `status: 'draft'` an sowie einen Platzhalter-Aufenthalt (`spoon_rating: 1`, `visited_at: heute`) in `restaurant_reviews` — hält die Invariante „≥1 Review pro Restaurant" ein. Pro Zeile wird zusätzlich `resolvePlaceForImport(name, googlePlaceId)` (s. `places.ts`) aufgerufen, um `google_place_id` + `lat`/`lng` **schon beim Import** zu befüllen (bestmöglicher Vorschlag per direkter ID-Auflösung oder Textsuche nach dem Namen — schlägt die Auflösung fehl, bleiben die Felder `null`, kein Abbruch des Imports). Ein vorhandener CSV-Kommentar (`note`) wird direkt als `fazit` des Platzhalter-Aufenthalts übernommen statt leer zu bleiben. Der Admin prüft/vervollständigt Kartendaten/Fazit/Kategorien/Cuisine/Preis über den normalen Edit-Panel-Flow (inkl. Places-Autocomplete zur Korrektur) und entfernt dort das „Als Entwurf speichern"-Häkchen, sobald der Eintrag fertig ist
- Matching-Heuristik ist bewusst einfach (exakter `google_place_id`- oder Namens-Treffer) — gedacht für den persönlichen, überschaubaren Restaurant-Bestand dieser App, nicht für Datensätze mit vielen gleichnamigen Filialen

### `reviews.ts`
- `createReview(restaurantId, payload)` — Admin-only. Legt einen neuen Aufenthalt an (`restaurant_reviews`) + bis zu 4 Kategorie-Zeilen (`restaurant_review_categories`, immer alle 4 fixen Kategorien, leere bleiben mit `null`-Feldern bestehen). Der DB-Trigger `sync_restaurant_spoon_rating` aktualisiert danach automatisch `restaurants.spoon_rating`, wenn dieser Aufenthalt der aktuellste ist. Wird sowohl beim Anlegen eines neuen Restaurants (erster Aufenthalt) als auch beim Admin-Häkchen „Als neuen Aufenthalt speichern" verwendet
- `updateReview(reviewId, restaurantId, payload)` — Admin-only, korrigiert einen bestehenden Aufenthalt in-place (Upsert der Kategorie-Zeilen über `onConflict: "review_id,category"`) — Standardfall im Admin-Dashboard beim Speichern (kein neuer historischer Eintrag)
- Beide `revalidatePath("/", "layout")` + `revalidatePath("/restaurant/[id]")`

### `profiles.ts`
- `getPendingProfiles()` — Admin-only, Liste aller `status = 'pending'`-Accounts
- `getAllProfiles()` — Admin-only, Liste **aller** Accounts (für Nutzerverwaltung)
- `approveProfile(profileId)` / `rejectProfile(profileId)` — Admin-only, setzt `status`
- `promoteToAdmin(profileId)` / `demoteFromAdmin(profileId)` — Admin-only, setzt `role`
- `deleteUserAccount(profileId)` — Admin-only, löscht den `auth.users`-Eintrag komplett (via `createAdminClient()`) — `profiles`/`comments` hängen an `on delete cascade` und verschwinden automatisch mit
- Sicherheitsnetze für `demoteFromAdmin`/`deleteUserAccount`: kein Self-Target möglich (`assertNotSelf`), letzter verbleibender Admin kann nicht demoted/gelöscht werden (`assertNotLastAdmin`), `PRIMARY_ADMIN_EMAIL` (s. „Auth & Berechtigungen") kann nie demoted/gelöscht werden (`assertNotPrimaryAdmin`) — verhindert, dass sich die App am Ende ganz ohne Admin oder ohne Haupt-Admin wiederfindet
- `getPendingProfiles()`/`getAllProfiles()` liefern zusätzlich `email` (via `createAdminClient()`, service-role), da `profiles` keine E-Mail-Spalte hat

### `comments.ts`
- `addComment(restaurantId, content, secondaryRating)` — Auth required. `secondaryRating` 0–5, `content` max. 150 Zeichen (nach `.trim()`) — beides serverseitig validiert (wirft `Error`)
- `updateComment(commentId, restaurantId, content, secondaryRating)` — Auth required; gleiche Validierung wie `addComment`; RLS blockiert Fremdzugriff
- `deleteComment(commentId, restaurantId)` — Auth required; RLS erlaubt nur Owner oder Admin
- `adminDeleteComment(commentId, restaurantId)` — Admin-only

### `places.ts`
- `getPlaceDetails(placeId)` — Ruft Google Places API (New) auf: `formattedAddress`, `regularOpeningHours`, bis zu 5 `photoUris`. Request mit `languageCode=de&regionCode=DE`, damit `weekdayDescriptions` bereits als deutsche „Tag: Zeiten"-Strings zurückkommen (statt Englisch) — die Restaurant-Detailseite (`app/restaurant/[id]/page.tsx`) parst diese Strings am ersten `:` in Tag/Zeiten-Spalten und hebt den heutigen Wochentag farblich hervor
- `resolvePlaceForImport(name, placeId)` — Für den CSV-Import (`csvImport.ts`): löst zu einem Namen (+ evtl. bereits extrahierter Place-ID) `google_place_id` + `lat`/`lng` auf. Bei vorhandener `placeId` erst direkte Detail-Abfrage (Places API `places/{id}`, Feldmaske `id,location`); schlägt das fehl (z.B. weil die extrahierte ID gar keine echte Place-ID war, s. CID-Einschränkung bei `csvImport.ts`) oder war `placeId` von vornherein `null`, Fallback auf Textsuche (`places:searchText` mit `textQuery: name`) — genommen wird der erste Treffer. Liefert `null`, wenn beides fehlschlägt (kein Fehler, Import läuft mit leeren Kartendaten weiter)
- Immer `cache: "no-store"` — Öffnungszeiten und Foto-URLs ändern sich täglich
- API-Key in `GOOGLE_PLACES_API_KEY` (Server-only, nie `NEXT_PUBLIC_`)

Kein Self-Hosting von Bildern (kein `storage.ts` mehr, s. Roadmap Schritt 3) — die Restaurant-Detailseite zeigt genau die ersten 3 `photoUris` (1 Hero + 2 Thumbnails) direkt von Google. **Nur die Detailseite zeigt Bilder** — `RestaurantCard` (Grid/„Neu hinzugefügt") und `SearchResultsView`s Listenkarten haben bewusst keinen Bild-Platzhalter mehr (früher ein diagonal schraffiertes Placeholder-Quadrat); sie sind textbasiert und color-coden stattdessen die Spoon-Rating-Stufe (`SPOON_RATING_COLORS`).

## Supabase-Clients

| Client | Wo verwendet | Key |
|---|---|---|
| `utils/supabase/server.ts` → `createClient()` | Server Components, Server Actions, Route Handlers | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| `utils/supabase/client.ts` → `createClient()` | Client Components | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| `utils/supabase/admin.ts` → `createAdminClient()` | Nur Server, für Service-Role-Operationen in der Nutzerverwaltung (E-Mail-Lookup, Account-Löschung in `profiles.ts`) | `SUPABASE_SERVICE_ROLE_KEY` (geheim!) |

## Umgebungsvariablen

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # nur Server, nie ans Frontend
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=    # für Maps-Komponenten im Browser
GOOGLE_PLACES_API_KEY=              # nur Server, für Places API
RESEND_API_KEY=                     # nur Server, für Auth-Mail-Versand
RESEND_FROM_EMAIL=                  # muss auf verifizierter Resend-Domain liegen
SEND_EMAIL_HOOK_SECRET=             # Standard-Webhooks-Secret aus Supabase Send Email Hook
```

## Admin-Dashboard (`/admin/dashboard`)

- **Server Component** (`page.tsx`): Auth-Guard (redirect zu `/login` wenn nicht eingeloggt, redirect zu `/` wenn kein Admin), lädt initiale Restaurant-Liste + `getPendingProfiles()`, rendert `<AdminDashboard>`
- **Client Component** (`AdminDashboard.tsx`): Sektion „Registrierungen ausstehend" (Freischalten/Ablehnen via `approveProfile`/`rejectProfile`), Sektion „Nutzerverwaltung" (Zum Admin machen/Admin-Status entfernen/Löschen via `promoteToAdmin`/`demoteFromAdmin`/`deleteUserAccount`, `UserActionModal` mit zweistufiger Bestätigung), Tabelle mit Suche + „Nur Entwürfe"-Filter-Toggle, Slide-Over-Panel zum Erstellen/Bearbeiten (inkl. Sichtbarkeits-Checkbox „Als Entwurf speichern"), CSV-Import-Modal (`ImportModal`), Delete-Modal, Toast-Benachrichtigungen. Jede Tabellenzeile hat neben Edit/Delete zusätzlich einen „Ansehen"-Link (`/restaurant/[id]`, `target="_blank"`) zur öffentlichen Nutzeransicht des Restaurants
- **CSV-Import** (`ImportModal`, Button „CSV-Import" neben „Add new"): zweistufig — Schritt „pick" (Datei-Auswahl, liest die Datei client-seitig per `file.text()` und schickt den Rohtext an `previewCsvImport`), Schritt „preview" (Liste „Neu" mit Checkboxen, standardmäßig alle an, plus Liste „Bereits vorhanden" nur informativ/nicht auswählbar mit Verweis auf den passenden bestehenden Namen; Zeilen ohne extrahierte Place-ID zeigen einen „Maps ↗"-Link zur manuellen Zuordnung später). „Importieren" ruft `confirmCsvImport` mit der ausgewählten Teilmenge (inkl. `note`), neue Restaurants (immer `status: 'draft'`, mit per `resolvePlaceForImport` bestmöglich vorbefüllten Kartendaten und Notiz-als-Fazit, s. `csvImport.ts`) werden vorne in die Tabelle eingefügt
- **Entwurf/Veröffentlicht** (`status`-Feld): Tabellenzeilen mit `status === 'draft'` zeigen ein goldenes „Entwurf"-Badge neben dem Namen; der Toggle-Button „Nur Entwürfe" filtert die Tabelle clientseitig auf diese Zeilen. Im Edit-Panel steuert eine Checkbox („Als Entwurf speichern (für Nutzer unsichtbar, bis veröffentlicht)") `form.status`, Default bei neuen Restaurants ist `'published'`
- Benutzt `useTransition` für optimistische Updates
- Google Places Autocomplete im Edit-Panel — befüllt Name, `google_place_id`, lat/lng **und** einen best-effort `cuisine`-Vorschlag automatisch (s. `PlacesAutocomplete.tsx` oben). Das Cuisine-Feld ist ein freies Text-Input mit `<datalist>`-Vorschlägen (`CUISINES`-Konstante), kein festes Dropdown mehr — bleibt also immer manuell korrigierbar. Sobald eine `google_place_id` im Formular steht (frisch ausgewählt oder von einem bestehenden Restaurant geladen), lädt ein `useEffect` zusätzlich per `getPlaceDetails(placeId)` (`app/actions/places.ts`) eine Fotovorschau (bis zu 5 Bilder aus `photoUris`) direkt unter der Adress-Bestätigung — zweite Call-Site dieser Action neben der Restaurant-Detailseite
- Slide-Over-Panel (`EditPanel`) ist auf Desktop breiter als früher (`max-w-lg` → `sm:max-w-xl lg:max-w-2xl`), die 4 Kategorie-Karten stehen ab `sm` in einem 2-Spalten-Grid statt untereinander
- **Edit-Panel — Aktuelle Bewertung + Kategorien**: Beim Öffnen eines bestehenden Restaurants lädt `openEdit` erst per `getRestaurantById` den aktuellen Aufenthalt + Historie (`loadingEditId` sperrt währenddessen den Edit-Button der Zeile), bevor sich das Panel öffnet. Spoon-Rating/Datum/Fazit gehören zum aktuellen Aufenthalt; die 4 Kategorie-Karten (Service/Location/Geschmack/Preis-Leistung, s. `REVIEW_CATEGORY_ORDER`) sind unabhängige, optionale Sektionen mit je Überschrift/Text/`RatingDots`-Picker (1–5). Checkbox „Als neuen Aufenthalt speichern" entscheidet beim Speichern zwischen `updateReview` (Korrektur des aktuellen Aufenthalts, Standard) und `createReview` (neuer historischer Eintrag mit eigenem Datum) — s. `app/actions/reviews.ts`. Bestehende ältere Aufenthalte werden schreibgeschützt als „Bisherige Aufenthalte" gelistet.
- **Kein eigener Header mehr** — früher rendertete `AdminDashboard.tsx` einen eigenen `sticky`-Header (Branding, „Admin"-Badge, Public-Site-Link, `<ThemeToggle>`) zusätzlich zum globalen `<Header>` aus `app/layout.tsx`, wodurch auf `/admin/dashboard` zwei Leisten übereinander erschienen. Entfernt — die Seite nutzt jetzt ausschließlich den globalen `<Header>` (der bei `role: 'admin'` ohnehin schon einen „Admin"-Link zeigt). Alle Farben über CSS-Custom-Properties, kein hartkodiertes Tailwind-Farbschema mehr

## Komponenten

### Landing-Page-Suche (`HeroSearch.tsx` + `FilterBar.tsx` + `LocationSearch.tsx`)

Filter-Klicks auf der Startseite lösen **keine** Navigation/Suche mehr aus — sie werden nur lokal gestaged, bis der Nutzer explizit sucht:

- `HeroSearch.tsx` (Client Component, im Hero-Bereich von `app/page.tsx`) hält den Filter-Zustand (`FilterSelection`: `{ cuisine: string[]; price_level: number[]; spoon_rating: number[] }`) in `useState` und reicht ihn kontrolliert an `FilterBar` (Anzeige/Toggle) sowie an `LocationSearch` (`filters`-Prop, wird erst beim Suchen in die URL geschrieben) weiter.
- `FilterBar.tsx` ist rein **controlled** — bekommt `selected` + Toggle-/Clear-Callbacks als Props, macht selbst keine Router-/URL-Aufrufe mehr. Mehrfachauswahl je Kategorie (Klick fügt hinzu/entfernt aus dem Array, kein Single-Select mehr). Jede Kategorie (Küche/Preis/Bewertung) hat einen „Alle"-Chip, der aktiv ist, wenn für diese Kategorie nichts ausgewählt ist (= Standardzustand, entspricht „kein Filter") und beim Klick die Kategorie zurücksetzt.
- `LocationSearch.tsx` mit `size="large"` (nur im Hero verwendet): Eine Auswahl aus dem Autocomplete-Dropdown (Ort oder „Im Guide"-Restaurant) füllt nur das Eingabefeld und merkt sich die Auswahl (`pendingSelection`) — es wird **nicht** navigiert. Auch Enter ohne hervorgehobenen Dropdown-Eintrag tut nichts. Navigation (inkl. Anhängen der gestagten Filter als wiederholte Query-Params, z.B. `?cuisine=Italienisch&cuisine=Indisch`) passiert ausschließlich über den Klick auf den „Suchen"-Button (`handleSearch`). Das Ergebnis landet in `SearchResultsView` (Karte + Liste). `size="compact"` (Verfeinerungs-Suchleiste innerhalb von `SearchResultsView`) verhält sich weiterhin wie vorher: Auswahl/Enter navigiert sofort (kein sichtbarer Button, kein gestagter Filter-Zustand nötig).
- `app/page.tsx` liest `cuisine`/`price_level`/`spoon_rating` als wiederholte Query-Params (`string | string[]`, per `toArray()`-Helper normalisiert) und reicht sie als Arrays an `getRestaurants()`/`SearchResultsView` weiter. Unterhalb der Suchleiste (nur im Normal-Modus, nicht während einer Ortssuche) zeigt eine horizontal scrollbare „Neu hinzugefügt"-Reihe (`getRecentRestaurants()`, s. `app/actions/restaurants.ts`) bis zu 8 Restaurants der letzten 30 Tage, nur wenn welche vorhanden sind.
- `SearchResultsView.tsx`s eigene Filter-Chips navigieren **nicht** mehr sofort bei Klick — sie sind wie auf der Landing-Page lokal gestaged (`pending`-State) und werden erst per „Übernehmen"-Button in die URL übernommen (s. Eintrag zu `SearchResultsView.tsx` oben). Das Staging-Verhalten gilt damit durchgängig für alle Filter-Chips der App, nicht mehr nur für die Landing-Page vor dem ersten Suchen.

### `components/admin/PlacesAutocomplete.tsx`
Client Component. Gibt bei Auswahl ein `PlaceSelection`-Objekt zurück:
```ts
{ name: string; placeId: string; address: string; lat: number; lng: number; cuisine: string | null }
```
`address` (formatierte Adresse aus der Places-Antwort, `formattedAddress`/`formatted_address` je nach API-Variante) wird **nicht** persistiert (s. „Adresse und Bilder werden nicht in der DB gespeichert" oben) — im Admin-Dashboard (`AdminDashboard.tsx`) nur als flüchtiger `placeAddress`-State gehalten, um im Edit-Panel direkt unter der Google-Suchzeile eine klare Bestätigung „das ist der übernommene Eintrag" zu zeigen (Name + Adresse, Fallback auf Koordinaten wenn keine Adresse verfügbar). Wird bei `openNew`/`openEdit` zurückgesetzt, da bestehende Restaurants keine gespeicherte Adresse haben.

`cuisine` ist ein best-effort Vorschlag, kein garantierter Wert: aus `primaryTypeDisplayName` (neue Places-API) bzw. `primaryType`/`types` (beide API-Varianten, `_restaurant`-Suffix wird abgeschnitten und snake_case prettifiziert) abgeleitet, `null` wenn nichts Brauchbares gefunden wird (z.B. nur generische Typen wie `restaurant`/`food`/`point_of_interest`). Überschreibt im Admin-Dashboard das `cuisine`-Formularfeld bei Auswahl, das Feld bleibt aber ein freies Text-Input (kein festes Dropdown mehr) — der Admin kann den Vorschlag jederzeit korrigieren.

### `components/map/MapView.tsx`
Client Component. Erwartet Restaurants mit lat/lng für Kartenanzeige. Marker-Füllfarbe kommt aus `SPOON_RATING_COLORS` (`lib/ratings.ts`, CSS-Custom-Properties) statt fixer Hex-Werte — vorher hartkodierte Marker-Farben blieben im Dark Mode unverändert, was gegen „Farben nie hartkodieren" (s. „Dark Mode" unten) verstieß.

### `components/PriceLevelDots.tsx`
Reine Darstellungskomponente: `level === 0` rendert Text „Kostenlos", `level` 1–4 rendert „€"-Zeichen (abgedunkelt oberhalb von `level`), `level === null` rendert nichts. Einzige Stelle mit dieser Logik — nicht erneut inline implementieren. **Wichtig:** `0` ist ein gültiger, von `null` verschiedener Wert — Call-Sites und Filter-Logik müssen `== null`/`!== undefined` statt truthy-Checks verwenden (sonst verschwindet der „Kostenlos"-Fall).

### `components/RatingDots.tsx`
Generische gefüllte/leere Kreis-Anzeige, `max - min + 1` Kreise, Kreis `i` (von `min` bis `max`) gefüllt wenn `i <= value`. Ersetzt die früher inline duplizierte Spoon-Punkte-Logik auf der Restaurant-Detailseite (jetzt `<RatingDots value={restaurant.spoon_rating} max={3} color={...} />`, `min` default `0`) und wird für die 1–5-Kategorie-Bewertungen verwendet (`min={1} max={5}` — bewusst 5 statt 6 wählbare Werte, `0` ist keine gültige Kategorie-Bewertung mehr). Optionaler `color`-Prop färbt gefüllte Dots (Default `var(--c-gold)`) — für Spoon-Ratings wird `SPOON_RATING_COLORS[rating].text` übergeben, damit die Dots zur Bewertungsstufe passen statt immer Gold zu sein. Ohne `onChange` rein darstellend (`<span>`s, für Server Components/Detailseite), mit `onChange` klickbare `<button>`s (Admin-Editor) — dieselbe Datei funktioniert in beiden Kontexten, solange die Interaktivität nur innerhalb eines bereits-Client-Baums (z.B. `AdminDashboard.tsx`) verdrahtet wird.

### `components/StarRating.tsx`
Rein lesende Durchschnitts-Sterne-Anzeige (0–5) mit Teilfüllung — pro Stern zwei überlagerte Glyphen (grauer Grundstern + goldener Stern, dessen `width` per `overflow:hidden` auf den Bruchteil geclippt wird), sodass z.B. ein Durchschnitt von 3,5 drei volle + einen halb gefüllten Stern zeigt. Nutzt `computeAverageRating()` aus `lib/ratings.ts` als Eingabe.

## `lib/ratings.ts`
Single Source of Truth für Bewertungs-bezogene Konstanten/Helper — wird von `RestaurantCard`, der Detailseite, `SearchResultsView`, `MapView`, `FilterBar` und `AdminDashboard` importiert, bei neuen Stellen immer von hier importieren statt neu zu deklarieren:
- `SPOON_RATINGS`, `SPOON_RATING_ORDER` — Spoon-Rating-Emoji/Labels
- `SPOON_RATING_COLORS` — konsequente Farbcodierung je Rating-Stufe (`{ text, bg, border }`, CSS-Custom-Properties: 3=Success-Grün, 2=Gold, 1=Neutral, 0=Burgunder), verwendet auf der Detailseite (Verdict-Box + Dots), `RestaurantCard`, `SearchResultsView`, `MapView`-Marker und im Admin-`SpoonBadge` — bei neuen Stellen mit Spoon-Rating immer von hier importieren statt eigene Farben zu erfinden
- `REVIEW_CATEGORY_ORDER`, `REVIEW_CATEGORY_LABELS` — feste Reihenfolge/Labels der 4 Kategorie-Unterbewertungen (Service/Location/Geschmack/Preis-Leistung), Bewertung jeweils 1–5 (s. `RatingDots` oben)
- `computeAverageRating(ratings)` — Durchschnitt aus `comments.secondary_rating`-Werten (`null` wenn keine bewerteten Kommentare vorhanden), Eingabe für `StarRating`

## Dark Mode

Ausschließlich über CSS Custom Properties in `app/globals.css` — **kein** Tailwind `dark:`-Variant (nicht konfiguriert, würde nur auf OS-Präferenz reagieren statt auf die manuelle Nutzerwahl).

- Tokens: `--c-bg`, `--c-surface`, `--c-ink`, `--c-gold`/`-light`/`-mid`, `--c-burg`/`-light`, `--c-success`/`-light`, `--c-n50`…`--c-n700`. Je einmal für Light (`:root`), System-Dark (`@media (prefers-color-scheme: dark)`), explizit `[data-theme="dark"]` und explizit `[data-theme="light"]` definiert — bei neuen Tokens **immer alle vier Stellen** pflegen.
- Umschaltung: `ThemeToggle.tsx` setzt `document.documentElement.dataset.theme` + Cookie `gp-theme` (1 Jahr); Server liest das Cookie beim ersten Render, damit kein Flash/Mismatch entsteht.
- **Neue Komponenten/Farben immer über die Tokens**, nie hartkodierte Tailwind-Farbklassen (`text-stone-500`, `bg-white`, `#4a1520` o.ä.) oder eigene Hex-Werte — sonst bricht Dark Mode für diese Stelle. Zwei Muster im Code:
  - Server Components / viele Client Components: inline `style={{ color: "var(--c-ink)" }}` (s. `Header.tsx`, `FilterBar.tsx`)
  - Tailwind-lastige Components (z.B. `AdminDashboard.tsx`): Arbiträre Werte `text-[var(--c-ink)]`, `bg-[var(--c-surface)]`, `border-[var(--c-n200)]` etc.
- Rot/Grün/Gelb-Badges (Status, Danger-Buttons) nutzen **keine** eigenen Ampel-Farben, sondern die vorhandenen Marken-Tokens: „danger" → `--c-burg`/`-light`, „success/approved" → `--c-success`/`-light`, „pending/warn" → `--c-gold`/`-light` — hält die Palette klein und garantiert Dark-Mode-Konsistenz.

## Responsive Design & PWA-Ziel

**Die App muss durchgehend sowohl auf Desktop als auch auf Mobile gut aussehen und benutzbar sein** — nicht nur „funktioniert technisch", sondern layout- und bedienungsmäßig auf beiden Formfaktoren geprüft. Grund: geplant ist, die App später zusätzlich als installierbare Web-App (PWA) auf Mobilgeräten anzubieten — ein primär für Desktop gedachtes Layout wäre dafür ungeeignet.

- Bei jeder neuen/geänderten Komponente/Seite: Tailwind-Breakpoints (`sm:`/`md:`/`lg:`) bewusst einsetzen, nicht nur die Desktop-Ansicht im Kopf haben. Insbesondere Modals/Slide-Over-Panels (s. `AdminDashboard.tsx`), Tabellen (auf Mobile ggf. horizontal scrollbar oder alternative Kartenansicht) und die Landing-Page-Suche (`HeroSearch`/`FilterBar`/`LocationSearch`) im Blick behalten.
- Wo möglich per Browser-Test (Playwright) sowohl in einer Desktop- als auch einer Mobile-Viewport-Größe verifizieren, bevor ein UI-Task als abgeschlossen gilt (s. Hinweis unter „UI/Frontend-Änderungen" in den allgemeinen Arbeitsanweisungen).
- **PWA-Umsetzung selbst steht noch aus** (kein `manifest.json`, kein Service Worker, kein „Add to Home Screen"-Meta-Tag bisher im Code) — das ist ein zukünftiger Roadmap-Schritt, aber schon jetzt ein Grund, neue UI grundsätzlich mobile-tauglich zu bauen statt es später nachzuziehen.

## Wichtige Muster

- **Server-first**: Datenabruf in Server Components, Mutationen als Server Actions
- **Kein API-Layer**: Keine Route Handlers für CRUD — direkt Server Actions. Ausnahme: `app/api/auth/email/route.ts`, weil Supabase dies als HTTP-Webhook aufruft (Server Actions sind dafür nicht ansprechbar)
- **revalidatePath nach Mutation**: Immer aufrufen um Next.js Cache zu leeren
- **Typen aus `types/database.ts`**: Nie inline tippen — immer die exportierten Convenience-Typen verwenden (`Restaurant`, `Comment`, `Profile`, `DataSource`, `RestaurantReview`, `RestaurantReviewCategory`, `ReviewWithCategories`, `RestaurantWithComments`, `CommentWithProfile`)
- **Google-Daten nie cachen**: Places-API-Antworten mit `cache: "no-store"` — Öffnungszeiten und Foto-URIs verfallen täglich
- **Spoon-Ratings aus `lib/ratings.ts`**: Emoji/Label nie inline duplizieren — von dort importieren
- **Farben nie hartkodieren**: Immer CSS-Custom-Properties aus `app/globals.css` verwenden (s. „Dark Mode" oben) — sonst bricht Dark Mode an dieser Stelle
- **Responsive Pflicht**: Jede neue/geänderte UI muss sowohl auf Desktop als auch auf Mobile gut aussehen (s. „Responsive Design & PWA-Ziel" unten) — kein Feature gilt als fertig, wenn es nur auf einer Breakpoint-Größe getestet wurde

## Entwicklung

```bash
npm run dev    # Startet auf http://localhost:3000
npm run build  # Produktions-Build
npm run lint   # ESLint
```

> Hinweis: `AGENTS.md` enthält wichtigen Hinweis zu Next.js 16 Breaking Changes — vor dem Schreiben von Next.js-Code lesen.

## Roadmap (Stand 2026-07-15)

Reihenfolge nach Abhängigkeiten, nicht nach Bedeutung. Status hier bei jedem abgeschlossenen Schritt aktualisieren.

1. **Zugriffsmodell: Login-Pflicht + Registrierungs-Freischaltung durch Admin** — ✅ umgesetzt, per Browser-Test (Playwright) verifiziert
   `profiles.status` (`pending`/`approved`/`rejected`), RLS auf `restaurants`/`comments` nur für `approved`, `proxy.ts` gated jede Route außer `/login`, `/auth/confirm`, `/pending`, `/api/auth/email`, Admin-Dashboard hat Freischalt-UI. **Bricht bewusst mit der bisherigen Doku-Aussage „Besucher sehen die Liste"** — Besucher-Ebene entfällt.
   Migrationen (alle gepusht, 2026-07-15):
   - `20260715000001_registration_approval.sql` — `profiles.status`, `is_approved()`, RLS-Umstellung
   - `20260715000002_fix_username_trigger.sql` — Bugfix: `handle_new_user()`-Trigger persistierte `username` aus dem Signup nie (nur `id` wurde inserted), gefunden beim Testen der Freischalt-Liste
   - `20260715000003_admin_profile_update.sql` — Bugfix: es fehlte eine RLS-Policy, die Admins erlaubt, `profiles` **anderer** Nutzer zu updaten (nur „self update" existierte) → Freischalten/Ablehnen aktualisierte 0 Zeilen, ohne Fehler zu werfen (dieselbe Policy trägt jetzt auch Promote/Demote in der Nutzerverwaltung, s.u.). `approveProfile`/`rejectProfile`/`promoteToAdmin`/`demoteFromAdmin` prüfen jetzt zusätzlich, dass tatsächlich eine Zeile getroffen wurde, statt einem stillen No-op zu vertrauen.

   **Nutzerverwaltung im Admin-Dashboard** (Sektion „Nutzerverwaltung", unter „Registrierungen ausstehend") — ✅ umgesetzt, per Browser-Test verifiziert: Admins können jeden Account zum Admin machen/Admin-Status entfernen oder komplett löschen, jede der drei Aktionen mit zweistufiger Bestätigung (Schritt 1: Ja/Abbrechen, Schritt 2: exakte E-Mail eintippen, Confirm-Button bis dahin disabled). Serverseitig in `app/actions/profiles.ts`: kein Self-Target möglich, letzter verbleibender Admin kann nicht demoted/gelöscht werden (`assertNotSelf`/`assertNotLastAdmin`).

   **Hardcoded Haupt-Admin** (`lib/admin.ts`, Migration `20260715000004_hardcode_primary_admin.sql`) — ✅ umgesetzt, per Browser-Test verifiziert: `uhllucas@icloud.com` ist fest als Admin hinterlegt und kann über die UI nie demoted/gelöscht werden (`assertNotPrimaryAdmin`, UI zeigt „Haupt-Admin"-Badge statt Action-Buttons). Details s. „Auth & Berechtigungen".
2. **Preis-Rating auf 0–4 erweitern** — ✅ umgesetzt (0 = kostenlos), noch nicht per Browser-Test verifiziert
   `PriceLevel` in `types/database.ts` ist jetzt `0|1|2|3|4`. Migration `20260715000005_price_level_zero.sql` (gepusht) lockert den DB-Constraint von `between 1 and 4` auf `between 0 and 4`. `PriceLevelDots.tsx` und `PriceBadge` (`AdminDashboard.tsx`) rendern `0` jetzt als „Kostenlos" statt es wie `null` zu behandeln. `PRICE_OPTIONS`/`PRICE_CHIPS` (Admin-Formular, `FilterBar`, `SearchResultsView`) haben einen neuen „Kostenlos"-Eintrag. Dabei mehrere truthy-Checks auf `price_level` gefunden und gefixt, die `0` fälschlich wie „kein Filter" behandelt hätten (`getRestaurants` in `restaurants.ts`, URL-Aufbau in `SearchResultsView.tsx`) — s. Hinweis bei `PriceLevelDots.tsx` oben.
3. **Bilder nur noch aus Google Maps referenzieren** — ✅ umgesetzt, noch nicht per Browser-Test verifiziert
   `app/actions/storage.ts` (nie an eine UI angebunden) entfernt, ebenso alle Zugriffs-Policies auf den `restaurant-images`-Bucket (Migration `20260715000006`) — der Bucket selbst bleibt als leere, policy-lose (= für niemanden außer dem Service-Role-Key erreichbare) Restleiche in Supabase bestehen, da `storage.objects`/`storage.buckets` nicht per direktem SQL `DELETE` änderbar sind (Supabase erzwingt dafür die Storage API, SQLSTATE 42501); bei Bedarf manuell im Dashboard löschen. Restaurant-Detailseite zeigt genau die ersten 3 `photoUris` aus `places.ts` (1 großes Hero-Bild + 2 Thumbnails, vorher waren es bis zu 4).
4. **Nutzer-Bewertung: Sterne 0–5 + 150-Zeichen-Kommentar + Durchschnittsanzeige** — ✅ umgesetzt, noch nicht per Browser-Test verifiziert
   `comments.secondary_rating`-Check-Constraint auf `between 0 and 5` erweitert (Migration `20260715000006`), `addComment`/`updateComment` validieren zusätzlich `content.length <= 150`. `CommentForm.tsx`: eigener „0"-Chip links neben den 5 Sternen (da 0 jetzt ein gültiger, von „nichts gewählt" verschiedener Wert ist, analog zum `price_level`-0-Muster), Live-Zeichenzähler. Durchschnitt über `computeAverageRating()` (`lib/ratings.ts`) aus den bereits geladenen `restaurant.comments`, visualisiert über `<StarRating>` (Halb-Stern-Füllung) neben der „Reader Experiences"-Überschrift.
5. **Unterkategorien-Bewertung** (Service / Location / Geschmack / Preis-Leistung, je 0–5, Überschrift + Absatz) — ✅ umgesetzt, noch nicht per Browser-Test verifiziert
   Neue Tabellen `restaurant_reviews` (ein Aufenthalt: Datum, Spoon-Rating, Fazit — ersetzt `restaurants.official_review`) und `restaurant_review_categories` (bis zu 4 optionale Zeilen je Aufenthalt, unique je `(review_id, category)`), s. Schema oben. `restaurants.spoon_rating` bleibt als schnell filterbare Spalte erhalten, wird aber per Trigger `sync_restaurant_spoon_rating` immer aus dem aktuellsten Aufenthalt abgeleitet statt direkt editiert. Kategorien sind im Admin-Editor unabhängige, optionale Sektionen (Überschrift + Text + `RatingDots`-Picker), auf der Detailseite als eigene Karten unterhalb des Fazits gerendert (nur befüllte Kategorien).
6. **Mehrfach-Aufenthalte: ausklappbare „Letzter Besuch"-Sektion** — ✅ umgesetzt, noch nicht per Browser-Test verifiziert
   Baut auf Schritt 5 auf: `getRestaurantById` liefert alle `restaurant_reviews` eines Restaurants absteigend nach `visited_at`/`created_at` sortiert; `reviews[0]` = aktueller Aufenthalt (Fazit + Kategorien direkt auf der Seite), `reviews.slice(1)` = Historie. Nur wenn mehr als ein Aufenthalt existiert, erscheint vor dem „Reader Experiences"-Trenner eine Sektion „Vorherige Aufenthalte" mit je einem nativen `<details>`-Element pro altem Aufenthalt (`<summary>`: Datum + Spoon-Emoji, ausgeklappt: volles damaliges Fazit + Kategorien über dieselbe `ReviewContent`-Render-Hilfsfunktion wie beim aktuellen Aufenthalt). Admin-seitig entscheidet die Checkbox „Als neuen Aufenthalt speichern" im Edit-Panel, ob eine Änderung den aktuellen Aufenthalt korrigiert (`updateReview`) oder einen neuen historischen Eintrag anlegt (`createReview`).

   Migration für Schritte 3–6 (lokal erstellt, **noch nicht gepusht** — `supabase db push` steht noch aus): `20260715000006_reviews_and_ratings.sql`.
7. **Admin/Editor: CSV-Import + Entwurf/Veröffentlicht-Status** — ✅ umgesetzt, noch nicht per Browser-Test verifiziert
   Bestehende Editieren/Löschen-Funktionalität war bereits vorhanden (`updateRestaurant`/`deleteRestaurant`, Edit-Panel + Delete-Modal im Admin-Dashboard). Neu:
   - **CSV-Import** (`app/actions/csvImport.ts`, `ImportModal` in `AdminDashboard.tsx`): Import einer Google-Takeout-„Gespeicherte Orte"-Liste, gleicht per `google_place_id` (aus der `URL`-Spalte extrahiert) bzw. Namen gegen bestehende Restaurants ab, zeigt eine Vorschau (Neu/Bereits vorhanden) und importiert die vom Admin bestätigte Auswahl als `draft`-Restaurants mit Platzhalter-Erstaufenthalt.
   - **`restaurants.status`** (`'draft'|'published'`, Migration `20260715000007_restaurant_status.sql`): Admins können jeden Eintrag (neu oder bestehend) über eine Checkbox im Edit-Panel auf „Entwurf" stellen — per RLS für normale Nutzer dann komplett unsichtbar, im Dashboard weiterhin voll sichtbar (Badge + „Nur Entwürfe"-Filter). Macht CSV-importierte Rohzeilen automatisch privat, bis ein Admin sie manuell vervollständigt und veröffentlicht.

   Migration: `20260715000007_restaurant_status.sql` (lokal erstellt, **noch nicht gepusht** — zusammen mit `20260715000006_reviews_and_ratings.sql` per `supabase db push` ausstehend).
8. **PWA-Deployment (installierbare Web-App für Mobile)** — 📋 geplant, noch nicht begonnen
   Ziel: die App zusätzlich als installierbare Progressive Web App anbieten (s. „Responsive Design & PWA-Ziel" oben). Bisher existiert kein `manifest.json`, kein Service Worker und kein Home-Screen-Meta-Tag. Bis zur Umsetzung gilt Mobile-Tauglichkeit jeder UI trotzdem schon jetzt als Pflicht, damit hier keine nachträgliche Layout-Schulden entstehen.
