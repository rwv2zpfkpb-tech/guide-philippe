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
    LoginForm.tsx          – Client Component: Login/Signup-Tabs, plus dritter (nicht in der Tab-Leiste sichtbarer) „forgot"-Zustand: ein „Passwort vergessen?"-Link unter dem Passwort-Feld des Login-Tabs wechselt zu einem reinen E-Mail-Formular, das `requestPasswordReset` auslöst (s. „Auth & Berechtigungen")
  auth/confirm/
    page.tsx              – Server Component: Ziel des Signup-Bestätigungslinks. Tauscht PKCE-`code` gegen Session (`exchangeCodeForSession`), zeigt Erfolgs-/Fehler-Screen
  auth/reset-password/
    page.tsx              – Server Component: gemeinsames Ziel für „Passwort vergessen" (Login-Seite) **und** „Passwort ändern" (eingeloggt, `UserMenu`) — beide lösen dieselbe Server Action (`requestPasswordReset`) aus, s. „Auth & Berechtigungen". Tauscht PKCE-`code` gegen Session (wie `auth/confirm`), zeigt danach `ResetPasswordForm`
    ResetPasswordForm.tsx – Client Component: „Neues Passwort"/„Passwort bestätigen"-Formular, ruft `updatePassword` (Server Action, benötigt aktive Session)
  pending/
    page.tsx              – Server Component: Screen für eingeloggte, aber noch nicht admin-freigeschaltete Accounts (`profiles.status = 'pending'/'rejected'`). Ziel des proxy-Redirects, s.u.
  restaurant/[id]/
    page.tsx              – Detailseite (Places-Details, Fazit + Kategorie-Bewertungen, Aufenthalts-Historie, Kommentare). Oben ein `<BackButton fallbackHref="/">` statt eines festen „Alle Restaurants"-Links (s. „Zurück-Navigation" unten). Fazit wird als Headline (erster Satz) + restlicher Fließtext gerendert (`ReviewContent`), nicht mehr als Headline + vollständig wiederholtem Text. Die Kategorie-Karten (Service/Location/Geschmack/Preis-Leistung) stehen als einspaltige Liste untereinander statt als 2×2-Grid — die App ist für längere Fließtexte je Kategorie gedacht, ein schmales Grid-Feld war dafür zu eng. Öffnungszeiten stehen in einem `<details>`-Block (`.oh-details`-CSS in `globals.css`), standardmäßig eingeklappt, mit rotierendem Chevron als Ausklapp-Indikator; hat Google keine Live-Öffnungszeiten (kein `google_place_id`, fehlgeschlagener Lookup, oder Google kennt sie nicht), zeigt eine einfache Box stattdessen `restaurant.opening_hours` (manueller Freitext-Fallback), falls gesetzt. Adresse: `placeDetails?.formattedAddress` (live von Google, falls `google_place_id` vorhanden) mit Fallback auf das gespeicherte `restaurant.address`-Feld (manuell erfasste Restaurants haben keinen Live-Lookup) — dasselbe Live-mit-Fallback-Muster gilt für Telefon (`placeDetails?.phone || restaurant.phone`, „Anrufen"-Button mit `tel:`-Link) und Website (`placeDetails?.website || restaurant.website`, Link in neuem Tab), beide neben `<NavigateButton>` unter der Identity-Zeile, nur gerendert wenn ein Wert vorhanden ist. Preis-Level (`<PriceLevelDots>`) steht **nicht** mehr klein in der Meta-Zeile neben Adresse/Öffnungszeiten, sondern groß/fett (`1.75rem`, Cormorant) direkt gegenüber dem Cuisine-Eyebrow-Label — beide teilen sich eine `justify-content: space-between`-Zeile ganz oben im linken Identity-Block, damit der Preis nicht neben der kleinschriftigen Meta-Zeile untergeht. Spoon-Verdict-Box + Dots sind farbcodiert (`SPOON_RATING_COLORS`); auf schmalen Viewports (`.restaurant-hero-row`/`.restaurant-hero-verdict`, `max-width: 640px`) stapelt sich die Identity-Zeile statt die Verdict-Box isoliert in eine sonst leere Zeile umbrechen zu lassen
    loading.tsx
    CommentForm.tsx        – Client Component: Kommentar abgeben (0–5 Sterne, 150-Zeichen-Limit)
  actions/                – Alle Server Actions ("use server")
    auth.ts               – signIn / signUp / signOut / requestPasswordReset / updatePassword
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
  Header.tsx, Footer.tsx   – Layout-Rahmen (Server Components). Header rendert für eingeloggte Nutzer `<UserMenu>` statt separater Sign-out-/Passwort-Buttons (s.u.)
  UserMenu.tsx             – Client Component: Kebab-Menü (Drei-Punkte-Icon, `IconDotsVertical`) rechts im Header, hinter dem „Passwort ändern" (löst `requestPasswordReset` mit der eigenen E-Mail aus) und „Abmelden" versteckt sind — hält den Header selbst auf schmalen Viewports schlank (nur Username + ein Icon-Button sichtbar). Unter dem „Passwort ändern"-Button steht klein „Schickt dir einen Link per E-Mail", damit vor dem Klick klar ist, dass kein Inline-Formular folgt, sondern ein E-Mail-Versand ausgelöst wird; der Erfolgszustand ersetzt den Button durch „E-Mail mit Link verschickt — bitte Postfach prüfen." statt nur „Link verschickt". Schließt bei Klick außerhalb (`mousedown`-Listener auf `document`)
  ThemeToggle.tsx          – Client Component: Hell-/Dunkelmodus-Umschalter
  NavigationProgress.tsx   – Client Component: Ladebalken bei Routenwechsel
  BackButton.tsx           – Client Component: `router.back()`-Button mit `fallbackHref`-Prop (Deep-Link/neuer Tab ohne In-App-History → normaler `<Link>` statt History-Pop), s. „Zurück-Navigation" unten
  DeleteCommentButton.tsx  – Client Component: kapselt das Inline-„Löschen"-Formular eines Kommentars (`deleteComment`) auf der Restaurant-Detailseite. Nur wegen `useFormStatus()` als eigene Datei ausgelagert — die Detailseite selbst ist eine Server Component, `useFormStatus` braucht einen Client-Baum, um den Button während des Requests auf „Löscht…" umzuschalten statt keinerlei Feedback zu geben
  InstallPwaInstructions.tsx – Client Component: PWA-Installationsanleitung (iOS Safari „Zum Home-Bildschirm" / Android Chrome „App installieren"), erkennt per `navigator.userAgent` die passende Plattform und hebt sie hervor, zeigt aber beide. Ganz unten auf der Landing-Page (`app/page.tsx`), rein informativ (kein `beforeinstallprompt`-Handling)
  icons.tsx                – Kleines Set monochromer SVG-Icons (Heroicons-outline-Stil, 24×24, `currentColor`) — ersetzt alle dekorativen Emojis in der App (s. „Keine Emojis außer Spoon-Rating" unten). Spoon-Rating-Emoji (`lib/ratings.ts`) bleiben bewusst die einzige Ausnahme. Enthält u.a. `IconPhone`/`IconGlobe` (Anrufen-/Website-Buttons auf der Restaurant-Detailseite), `IconStar` (optional `filled`-Prop — „Auswahl"-Toggle im Admin-Dashboard) und `IconDotsVertical` (Kebab-Menü-Trigger, `UserMenu.tsx`)
  HeroSearch.tsx           – Client Component: hält den lokal gestagten Filter-Zustand der Landing-Page-Suche (s. „Landing-Page-Suche" unten), rendert LocationSearch + FilterBar
  FilterBar.tsx            – Client Component: Küche/Preis/Bewertung-Filterchips. **Controlled** (kein eigener Router-/URL-Zugriff mehr) — Mehrfachauswahl je Kategorie, Zustand kommt von HeroSearch als Props
  LocationSearch.tsx       – Client Component: Orts-/Restaurantsuche (Google Places). `size="large"` (Landing-Page-Hero): löst erst beim Klick auf „Suchen" aus, s.u. `size="compact"` (Suchleiste in SearchResultsView): navigiert weiterhin sofort bei Auswahl/Enter. Zwischen Klick/Auswahl und dem eigentlichen `router.push` liegt ein Google-Places/Geocoder-Request (Koordinaten auflösen) — dieser Zwischenschritt zeigt einen `resolving`-State (Spinner statt Lupe im Eingabefeld, „Sucht…" auf dem Suchen-Button, Eingabe gesperrt), da er selbst noch vor der Navigation liegt und damit nicht vom routenweiten `loading.tsx` abgedeckt ist
  SearchResultsView.tsx    – Client Component: Liste + Karte für Ortssuche. Desktop: klassisches Nebeneinander (Liste 420px fest + Karte flex). Mobile (< 900px, s. `.sr-viewport`/`.sr-list-panel`/`.sr-map-panel` in `globals.css`): Liste und Karte liegen nebeneinander in einem doppelt breiten Viewport, ein fixierter Toggle-Button verschiebt den Viewport per CSS-`transform` um 50% (Liste ↔ Karte) statt hart umzuschalten — beide Panels bleiben gemountet (Karteninstanz bleibt erhalten). Eigene Filter-Chips sind wie auf der Landing-Page gestaged (s. „Landing-Page-Suche" unten) — Klick ändert nur lokalen State, erst „Übernehmen" navigiert; die ganze Komponente ist mit `key={JSON.stringify(activeFilters)}` verdrahtet, damit der gestagte State nach jeder Navigation zurückgesetzt wird (kein `useEffect`-Sync). Kein Bild-Platzhalter mehr in den Listenkarten (s. „Kein Self-Hosting von Bildern" unten) — Spoon-Rating stattdessen farbcodiert (`SPOON_RATING_COLORS`). Jede Trefferzeile (`ResultCard`) ist ein aufklappbares Element (kein direkter `<Link>` mehr auf die Detailseite): Klick togglet ein Panel mit live geladenen Öffnungszeiten (`getPlaceDetails`, lazy erst beim Aufklappen) plus zwei Buttons „Zur Restaurant-Seite" und `<NavigateButton>`. Immer nur eine Zeile gleichzeitig aufgeklappt — der `expanded`-State (`expandedId: string | null`) liegt dafür in `SearchResultsViewInner` (nicht mehr lokal in `ResultCard`); Öffnen einer neuen Zeile klappt automatisch die vorher offene ein
  RestaurantCard.tsx       – Karte in der Restaurant-Grid-Ansicht. Kein Bild-Platzhalter (s. „Kein Self-Hosting von Bildern" unten) — stattdessen farbcodierter oberer Rand + Label passend zur Spoon-Rating-Stufe (`SPOON_RATING_COLORS` aus `lib/ratings.ts`)
  PriceLevelDots.tsx       – Gemeinsame Preisanzeige (0 = „Kostenlos", 1–4 = €-Symbole)
  RatingDots.tsx           – Generische gefüllte/leere Kreis-Anzeige (`value`/`min`/`max`, optional `onChange` für klickbare Admin-Picker, optional `color` für farbcodierte Dots) — für Spoon-Rating (min=0, max=3, `color` aus `SPOON_RATING_COLORS`) und Kategorie-Bewertungen (min=1, max=5 — 5 statt 6 wählbare Werte)
  StarRating.tsx           – Nutzer-Sterne-Durchschnitt mit Halb-Stern-Füllung (CSS-Clip-Technik), neben „Reader Experiences"
  NavigateButton.tsx       – Client Component: „Route planen"-Button auf der Restaurant-Detailseite **und** (aufgeklappt) in `SearchResultsView`s Trefferzeilen. Erkennt beim Klick per `navigator.userAgent`, ob iOS/Android/Desktop: iOS → Apple-Maps-Universal-Link (`maps.apple.com/?daddr=...`), Android → `geo:`-URI (öffnet die installierte Karten-App per Intent), sonst (Desktop) → Google-Maps-Routenplaner im neuen Tab (`google.com/maps/dir/?api=1&destination=...&destination_place_id=...`)
  admin/
    PlacesAutocomplete.tsx – Google Places Autocomplete (Client). Liefert bei Auswahl neben Name/Place-ID/Koordinaten auch einen best-effort Cuisine-Vorschlag aus Googles Place-Type (`primaryTypeDisplayName`/`primaryType`/`types`), s. „Admin-Dashboard" unten
  map/
    MapView.tsx            – Kartenansicht (Client). Marker-Farben kommen aus `SPOON_RATING_COLORS` (`lib/ratings.ts`) statt bespoke Hex-Werten — damit auch im Dark Mode korrekt statt fix eingefärbt. Wechselt reaktiv (per `MutationObserver` auf `<html data-theme>` + `matchMedia`-Listener) zwischen zwei Google-Maps-Map-IDs für Light/Dark, s. „Karten-Dark-Mode" unten. `<Map>` nutzt bewusst unkontrolliertes `defaultCenter`/`defaultZoom` (vis.gl wendet das nur beim Mount an, damit manuelles Pannen/Zoomen während einer Session nicht vom `center`-Prop überschrieben wird) — der `key` der `<Map>` kombiniert deshalb Map-ID **und** Center-Koordinaten, damit ein Remount erzwungen wird, sobald sich der gesuchte Ort ändert (z.B. neue Suche über die Suchleiste innerhalb von `SearchResultsView`); ohne diesen Teil des Keys blieb die Karte nach einer Anschluss-Suche auf dem alten Ort stehen, während die Liste bereits die neuen Treffer zeigte

lib/
  ratings.ts               – Single Source of Truth für Spoon-Rating-Emoji/Labels, Kategorie-Labels/-Reihenfolge und `computeAverageRating()`
  cuisine.ts               – `guessCuisine(primaryTypeDisplayName, primaryType, types)`: best-effort Cuisine-Vorschlag aus einem Google-Places-Typ. Geteilt zwischen `components/admin/PlacesAutocomplete.tsx` (Client, Places-JS-SDK-Objekte) und `app/actions/places.ts`s `resolvePlaceForImport` (Server, REST-API-JSON) — beide füttern dieselbe Feld-Kombination hinein, die Heuristik soll nur an einer Stelle leben
  pwa-icon.tsx              – `gpMarkElement(size)`: gemeinsame „GP"-Wortmarken-JSX für `app/icon.tsx`/`app/apple-icon.tsx`/`app/icons/*/route.tsx` (via `next/og` `ImageResponse`, kann keine CSS-Custom-Properties lesen — Hex-Werte matchen `lib/auth-emails.ts`)
  resend.ts                – getResendClient() Factory + RESEND_FROM_EMAIL (Server-only)
  auth-emails.ts           – Deutsche HTML-Templates für Supabase-Auth-Mails (signup, recovery, ...)
  admin.ts                 – PRIMARY_ADMIN_EMAIL (hardcoded Haupt-Admin, s. „Auth & Berechtigungen")

utils/supabase/
  server.ts        – createClient() für Server Components / Actions
  client.ts        – createClient() für Client Components
  admin.ts         – createAdminClient() (Service-Role-Key, nur Server)
  proxy.ts         – updateSession() — Session-Refresh + `PUBLIC_PATHS` (Routen ohne Login-Zwang, s. „Auth & Berechtigungen")
  auth-helpers.ts  – requireAuth() / requireAdmin()

types/
  database.ts      – Alle DB-Typen, händisch gepflegt (Supabase-Schema)

proxy.ts           – Läuft auf jeder Route außer statischen Assets (Next.js 16: ehem. middleware.ts)
public/
  map-style.json            – Custom Google Maps Stil (Light Mode), legacy `featureType`/`elementType`/`stylers`-Array-Schema — nur der lokale JS-Fallback (`styles`-Prop), wenn keine Map-ID gesetzt ist
  map-style-dark.json       – Dunkles Pendant zu map-style.json (gleiches Legacy-Schema), s. „Karten-Dark-Mode" unten
  map-style-cloud-light.json – Gleicher Stil wie map-style.json, aber im **anderen** JSON-Schema (`variant`/`styles[].id`/`geometry`/`label`) für den Cloud-Console-„Map Styles"-Import-Wizard (Map-ID-Styling) — die beiden Schemas sind NICHT austauschbar, s. „Karten-Dark-Mode" unten
  map-style-cloud-dark.json  – Dunkles Pendant im Cloud-Schema
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
- `google_place_id` text | null — für Live-Daten von Google. `null` bei manuell erfassten Restaurants (s. „Manuelle Restaurant-Erfassung" unten) — kein Live-Lookup (Öffnungszeiten/Fotos) möglich, Admin-Tabelle zeigt „No place ID"-Badge
- `lat`, `lng` float | null
- `address` text | null (Migration `20260716000001_restaurant_address.sql`) — Adresse aus der Places-Autocomplete-Auswahl oder manuell erfasst; dient der Restaurant-Detailseite als Fallback, wenn kein `google_place_id` vorhanden ist oder der Live-Lookup fehlschlägt
- `phone` text | null, `website` text | null (Migration `20260716000002_restaurant_contact_info.sql`) — wie `address`: standardmäßig live von Google Places bezogen (`getPlaceDetails()`), aber zusätzlich persistiert als Fallback für manuell erfasste Restaurants/fehlgeschlagenen Live-Lookup. Live-Wert hat immer Vorrang (`placeDetails?.phone || restaurant.phone`, s. Restaurant-Detailseite)
- `opening_hours` text | null (Migration `20260716000002_restaurant_contact_info.sql`) — rein manuelles Freitextfeld (z. B. „Mo–Fr 12–22 Uhr"), es gibt keine Live-Quelle dafür außer Googles `regularOpeningHours`. Wird auf der Detailseite nur angezeigt, wenn Google keine Live-Öffnungszeiten liefert (kein `google_place_id`, fehlgeschlagener Lookup, oder Google kennt sie schlicht nicht)
- `cuisine` text | null
- `price_level` 0–4 | null (0 = kostenlos, 1–4 = € bis €€€€)
- `spoon_rating` 0–3 (Kern-Bewertungssystem, s.u.) — **kein direkt editierbares Feld mehr**, sondern per DB-Trigger (`sync_restaurant_spoon_rating`) immer aus dem `restaurant_reviews`-Eintrag mit dem höchsten `(visited_at, created_at)` für dieses Restaurant abgeleitet
- `status` `'draft'|'published'` (Default `'published'`, Migration `20260715000007_restaurant_status.sql`) — `draft` ist für normale Nutzer per RLS komplett unsichtbar (s. „Auth & Berechtigungen"), im Admin-Dashboard aber voll sichtbar/editierbar (Badge „Entwurf"). Neu importierte CSV-Einträge (s. `csvImport.ts`) landen immer als `draft`, bis ein Admin sie vervollständigt und veröffentlicht
- `featured` boolean (Default `false`, Migration `20260716000003_restaurant_featured.sql`) — schaltet ein Restaurant für die „Auswahl"-Reihe auf der Landing-Page frei (s. `getFeaturedRestaurants()` unten), unabhängig von der zeitbasierten „Neu hinzugefügt"-Reihe. Admins toggeln dies per Stern-Icon direkt in der Restaurant-Tabelle (`setFeatured()`, kein Umweg über das Edit-Panel nötig)
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

**Kein anonymer Zugriff.** `proxy.ts` gated jede Route: nicht eingeloggt → `/login`, eingeloggt aber nicht `approved` → `/pending`. Öffentlich erreichbar bleiben nur `/login`, `/auth/confirm`, `/auth/reset-password`, `/pending`, `/api/auth/email` (Supabase-Webhook, kein Nutzer-Session-Kontext) sowie `/manifest.webmanifest`, `/icon`, `/apple-icon`, `/icons/*` (PWA-Metadaten — der Browser-Tab-Favicon muss auch auf `/login` selbst laden, und Chrome/Safari fragen das Manifest teils vor dem Login ab).

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

### HTTP-Security-Header (`next.config.ts`)

`headers()` in `next.config.ts` setzt app-weit `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` und ein restriktives `Permissions-Policy` (keine Kamera/Mikrofon/Geolocation/USB — wird von der App nirgends genutzt). Bewusst **keine** Content-Security-Policy: Google Maps/Places (JS-SDK + Kachel-/Font-Requests) und die über Resend verschickten Auth-Mails laden von genug Drittanbieter-Origins, dass eine CSP erst gegen eine echte Browser-Session aufgebaut/verifiziert werden müsste, um nicht versehentlich die Karte oder den Auth-Flow lautlos zu brechen — offener Folgeschritt statt Rätselraten.

### E-Mail-Versand (Resend statt Supabase-SMTP)

Supabase Auth verschickt Bestätigungslinks etc. weiterhin selbst (Token-Erzeugung, Verifizierung über den gehosteten `/auth/v1/verify`-Endpunkt bleibt unverändert) — aber **nicht mehr per eigenem SMTP**, sondern über den [Send Email Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook):

1. Supabase ruft bei jeder Auth-Mail (`signup`, `recovery`, `magiclink`, `invite`, `email_change`, `reauthentication`) `POST /api/auth/email` auf (`app/api/auth/email/route.ts`) — signiert nach dem [Standard-Webhooks](https://www.standardwebhooks.com/)-Format.
2. Die Route verifiziert die Signatur mit dem Paket `standardwebhooks` (Secret: `SEND_EMAIL_HOOK_SECRET`, Format `v1,whsec_...`).
3. Aus `token_hash` / `email_action_type` / `redirect_to` wird die gleiche Bestätigungs-URL gebaut, die auch Supabases eigene Default-Templates verwenden (`${SUPABASE_URL}/auth/v1/verify?token=...&type=...&redirect_to=...`) — es gibt **keine eigene Verify-Route**, GoTrue übernimmt Prüfung + Redirect wie gehabt.
4. Das passende deutsche HTML-Template kommt aus `lib/auth-emails.ts`, verschickt wird über `lib/resend.ts` (`getResendClient()`, Absender `RESEND_FROM_EMAIL`).
5. Bei `reauthentication` gibt es keinen Link, sondern einen 6-stelligen Code (`email_data.token`) zum manuellen Eingeben.

Konfiguration in Supabase Dashboard → Authentication → Hooks → Send Email Hook → URL auf `/api/auth/email` zeigen lassen, Secret dort kopieren und als `SEND_EMAIL_HOOK_SECRET` setzen. Ohne konfiguriertes `RESEND_API_KEY`/`SEND_EMAIL_HOOK_SECRET` antwortet die Route mit HTTP 500 (bricht den Auth-Flow bewusst ab, statt E-Mails zu verschlucken).

**Bestätigungsscreen nach Signup** (`app/auth/confirm/page.tsx`): `signUp()` in `app/actions/auth.ts` setzt `emailRedirectTo: ${origin}/auth/confirm`. GoTrue verifiziert den Token selbst (hosteter `/auth/v1/verify`-Endpoint) und redirected danach mit einem PKCE-`code` an diese Seite; sie tauscht den Code per `exchangeCodeForSession` gegen eine Session und zeigt Erfolgs- (eingeloggt, Link zur Startseite) oder Fehler-Screen (Link zum Login). **Wichtig:** `${origin}/auth/confirm` muss in Supabase Dashboard → Authentication → URL Configuration → Redirect URLs eingetragen sein, sonst verwirft GoTrue die Redirect-URL still und fällt auf die Site-URL zurück.

**Passwort zurücksetzen/ändern** (`app/auth/reset-password/page.tsx`): identisches Muster wie oben, aber für den `recovery`-Auth-Mail-Typ. Beide Auslöser landen auf demselben Ziel:
- **Passwort vergessen** (ausgeloggt): „Passwort vergessen?"-Link im Login-Tab von `LoginForm.tsx` → `requestPasswordReset(email)` → `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/reset-password` })`.
- **Passwort ändern** (eingeloggt): „Passwort ändern" im `<UserMenu>`-Kebab-Menü im Header → dieselbe `requestPasswordReset`-Action, aber mit der eigenen Session-E-Mail statt eines Formularfelds — es gibt bewusst **kein** Formular mit altem/neuem Passwort inline, nur den E-Mail-Link-Weg.
- `requestPasswordReset` meldet in beiden Fällen immer Erfolg zurück (unabhängig davon, ob die E-Mail existiert oder der Supabase-Call fehlschlägt) — verhindert, dass sich per Fehlermeldung erraten lässt, welche E-Mails ein Konto haben.
- GoTrue redirected nach Klick auf den Mail-Link mit einem PKCE-`code` an `/auth/reset-password`; die Seite tauscht ihn per `exchangeCodeForSession` gegen eine Session (genau wie `auth/confirm`) und zeigt danach `ResetPasswordForm` (neues Passwort + Bestätigung, min. 8 Zeichen) — das Formular ruft `updatePassword(password)` (`supabase.auth.updateUser({ password })`), was eine aktive Session voraussetzt.
- **Wichtig:** `/auth/reset-password` muss wie `/auth/confirm` in `PUBLIC_PATHS` (`utils/supabase/proxy.ts`) stehen — vor dem Code-Exchange existiert noch keine Session, ein Gate würde den Link samt `?code=`-Query-Param zu `/login` umleiten.

## Server Actions (`app/actions/`)

Alle Actions haben `"use server"` und laufen auf dem Server. API-Keys verlassen den Server nie.

### `auth.ts`
- `signIn` / `signUp` / `signOut` — s. „Auth & Berechtigungen"
- `requestPasswordReset(email)` — löst den `recovery`-Auth-Mail-Versand aus (s. „Passwort zurücksetzen/ändern" oben), immer `{ success: true }` unabhängig vom tatsächlichen Ergebnis
- `updatePassword(password, confirmPassword)` — setzt ein neues Passwort für die **aktuelle Session** (`supabase.auth.updateUser`), validiert Mindestlänge (8) + Übereinstimmung serverseitig

### `restaurants.ts`
- `getRestaurants(filters?)` — Liste, optional gefiltert nach `cuisine`, `price_level`, `spoon_rating`. Alle drei sind **Arrays** (Mehrfachauswahl je Kategorie, z.B. mehrere Küchen gleichzeitig) — intern per Supabase `.in()` statt `.eq()`. Filtert explizit `.eq("status", "published")` — s. Hinweis zu `getRecentRestaurants`/`getFeaturedRestaurants` unten, derselbe Grund gilt hier
- `getCuisines()` — Alle distinct `cuisine`-Werte **ungefiltert bzgl. Such-Filtern** (ignoriert aktive `cuisine`/`price_level`/`spoon_rating`-Filter), aber wie die drei Funktionen unten explizit auf `status = 'published'` eingeschränkt. Wichtig: die Küche-Filterchips in `FilterBar`/`SearchResultsView` müssen aus dieser Funktion stammen statt aus dem (evtl. bereits gefilterten) `getRestaurants()`-Ergebnis — sonst verschwinden Küche-Chips beim Kombinieren mehrerer Filter, weil dann nur noch Küchen der übrig gebliebenen Treffer auftauchen
- `getRecentRestaurants(limit = 8)` — Restaurants mit `created_at` innerhalb der letzten 30 Tage, neueste zuerst; speist die „Neu hinzugefügt"-Reihe auf der Landing-Page (`app/page.tsx`)
- `getFeaturedRestaurants()` — alle Restaurants mit `featured = true`, alphabetisch; speist die „Auswahl"-Reihe auf der Landing-Page (unabhängig von „Neu hinzugefügt")

  **Alle vier oben filtern explizit `.eq("status", "published")`, nicht nur implizit über RLS.** Grund: RLS blendet Entwürfe zwar für normale Nutzer aus, aber `is_admin()` erlaubt Admins vollen SELECT-Zugriff — ohne den expliziten Filter hätte ein Admin, der (nicht im `/admin/dashboard`, sondern) ganz normal die Startseite/Suche/„Neu hinzugefügt" besucht, dort versehentlich Entwürfe zwischen den echten Einträgen gesehen. `getRestaurantById()` filtert bewusst **nicht** so — Admins müssen einen Entwurf über den Tabellen-Link in der Admin-Tabelle direkt aufrufen können (RLS lässt das für Admins ohnehin zu, Nicht-Admins bekommen dort weiterhin per RLS keine Zeile zurück).
- `setFeatured(id, featured)` — Admin-only, Quick-Toggle für das Stern-Icon in der Admin-Tabelle (kein Umweg über `updateRestaurant`/Edit-Panel)
- `getRestaurantById(id)` — Einzelnes Restaurant inkl. verschachtelter Comments + Profiles sowie `reviews` (alle Aufenthalte inkl. `categories`, client-seitig nach `visited_at`/`created_at` absteigend sortiert — `reviews[0]` ist immer der aktuelle Aufenthalt, s. `restaurant_reviews` oben)
- `createRestaurant(payload, review)` — Admin-only, legt Restaurant **und** dessen ersten Aufenthalt in einem Aufruf an (ruft intern `createReview` aus `reviews.ts`), `revalidatePath("/", "layout")`. `payload` enthält **kein** `spoon_rating`/`official_review` mehr — das kommt aus `review`
- `updateRestaurant(id, payload)` — Admin-only, revalidiert Startseite + Detailseite (nur Stammdaten: Name/Küche/Preis/Places-Felder — Bewertungsinhalte laufen über `reviews.ts`)
- `deleteRestaurant(id)` — Admin-only
- `deleteRestaurants(ids)` — Admin-only, Bulk-Löschen (ein `.in("id", ids)`-Request statt einer Schleife) — Backend für die Mehrfachauswahl im Admin-Dashboard (s.u.)

Bilder werden **nicht** in der DB gespeichert — kommen live von der Google Places API. Die Adresse (`restaurants.address`) wird seit Migration `20260716000001_restaurant_address.sql` dagegen **zusätzlich** persistiert (aus der Places-Autocomplete-Auswahl oder manueller Eingabe) — nötig, damit manuell erfasste Restaurants (kein `google_place_id`, s. „Manuelle Restaurant-Erfassung" unten) und ein fehlschlagender Live-Lookup trotzdem eine Adresse anzeigen können.

### `csvImport.ts`
Import einer Google-Takeout-„Gespeicherte Orte"-Liste (Spalten `Title`/`Titel`, `Note`/`Notiz`, `URL`) mit Abgleich gg. bestehende Restaurants — zweistufiger Flow (Preview → Confirm), damit der Admin vor dem eigentlichen Import sieht, was neu ist und was bereits existiert:
- `previewCsvImport(csvText)` — Admin-only, reiner Dry-Run (keine DB-Schreibzugriffe, keine Places-API-Aufrufe). Parst die CSV client-unabhängig serverseitig (eigener kleiner RFC4180-artiger Parser, keine Library-Abhängigkeit — behandelt gequotete Felder/eingebettete Kommas/Zeilenumbrüche), extrahiert pro Zeile eine `google_place_id` aus der `URL`-Spalte (`place_id:...` oder `query_place_id=...`-Muster) sowie optional eine `note` aus der `Note`/`Notiz`-Spalte (nur zur späteren Fazit-Vorbefüllung, kein Pflichtfeld), und gleicht dann gegen alle bestehenden Restaurants ab: zuerst per `google_place_id`, sonst per case-insensitivem Namensvergleich. Erkennt die Titel-Spalte sowohl als `Title` (EN) als auch `Titel` (DE, je nach Kontosprache des Google-Takeout-Exports); wirft einen Fehler, wenn weder `Title`/`Titel` noch `URL`-Spalte gefunden wird (falsches Export-Format). **Bekannte Einschränkung:** moderne Google-Maps-„Gespeicherte Orte"-Exporte enthalten in der `URL`-Spalte oft Share-Links im Format `.../data=!4m2!3m1!1s0x...:0x...` (ein Feature-/CID-Hash) statt eines klassischen `place_id:...`/`query_place_id=...`-Musters — daraus lässt sich hier keine `google_place_id` extrahieren (wird aber in `confirmCsvImport` per Namenssuche nachgeholt, s.u.). Betroffene Zeilen landen trotzdem korrekt als „Neu" (Matching fällt auf Namensvergleich zurück) und zeigen im Preview einen „Maps ↗"-Link zur manuellen Kontrolle. Der `mapsUrl`-Wert wird vor der Rückgabe per `sanitizeMapsUrl()` auf `http`/`https`-Schema geprüft (sonst `null`) — er landet ungefiltert als echtes `<a href>` im Preview-Modal, und ohne diese Prüfung hätte eine präparierte CSV (z.B. eine gefälschte „Google-Takeout"-Datei) dort eine `javascript:`-URI unterbringen können, die in der authentifizierten Admin-Session ausgeführt würde, sobald der Admin draufklickt
- `confirmCsvImport(selection, bulkSpoonRating?)` — Admin-only, `selection` ist die vom Admin im Preview bestätigte Teilmenge der als „neu" markierten Zeilen (`{ name, googlePlaceId, note }[]`). Legt für jede Zeile **einzeln** (nicht per Batch-Insert, um Restaurant↔Notiz eindeutig zuzuordnen) ein Restaurant mit `status: 'draft'` an sowie einen Platzhalter-Aufenthalt (`spoon_rating: bulkSpoonRating ?? 1`, `visited_at: heute`) in `restaurant_reviews` — hält die Invariante „≥1 Review pro Restaurant" ein. `bulkSpoonRating` (0–3) lässt den Admin im Preview-Schritt des `ImportModal` ein Spoon-Rating auswählen, das für **alle** importierten Zeilen gilt — nützlich, wenn die CSV-Liste selbst schon einer einzigen Bewertungsstufe entspricht (z.B. eine Google-Maps-Liste, die nur „Worth Mentioning"-Orte enthält), statt danach jeden Platzhalter-Aufenthalt einzeln im Edit-Panel korrigieren zu müssen. Pro Zeile wird zusätzlich `resolvePlaceForImport(name, googlePlaceId)` (s. `places.ts`) aufgerufen, um `google_place_id` + `lat`/`lng` **sowie Adresse + Cuisine-Vorschlag** schon beim Import zu befüllen (bestmöglicher Vorschlag per direkter ID-Auflösung oder Textsuche nach dem Namen — schlägt die Auflösung fehl oder wird die aufgelöste `google_place_id` wegen einer Kollision verworfen, s.u., bleiben alle vier Felder `null`, kein Abbruch des Imports). Ein vorhandener CSV-Kommentar (`note`) wird direkt als `fazit` des Platzhalter-Aufenthalts übernommen statt leer zu bleiben. Der Admin prüft/vervollständigt Kartendaten/Fazit/Kategorien/Cuisine/Preis über den normalen Edit-Panel-Flow (inkl. Places-Autocomplete zur Korrektur) und entfernt dort das „Als Entwurf speichern"-Häkchen, sobald der Eintrag fertig ist
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
- `getPendingProfiles()`/`getAllProfiles()` liefern zusätzlich `email` (via `createAdminClient()`, service-role), da `profiles` keine E-Mail-Spalte hat. Intern über einen einzelnen `adminClient.auth.admin.listUsers({ perPage: 1000 })`-Aufruf (Lookup-Map nach `id`) statt einem `getUserById()`-Aufruf pro Profil — Letzteres feuerte bei N Accounts N parallele Admin-API-Requests auf jedem Dashboard-Load, was mit wachsender Nutzerzahl nicht skaliert (s. „theoretisch 100+ Accounts" bei der Nutzerverwaltung unten)

### `comments.ts`
- `addComment(restaurantId, content, secondaryRating)` — Auth required. `secondaryRating` 0–5, `content` max. 150 Zeichen (nach `.trim()`) — beides serverseitig validiert (wirft `Error`)
- `updateComment(commentId, restaurantId, content, secondaryRating)` — Auth required; gleiche Validierung wie `addComment`; RLS blockiert Fremdzugriff
- `deleteComment(commentId, restaurantId)` — Auth required; RLS erlaubt nur Owner oder Admin
- `adminDeleteComment(commentId, restaurantId)` — Admin-only

### `places.ts`
- `getPlaceDetails(placeId)` — Ruft Google Places API (New) auf: `formattedAddress`, `regularOpeningHours`, bis zu 3 `photoUris` (einzige Call-Sites — Restaurant-Detailseite und Admin-Edit-Panel — zeigen beide maximal 3), sowie `phone`/`website` (`internationalPhoneNumber`/`websiteUri`). Request mit `languageCode=de&regionCode=DE`, damit `weekdayDescriptions` bereits als deutsche „Tag: Zeiten"-Strings zurückkommen (statt Englisch) — die Restaurant-Detailseite (`app/restaurant/[id]/page.tsx`) parst diese Strings am ersten `:` in Tag/Zeiten-Spalten und hebt den heutigen Wochentag farblich hervor
- `resolvePlaceForImport(name, placeId)` — Für den CSV-Import (`csvImport.ts`): löst zu einem Namen (+ evtl. bereits extrahierter Place-ID) `google_place_id` + `lat`/`lng` **sowie Adresse (`formattedAddress`) und einen `cuisine`-Vorschlag** (per `guessCuisine()`, `lib/cuisine.ts` — dieselbe Heuristik wie `PlacesAutocomplete.tsx`) auf. Bei vorhandener `placeId` erst direkte Detail-Abfrage (Places API `places/{id}`, Feldmaske `id,location,formattedAddress,primaryTypeDisplayName,primaryType,types`, mit `languageCode=de&regionCode=DE` — sonst kommt der Cuisine-Vorschlag auf Englisch zurück); schlägt das fehl (z.B. weil die extrahierte ID gar keine echte Place-ID war, s. CID-Einschränkung bei `csvImport.ts`) oder war `placeId` von vornherein `null`, Fallback auf Textsuche (`places:searchText` mit `textQuery: name`, dieselbe Feldmaske, `languageCode`/`regionCode` hier im POST-Body statt als Query-Params) — genommen wird der erste Treffer. Liefert `null`, wenn beides fehlschlägt (kein Fehler, Import läuft mit leeren Kartendaten weiter)
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
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=     # optional: Cloud-Console-Map-ID für Light Mode (AdvancedMarker-Support), s. "Karten-Dark-Mode"
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID_DARK= # optional: zweite Map-ID für Dark Mode, verknüpft mit public/map-style-dark.json in der Cloud Console
GOOGLE_PLACES_API_KEY=              # nur Server, für Places API
RESEND_API_KEY=                     # nur Server, für Auth-Mail-Versand
RESEND_FROM_EMAIL=                  # muss auf verifizierter Resend-Domain liegen
SEND_EMAIL_HOOK_SECRET=             # Standard-Webhooks-Secret aus Supabase Send Email Hook
```

## Admin-Dashboard (`/admin/dashboard`)

- **Server Component** (`page.tsx`): Auth-Guard (redirect zu `/login` wenn nicht eingeloggt, redirect zu `/` wenn kein Admin), lädt initiale Restaurant-Liste + `getPendingProfiles()` + `getCuisines()` (als `cuisineSuggestions`-Prop, s. Cuisine-Combobox unten), rendert `<AdminDashboard>`
- **Client Component** (`AdminDashboard.tsx`): oben ein `<BackButton fallbackHref="/">`. Sektion „Registrierungen ausstehend" (Freischalten/Ablehnen via `approveProfile`/`rejectProfile`, immer sichtbar), Sektion „Nutzerverwaltung" (Zum Admin machen/Admin-Status entfernen/Löschen via `promoteToAdmin`/`demoteFromAdmin`/`deleteUserAccount`, `UserActionModal` mit zweistufiger Bestätigung) — **standardmäßig eingeklappt** (State `userMgmtOpen`, Klick auf den Header mit Konten-Anzahl + Chevron expandiert sie), da theoretisch 100+ Accounts registriert sein könnten und das Dashboard sonst bei jedem Besuch voll ausgeklappt rendern würde. Tabelle mit Suche + „Nur Entwürfe"-Filter-Toggle, Slide-Over-Panel zum Erstellen/Bearbeiten (inkl. Sichtbarkeits-Checkbox „Als Entwurf speichern"), CSV-Import-Modal (`ImportModal`), Delete-Modal, Toast-Benachrichtigungen. Der Restaurant-**Name** in der Tabelle ist selbst ein `<Link target="_blank">` zur öffentlichen Detailseite (ersetzt den früheren separaten „Ansehen"-Link); Edit/Delete-Buttons sind **immer sichtbar** (kein `opacity-0 group-hover:opacity-100` mehr — auf Mobile gibt es keinen Hover-Zustand, das Ein-/Ausblenden war dort nur hinderlich)
- **Mehrfachauswahl + Bulk-Löschen**: Jede Tabellenzeile hat eine Checkbox (Spalte ganz links, State `selectedIds: Set<string>`), Header-Checkbox wählt/deselektiert alle aktuell **gefilterten** Zeilen. Sobald `selectedIds.size > 0`, erscheint über der Tabelle eine Leiste („X ausgewählt" + „Auswahl aufheben" + „Löschen"). „Löschen" öffnet dasselbe `DeleteModal` wie der Einzel-Löschen-Button in jeder Zeile — die Komponente ist auf `restaurants: Restaurant[]` verallgemeinert (1 Eintrag → Name in der Bestätigung, mehrere → Anzahl) und ruft je nach Fall `deleteRestaurant`/`deleteRestaurants` (`app/actions/restaurants.ts`) auf.
- **CSV-Import** (`ImportModal`, Button „CSV-Import" neben „Add new"): zweistufig — Schritt „pick" (Datei-Auswahl, liest die Datei client-seitig per `file.text()` und schickt den Rohtext an `previewCsvImport`), Schritt „preview" (oben ein **optionaler** Spoon-Rating-Chip-Picker „Spoon-Rating für neue Einträge" — State `importBulkSpoonRating: 0|1|2|3|null`, Default `null` = keine Auswahl; erneuter Klick auf einen bereits aktiven Chip deselektiert ihn wieder. Gilt, falls gesetzt, für **alle** neuen Zeilen dieses Imports, praktisch wenn die CSV-Liste bereits einer einzigen Bewertungsstufe entspricht; darunter Liste „Neu" mit Checkboxen, standardmäßig alle an, plus Liste „Bereits vorhanden" nur informativ/nicht auswählbar mit Verweis auf den passenden bestehenden Namen; Zeilen ohne extrahierte Place-ID zeigen einen „Maps ↗"-Link zur manuellen Zuordnung später). „Importieren" ruft `confirmCsvImport` mit der ausgewählten Teilmenge (inkl. `note`) + `importBulkSpoonRating ?? undefined` — ohne Auswahl fällt `confirmCsvImport` serverseitig auf den bisherigen Default (1, „Remembering") zurück; die Zeilen landen ohnehin als `draft` und lassen sich später im Edit-Panel korrigieren (dort macht die Pflichtfeld-Hervorhebung, s.u., ein fehlendes bewusstes Rating sichtbar). Neue Restaurants (immer `status: 'draft'`, mit per `resolvePlaceForImport` bestmöglich vorbefüllten Kartendaten und Notiz-als-Fazit, s. `csvImport.ts`) werden vorne in die Tabelle eingefügt. `confirmCsvImport` patcht den zurückgegebenen `spoon_rating`-Wert in-memory auf das verwendete Rating (dieselbe Korrektur wie bei `createRestaurant`) — sonst zeigt die Tabelle direkt nach dem Import kurzzeitig das falsche (Default-)Emoji, weil der zurückgegebene Datensatz vor dem `sync_restaurant_spoon_rating`-Trigger erfasst wurde
- **„Auswahl"-Toggle**: Stern-Icon (`IconStar`) ganz links in der Actions-Spalte jeder Tabellenzeile, klickbar unabhängig vom Edit-Panel — ruft `setFeatured(id, !r.featured)` (`app/actions/restaurants.ts`) auf und aktualisiert die Zeile optimistisch (Rollback bei Fehler). Gefüllter goldener Stern = Restaurant erscheint in der „Auswahl"-Reihe auf der Landing-Page (`getFeaturedRestaurants()`, s. `app/page.tsx`)
- **Entwurf/Veröffentlicht** (`status`-Feld): Tabellenzeilen mit `status === 'draft'` zeigen ein goldenes „Entwurf"-Badge neben dem Namen; der Toggle-Button „Nur Entwürfe" filtert die Tabelle clientseitig auf diese Zeilen. Im Edit-Panel steuert eine Checkbox („Als Entwurf speichern (für Nutzer unsichtbar, bis veröffentlicht)") `form.status`, Default bei neuen Restaurants ist `'published'`
- Benutzt `useTransition` für optimistische Updates
- Google Places Autocomplete im Edit-Panel — befüllt Name, `google_place_id`, lat/lng, `address` **und** einen best-effort `cuisine`-Vorschlag automatisch (s. `PlacesAutocomplete.tsx` oben). Das Cuisine-Feld ist eine eigene `CuisineCombobox`-Komponente (freies Text-Input + echtes gefiltertes Dropdown, kein natives `<input list>` mehr — dessen Browser-Pfeil/Filterverhalten war inkonsistent und wirkte wie ein Dropdown, das „nicht funktioniert"): Vorschläge kommen aus `cuisineSuggestions` (= `getCuisines()`, tatsächlich bereits verwendete Küchen-Werte, keine hartkodierte Liste mehr), gefiltert per Substring-Match während der Eingabe (z. B. „ca" → „Café"); Klick auf einen Vorschlag übernimmt ihn, das Feld bleibt aber frei editierbar für neue Werte. Sobald eine `google_place_id` im Formular steht (frisch ausgewählt oder von einem bestehenden Restaurant geladen), lädt ein `useEffect` zusätzlich per `getPlaceDetails(placeId)` (`app/actions/places.ts`) eine Fotovorschau (bis zu 3 Bilder aus `photoUris`) sowie Telefonnummer/Website (nur wenn die Formularfelder noch leer sind, überschreibt also keine bereits gespeicherten/korrigierten Werte) direkt unter der Adress-Bestätigung — zweite Call-Site dieser Action neben der Restaurant-Detailseite
- **Kontakt & Öffnungszeiten** (Abschnitt im Edit-Panel, unter Cuisine): drei Toggle-Chips („Telefonnummer"/„Website"/„Öffnungszeiten", State `visibleContactFields: Set<ContactField>` in `AdminDashboard`) blenden das jeweilige Eingabefeld ein/aus — so bleibt das Formular übersichtlich, wenn ein Restaurant z. B. keine Website hat. Telefon/Website-Chips werden automatisch aktiviert, sobald Google beim Places-Lookup einen Wert liefert; Öffnungszeiten ist immer rein manuell (kein Live-Pendant außer den Google-Öffnungszeiten weiter oben im Formular-Fluss). Deaktivieren eines Chips leert auch den zugehörigen Formularwert. Funktioniert identisch im Google-Such- und im manuellen Erfassungs-Modus (s. „Manuelle Restaurant-Erfassung" unten) — genau die Felder, die für einen Eintrag relevant sind, lassen sich so gezielt hinzufügen. Direkt über den Toggle-Chips zeigt ein kleiner Hinweis-Block (grüner Haken vs. neutrales Uhr-Icon, State `hasLiveOpeningHours` — aus demselben `getPlaceDetails()`-Aufruf wie die Fotovorschau, s.u.), ob Google für diesen Ort bereits Live-Öffnungszeiten liefert — macht sichtbar, dass die manuelle Eingabe hier nur ein Fallback ist, statt dass der Admin das erst auf der Live-Seite entdeckt.
- **Manuelle Restaurant-Erfassung** (Fallback, wenn Google Maps einen Ort nicht kennt): Button „Ort manuell erfassen" über dem Google-Suchfeld schaltet auf freie Text-Inputs um (Name, Adresse, optional Latitude/Longitude) — `google_place_id` bleibt `null`, was überall im Code bereits gracefully gehandhabt wird (kein Live-Lookup für Öffnungszeiten/Fotos, Admin-Tabelle zeigt „No place ID"). State `manualEntry` (in `AdminDashboard`, nicht in `EditPanel` selbst — das Panel bleibt beim Restaurant-Wechsel gemountet und wird nur per CSS ein-/ausgeblendet, ein lokaler State würde beim Restaurant-Wechsel nicht zurückgesetzt). `openEdit` setzt `manualEntry` automatisch auf `true`, wenn das geladene Restaurant kein `google_place_id` hat. Der „Kontakt & Öffnungszeiten"-Abschnitt (s.o.) steht unverändert auch im manuellen Modus zur Verfügung — dort ohne automatische Google-Vorbefüllung, der Admin wählt per Toggle-Chip gezielt aus, welche Zusatzfelder (Telefon/Website/Öffnungszeiten) dieser Eintrag überhaupt hat
- Slide-Over-Panel (`EditPanel`) ist auf Desktop breiter als früher (`max-w-lg` → `sm:max-w-xl lg:max-w-2xl`); die 4 Kategorie-Karten stehen einspaltig untereinander (kein 2-Spalten-Grid mehr) — genug Breite zum Schreiben längerer Fließtexte je Kategorie, dieselbe Begründung wie bei der öffentlichen Darstellung auf der Detailseite. Fotovorschau zeigt maximal 3 Bilder (`placePhotos.slice(0, 3)`, deckungsgleich mit der Detailseite)
- **Edit-Panel — Aktuelle Bewertung + Kategorien**: Beim Öffnen eines bestehenden Restaurants lädt `openEdit` erst per `getRestaurantById` den aktuellen Aufenthalt + Historie (`loadingEditId` sperrt währenddessen den Edit-Button der Zeile), bevor sich das Panel öffnet. Spoon-Rating/Datum/Fazit gehören zum aktuellen Aufenthalt; die 4 Kategorie-Karten (Service/Location/Geschmack/Preis-Leistung, s. `REVIEW_CATEGORY_ORDER`) sind unabhängige, optionale Sektionen mit je Überschrift/Text/`RatingDots`-Picker (1–5). Checkbox „Als neuen Aufenthalt speichern" entscheidet beim Speichern zwischen `updateReview` (Korrektur des aktuellen Aufenthalts, Standard) und `createReview` (neuer historischer Eintrag mit eigenem Datum) — s. `app/actions/reviews.ts`. Bestehende ältere Aufenthalte werden schreibgeschützt als „Bisherige Aufenthalte" gelistet. Bei neuen Restaurants startet `form.review.spoon_rating` als `null` (nicht mehr mit „Absolute Recommendation" vorbelegt) — erzwingt eine bewusste Auswahl statt eines unbemerkt übernommenen Defaults, s. Pflichtfelder unten.
- **Pflichtfelder im Edit-Panel** (`getMissingRequiredFields()`, `AdminDashboard.tsx`): Name, Adresse (aus Google-Auswahl oder manuell erfasst), Preis, Spoon-Rating und Fazit. Nicht ausgefüllte Pflichtfelder werden live optisch hervorgehoben (Label + Rahmen in `--c-burg`, Asterisk), sobald das Feld leer ist — unabhängig vom Entwurf/Veröffentlicht-Status. „Name" blockiert das Speichern immer (auch als Entwurf); die übrigen vier blockieren den Save-Button nur, wenn `form.status === 'published'` — als Entwurf lässt sich ein unvollständiger Eintrag weiterhin speichern (z.B. frisch aus dem CSV-Import) und später vervollständigen. Der Footer zeigt zusätzlich eine Textzeile mit den fehlenden Feldnamen. Ein leeres Spoon-Rating wird beim Speichern intern auf `1` („Remembering") gemappt (DB-Spalte ist `NOT NULL`), bleibt aber in der UI als „nicht ausgewählt" sichtbar, bis der Admin aktiv einen Wert wählt.
- **Fazit-Vorschau** (Edit-Panel, unter dem Fazit-Textfeld): zeigt live, wie der Text auf der Restaurant-Detailseite gesplittet wird (`splitFazit()`, dieselbe Logik wie `ReviewContent` in `app/restaurant/[id]/page.tsx`) — der erste Satz (bis zum ersten Punkt) erscheint groß/serif als Überschrift, der Rest darunter als normaler Fließtext. Macht dem Admin beim Schreiben sichtbar, welcher Teil des Fazits als Headline gerendert wird, statt das erst auf der Live-Seite zu entdecken.
- **Kein eigener Header mehr** — früher rendertete `AdminDashboard.tsx` einen eigenen `sticky`-Header (Branding, „Admin"-Badge, Public-Site-Link, `<ThemeToggle>`) zusätzlich zum globalen `<Header>` aus `app/layout.tsx`, wodurch auf `/admin/dashboard` zwei Leisten übereinander erschienen. Entfernt — die Seite nutzt jetzt ausschließlich den globalen `<Header>` (der bei `role: 'admin'` ohnehin schon einen „Admin"-Link zeigt). Alle Farben über CSS-Custom-Properties, kein hartkodiertes Tailwind-Farbschema mehr

## Komponenten

### Landing-Page-Suche (`HeroSearch.tsx` + `FilterBar.tsx` + `LocationSearch.tsx`)

Filter-Klicks auf der Startseite lösen **keine** Navigation/Suche mehr aus — sie werden nur lokal gestaged, bis der Nutzer explizit sucht:

- `HeroSearch.tsx` (Client Component, im Hero-Bereich von `app/page.tsx`) hält den Filter-Zustand (`FilterSelection`: `{ cuisine: string[]; price_level: number[]; spoon_rating: number[] }`) in `useState` und reicht ihn kontrolliert an `FilterBar` (Anzeige/Toggle) sowie an `LocationSearch` (`filters`-Prop, wird erst beim Suchen in die URL geschrieben) weiter.
- `FilterBar.tsx` ist rein **controlled** — bekommt `selected` + Toggle-/Clear-Callbacks als Props, macht selbst keine Router-/URL-Aufrufe mehr. Mehrfachauswahl je Kategorie (Klick fügt hinzu/entfernt aus dem Array, kein Single-Select mehr). Jede Kategorie (Küche/Preis/Bewertung) hat einen „Alle"-Chip, der aktiv ist, wenn für diese Kategorie nichts ausgewählt ist (= Standardzustand, entspricht „kein Filter") und beim Klick die Kategorie zurücksetzt.
- `LocationSearch.tsx` mit `size="large"` (nur im Hero verwendet): Eine Auswahl aus dem Autocomplete-Dropdown (Ort oder „Im Guide"-Restaurant) füllt nur das Eingabefeld und merkt sich die Auswahl (`pendingSelection`) — es wird **nicht** navigiert. Auch Enter ohne hervorgehobenen Dropdown-Eintrag tut nichts. Navigation (inkl. Anhängen der gestagten Filter als wiederholte Query-Params, z.B. `?cuisine=Italienisch&cuisine=Indisch`) passiert ausschließlich über den Klick auf den „Suchen"-Button (`handleSearch`). Das Ergebnis landet in `SearchResultsView` (Karte + Liste). `size="compact"` (Verfeinerungs-Suchleiste innerhalb von `SearchResultsView`) verhält sich weiterhin wie vorher: Auswahl/Enter navigiert sofort (kein sichtbarer Button, kein gestagter Filter-Zustand nötig).
- `app/page.tsx` liest `cuisine`/`price_level`/`spoon_rating` als wiederholte Query-Params (`string | string[]`, per `toArray()`-Helper normalisiert) und reicht sie als Arrays an `getRestaurants()`/`SearchResultsView` weiter. Unterhalb der Suchleiste (nur im Normal-Modus, nicht während einer Ortssuche) zeigen zwei horizontal scrollbare Reihen — zuerst „Auswahl" (`getFeaturedRestaurants()`, admin-kuratiert per `featured`-Toggle, s. „Admin-Dashboard" unten), danach „Neu hinzugefügt" (`getRecentRestaurants()`, zeitbasiert, letzte 30 Tage, bis zu 8 Einträge) — beide nur gerendert, wenn die jeweilige Liste nicht leer ist.
- `SearchResultsView.tsx`s eigene Filter-Chips navigieren **nicht** mehr sofort bei Klick — sie sind wie auf der Landing-Page lokal gestaged (`pending`-State) und werden erst per „Übernehmen"-Button in die URL übernommen (s. Eintrag zu `SearchResultsView.tsx` oben). Das Staging-Verhalten gilt damit durchgängig für alle Filter-Chips der App, nicht mehr nur für die Landing-Page vor dem ersten Suchen.

### `components/admin/PlacesAutocomplete.tsx`
Client Component. Gibt bei Auswahl ein `PlaceSelection`-Objekt zurück:
```ts
{ name: string; placeId: string; address: string; lat: number; lng: number; cuisine: string | null }
```
`address` (formatierte Adresse aus der Places-Antwort, `formattedAddress`/`formatted_address` je nach API-Variante) landet direkt in `form.address` und wird beim Speichern in `restaurants.address` persistiert (s. „Bilder werden nicht in der DB gespeichert" oben). Im Edit-Panel dient sie zusätzlich als flüchtige Bestätigungs-Anzeige direkt unter der Google-Suchzeile („das ist der übernommene Eintrag": Name + Adresse, Fallback auf Koordinaten wenn keine Adresse verfügbar).

`cuisine` ist ein best-effort Vorschlag, kein garantierter Wert: aus `primaryTypeDisplayName` (neue Places-API) bzw. `primaryType`/`types` (beide API-Varianten, `_restaurant`-Suffix wird abgeschnitten und snake_case prettifiziert) abgeleitet, `null` wenn nichts Brauchbares gefunden wird (z.B. nur generische Typen wie `restaurant`/`food`/`point_of_interest`). Überschreibt im Admin-Dashboard das `cuisine`-Formularfeld bei Auswahl, das Feld bleibt aber ein freies Text-Input (kein festes Dropdown mehr) — der Admin kann den Vorschlag jederzeit korrigieren.

### `components/map/MapView.tsx`
Client Component. Erwartet Restaurants mit lat/lng für Kartenanzeige. Marker-Füllfarbe kommt aus `SPOON_RATING_COLORS` (`lib/ratings.ts`, CSS-Custom-Properties) statt fixer Hex-Werte — vorher hartkodierte Marker-Farben blieben im Dark Mode unverändert, was gegen „Farben nie hartkodieren" (s. „Dark Mode" unten) verstieß.

### Karten-Dark-Mode
Google ignoriert das `styles`-JSON-Prop **immer**, sobald eine Map-ID gesetzt ist (nötig für die runden `AdvancedMarker`-Emoji-Pins) — eine einzelne Map-ID kann sich also nicht per JS auf Light/Dark umstellen. Lösung: zwei Map-IDs, je eine pro Theme, ausgewählt zur Laufzeit:
- `MapView.tsx` beobachtet `<html data-theme>` per `MutationObserver` (ThemeToggle.tsx mutiert das Attribut direkt ohne Event) + `matchMedia("(prefers-color-scheme: dark)")` für den Systemfall, und wählt daraus `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` (hell) oder `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID_DARK` (dunkel).
- Die `<Map>`-Komponente bekommt `key={mapId}` — Google-Map-IDs sind auf einer bestehenden Instanz unveränderlich, daher erzwingt der Key-Wechsel einen sauberen Remount statt eines stillen No-ops.
- Ist `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID_DARK` nicht gesetzt, fällt Dark Mode auf die helle Map-ID zurück (kein Fehler). **Manueller Schritt in der Google Cloud Console nötig**, um Dark Mode tatsächlich zu sehen: eine zweite Map-ID anlegen und dort einen Kartenstil verknüpfen, dann `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID_DARK` setzen.
- Ist gar keine Map-ID gesetzt (weder hell noch dunkel), greift der lokale Fallback: `styles={mapStyle}`/`styles={mapStyleDark}` (`public/map-style.json`/`public/map-style-dark.json`) direkt im Code — funktioniert dann aber ohne `AdvancedMarker`-Custom-Pins.
- **Zwei unterschiedliche, NICHT austauschbare JSON-Schemas** (per Trial & Error gefunden, 2026-07-16 — Cloud Console meldete „Syntax-Fehler" beim Versuch, das falsche Schema zu importieren):
  - `public/map-style.json`/`map-style-dark.json` — Legacy-Schema (`featureType`/`elementType`/`stylers`-Array). Nur für den lokalen JS-`styles`-Prop-Fallback (oben) relevant, wird **nie** in die Cloud Console eingefügt.
  - `public/map-style-cloud-light.json`/`map-style-cloud-dark.json` — Cloud-based-Maps-Styling-Schema (`{ "variant": "light"|"dark", "styles": [{ "id", "geometry": { "fillColor", "strokeColor", "strokeWidth" }, "label": { "textFillColor", "textStrokeColor", "visible" } }] }`). **Das ist das Format, das die Cloud Console → „Map Styles" → JSON-Import-Wizard erwartet** — dort den Inhalt der jeweiligen `map-style-cloud-*.json` einfügen, um eine Map-ID mit dem passenden Stil zu verknüpfen. `strokeWidth` darf hier (anders als evtl. vermutet) durchaus Dezimalwerte haben (z.B. `0.4`) — der Import-Fehler kam vom falschen Schema, nicht von Nachkommastellen.
  - Bei Änderungen an der Optik (Farben, Straßenbreiten etc.) **beide** Schema-Paare parallel pflegen, sonst laufen JS-Fallback und Cloud-Console-Stil auseinander.

### Zurück-Navigation (`components/BackButton.tsx`)
`router.back()`-Button statt fester `<Link href="/">`s, damit z.B. von der Restaurant-Detailseite aus die vorherige Suchergebnisliste (inkl. Scroll-Position/Filter) exakt wiederhergestellt wird statt immer zur Startseite zu springen. Erkennt per `document.referrer` (same-origin?) + `window.history.length`, ob überhaupt eine sinnvolle In-App-History existiert — sonst (Deep-Link, neuer Tab) rendert er stattdessen einen normalen `<Link href={fallbackHref}>`. Eingebaut auf der Restaurant-Detailseite (`fallbackHref="/"`) und im Admin-Dashboard (`fallbackHref="/"`); bewusst **nicht** auf `/login`, `/pending`, `/auth/confirm` (kein sinnvolles Rückziel, Teil des Auth-Flows).

### `components/PriceLevelDots.tsx`
Reine Darstellungskomponente: `level === 0` rendert Text „Kostenlos", `level` 1–4 rendert „€"-Zeichen (abgedunkelt oberhalb von `level`), `level === null` rendert nichts. Einzige Stelle mit dieser Logik — nicht erneut inline implementieren. **Wichtig:** `0` ist ein gültiger, von `null` verschiedener Wert — Call-Sites und Filter-Logik müssen `== null`/`!== undefined` statt truthy-Checks verwenden (sonst verschwindet der „Kostenlos"-Fall).

### `components/RatingDots.tsx`
Generische gefüllte/leere Kreis-Anzeige, `max - min + 1` Kreise, Kreis `i` (von `min` bis `max`) gefüllt wenn `i <= value`. Ersetzt die früher inline duplizierte Spoon-Punkte-Logik auf der Restaurant-Detailseite (jetzt `<RatingDots value={restaurant.spoon_rating} max={3} color={...} />`, `min` default `0`) und wird für die 1–5-Kategorie-Bewertungen verwendet (`min={1} max={5}` — bewusst 5 statt 6 wählbare Werte, `0` ist keine gültige Kategorie-Bewertung mehr). Optionaler `color`-Prop färbt gefüllte Dots (Default `var(--c-gold)`) — für Spoon-Ratings wird `SPOON_RATING_COLORS[rating].text` übergeben, damit die Dots zur Bewertungsstufe passen statt immer Gold zu sein. Ohne `onChange` rein darstellend (`<span>`s, für Server Components/Detailseite), mit `onChange` klickbare `<button>`s (Admin-Editor) — dieselbe Datei funktioniert in beiden Kontexten, solange die Interaktivität nur innerhalb eines bereits-Client-Baums (z.B. `AdminDashboard.tsx`) verdrahtet wird.

### `components/StarRating.tsx`
Rein lesende Durchschnitts-Sterne-Anzeige (0–5) mit Teilfüllung — pro Stern zwei überlagerte Glyphen (grauer Grundstern + goldener Stern, dessen `width` per `overflow:hidden` auf den Bruchteil geclippt wird), sodass z.B. ein Durchschnitt von 3,5 drei volle + einen halb gefüllten Stern zeigt. Nutzt `computeAverageRating()` aus `lib/ratings.ts` als Eingabe.

## `lib/ratings.ts`
Single Source of Truth für Bewertungs-bezogene Konstanten/Helper — wird von `RestaurantCard`, der Detailseite, `SearchResultsView`, `MapView`, `FilterBar` und `AdminDashboard` importiert, bei neuen Stellen immer von hier importieren statt neu zu deklarieren:
- `SPOON_RATINGS`, `SPOON_RATING_ORDER` — Spoon-Rating-Emoji/Labels
- `SPOON_RATING_COLORS` — konsequente Farbcodierung je Rating-Stufe (`{ text, bg, border }`, CSS-Custom-Properties: 3=Gold (beste Bewertung), 2=Flieder (`--c-lilac`, zweitbeste), 1=Altrosa/Mauve (`--c-mauve`, „Remembering"), 0=Grau (Not Recommended)), verwendet auf der Detailseite (Verdict-Box + Dots), `RestaurantCard`, `SearchResultsView`, `MapView`-Marker und im Admin-`SpoonBadge` — bei neuen Stellen mit Spoon-Rating immer von hier importieren statt eigene Farben zu erfinden
- `REVIEW_CATEGORY_ORDER`, `REVIEW_CATEGORY_LABELS` — feste Reihenfolge/Labels der 4 Kategorie-Unterbewertungen (Service/Location/Geschmack/Preis-Leistung), Bewertung jeweils 1–5 (s. `RatingDots` oben)
- `computeAverageRating(ratings)` — Durchschnitt aus `comments.secondary_rating`-Werten (`null` wenn keine bewerteten Kommentare vorhanden), Eingabe für `StarRating`

## Dark Mode

Ausschließlich über CSS Custom Properties in `app/globals.css` — **kein** Tailwind `dark:`-Variant (nicht konfiguriert, würde nur auf OS-Präferenz reagieren statt auf die manuelle Nutzerwahl).

- Tokens: `--c-bg`, `--c-surface`, `--c-ink`, `--c-gold`/`-light`/`-mid`, `--c-burg`/`-light`, `--c-success`/`-light`, `--c-lilac`/`-light`, `--c-mauve`/`-light`, `--c-n50`…`--c-n700`. Je einmal für Light (`:root`), System-Dark (`@media (prefers-color-scheme: dark)`), explizit `[data-theme="dark"]` und explizit `[data-theme="light"]` definiert — bei neuen Tokens **immer alle vier Stellen** pflegen.
- Umschaltung: `ThemeToggle.tsx` setzt `document.documentElement.dataset.theme` + Cookie `gp-theme` (1 Jahr); Server liest das Cookie beim ersten Render, damit kein Flash/Mismatch entsteht.
- **Neue Komponenten/Farben immer über die Tokens**, nie hartkodierte Tailwind-Farbklassen (`text-stone-500`, `bg-white`, `#4a1520` o.ä.) oder eigene Hex-Werte — sonst bricht Dark Mode für diese Stelle. Zwei Muster im Code:
  - Server Components / viele Client Components: inline `style={{ color: "var(--c-ink)" }}` (s. `Header.tsx`, `FilterBar.tsx`)
  - Tailwind-lastige Components (z.B. `AdminDashboard.tsx`): Arbiträre Werte `text-[var(--c-ink)]`, `bg-[var(--c-surface)]`, `border-[var(--c-n200)]` etc.
- Rot/Grün/Gelb-Badges (Status, Danger-Buttons) nutzen **keine** eigenen Ampel-Farben, sondern die vorhandenen Marken-Tokens: „danger" → `--c-burg`/`-light`, „success/approved" → `--c-success`/`-light`, „pending/warn" → `--c-gold`/`-light` — hält die Palette klein und garantiert Dark-Mode-Konsistenz.

## Responsive Design & PWA-Ziel

**Die App muss durchgehend sowohl auf Desktop als auch auf Mobile gut aussehen und benutzbar sein** — nicht nur „funktioniert technisch", sondern layout- und bedienungsmäßig auf beiden Formfaktoren geprüft. Grund: geplant ist, die App später zusätzlich als installierbare Web-App (PWA) auf Mobilgeräten anzubieten — ein primär für Desktop gedachtes Layout wäre dafür ungeeignet.

- Bei jeder neuen/geänderten Komponente/Seite: Tailwind-Breakpoints (`sm:`/`md:`/`lg:`) bewusst einsetzen, nicht nur die Desktop-Ansicht im Kopf haben. Insbesondere Modals/Slide-Over-Panels (s. `AdminDashboard.tsx`), Tabellen (auf Mobile ggf. horizontal scrollbar oder alternative Kartenansicht) und die Landing-Page-Suche (`HeroSearch`/`FilterBar`/`LocationSearch`) im Blick behalten.
- Wo möglich per Browser-Test (Playwright) sowohl in einer Desktop- als auch einer Mobile-Viewport-Größe verifizieren, bevor ein UI-Task als abgeschlossen gilt (s. Hinweis unter „UI/Frontend-Änderungen" in den allgemeinen Arbeitsanweisungen).
- **PWA-Grundausstattung umgesetzt** (`app/manifest.ts`, `app/icon.tsx`/`app/apple-icon.tsx`, `app/icons/*/route.tsx`, `appleWebApp`-Metadata in `app/layout.tsx`, `<InstallPwaInstructions>` auf der Landing-Page) — noch **kein** Service Worker/Offline-Cache, die App funktioniert installiert also weiterhin nur online. Icons werden zur Laufzeit via `next/og` `ImageResponse` aus `lib/pwa-icon.tsx` generiert, kein statisches Bild-Asset nötig.

## Wichtige Muster

- **Server-first**: Datenabruf in Server Components, Mutationen als Server Actions
- **Kein API-Layer**: Keine Route Handlers für CRUD — direkt Server Actions. Ausnahme: `app/api/auth/email/route.ts`, weil Supabase dies als HTTP-Webhook aufruft (Server Actions sind dafür nicht ansprechbar)
- **revalidatePath nach Mutation**: Immer aufrufen um Next.js Cache zu leeren
- **Typen aus `types/database.ts`**: Nie inline tippen — immer die exportierten Convenience-Typen verwenden (`Restaurant`, `Comment`, `Profile`, `DataSource`, `RestaurantReview`, `RestaurantReviewCategory`, `ReviewWithCategories`, `RestaurantWithComments`, `CommentWithProfile`)
- **Google-Daten nie cachen**: Places-API-Antworten mit `cache: "no-store"` — Öffnungszeiten und Foto-URIs verfallen täglich
- **Google-APIs immer mit `languageCode=de&regionCode=DE`**: Sowohl serverseitig (REST-Aufrufe in `app/actions/places.ts`, `getPlaceDetails()` **und** `resolvePlaceForImport()`) als auch clientseitig (jedes `<APIProvider>` — `LocationSearch.tsx`, `MapView.tsx`, `AdminDashboard.tsx` — trägt `language="de" region="DE"`, wirkt für die ganze darunter geladene Maps-JS-API-Session inkl. Autocomplete/Geocoder/`Place.fetchFields`). Ohne das liefert Google Adressen/Öffnungszeiten/Cuisine-Typnamen (`primaryTypeDisplayName`, Basis für den Cuisine-Vorschlag) auf Englisch statt Deutsch. **Ausnahme:** die eigenen Spoon-Rating-Labels (`SPOON_RATINGS[...].label`/`labelShort`, `lib/ratings.ts`) bleiben bewusst Englisch — kein Google-Text, sondern App-eigene Bewertungsstufen-Namen
- **App-UI durchgehend Deutsch**: Alle Nutzertexte (Buttons, Labels, Platzhalter, Toasts, aria-labels) sind Deutsch — einzige bewusste Ausnahme sind die Spoon-Rating-Labels aus `lib/ratings.ts` (s.o.). Neue UI-Strings immer auf Deutsch anlegen, nicht aus Gewohnheit auf Englisch zurückfallen
- **Spoon-Ratings aus `lib/ratings.ts`**: Emoji/Label nie inline duplizieren — von dort importieren
- **Farben nie hartkodieren**: Immer CSS-Custom-Properties aus `app/globals.css` verwenden (s. „Dark Mode" oben) — sonst bricht Dark Mode an dieser Stelle
- **Keine Emojis außer Spoon-Rating**: Dekorative Emojis (Status-Icons, Buttons) sind aus der App entfernt — stattdessen `components/icons.tsx` verwenden. Einzige bewusste Ausnahme sind die Spoon-Rating-Glyphen aus `lib/ratings.ts` (`SPOON_RATINGS[...].emoji`). Reine Text-Glyphen wie `★` (Sterne-Bewertung) oder `✕` (Schließen-Symbol) zählen nicht als Emoji und bleiben erlaubt. Die Leer-/Fehlerzustände (`app/error.tsx`, „Keine Restaurants gefunden" in `app/page.tsx` und `SearchResultsView.tsx`) verwenden bewusst wieder 🫗 (dasselbe Glas wie `SPOON_RATINGS[0]`, „Not Recommended") statt `IconEmptyState` — fällt unter dieselbe Spoon-Rating-Ausnahme, `IconEmptyState` bleibt für andere (nicht-Fehler-/Leer-)Fälle nutzbar.
- **Responsive Pflicht**: Jede neue/geänderte UI muss sowohl auf Desktop als auch auf Mobile gut aussehen (s. „Responsive Design & PWA-Ziel" unten) — kein Feature gilt als fertig, wenn es nur auf einer Breakpoint-Größe getestet wurde
- **Kein horizontales Scrollen des Dokuments**: `app/globals.css` setzt `overflow-x: hidden` + `max-width: 100vw` auf `html, body` als Sicherheitsnetz — kein Teil der App darf horizontales Scrollen der Seite selbst auslösen oder erfordern. Absichtlich horizontal scrollbare Inhalte (z.B. die „Auswahl"-/„Neu hinzugefügt"-Reihen auf der Landing-Page, `overflowX: "auto"`) müssen dafür in ihrem **eigenen** Container scrollen, nie im `body`

## Entwicklung

```bash
npm run dev    # Startet auf http://localhost:3000
npm run build  # Produktions-Build
npm run lint   # ESLint
```

> Hinweis: `AGENTS.md` enthält wichtigen Hinweis zu Next.js 16 Breaking Changes — vor dem Schreiben von Next.js-Code lesen.

## Roadmap (Stand 2026-07-16)

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
8. **PWA-Deployment (installierbare Web-App für Mobile)** — ✅ Grundausstattung umgesetzt (2026-07-16), noch nicht per Browser-Test verifiziert
   `app/manifest.ts`, `app/icon.tsx`/`app/apple-icon.tsx`, `app/icons/192|512/route.tsx` (alle via `next/og` `ImageResponse`, s. `lib/pwa-icon.tsx`), `appleWebApp`-Metadata in `app/layout.tsx`, `<InstallPwaInstructions>` (iOS/Android-Anleitung) unten auf der Landing-Page. `utils/supabase/proxy.ts`s `PUBLIC_PATHS` musste um die neuen Manifest-/Icon-Routen erweitert werden, sonst hätte der Auth-Gate sie (inkl. Favicon auf `/login`) zu `/login` redirected. **Noch offen:** Service Worker/Offline-Support — bisher funktioniert die installierte App nur online.
9. **Diverse UX-Verbesserungen** (2026-07-16) — ✅ umgesetzt, noch nicht per Browser-Test verifiziert
   - **Adresse persistiert** + **manuelle Restaurant-Erfassung**: `restaurants.address` (Migration `20260716000001_restaurant_address.sql`, **noch nicht gepusht** — `supabase db push` steht aus), Fallback-Texteingabe im Admin-Edit-Panel für Orte, die Google Maps nicht kennt (s. „Manuelle Restaurant-Erfassung" oben).
   - **Karten-Dark-Mode**: zweite Map-ID (`NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID_DARK`) + `public/map-style-dark.json`, s. „Karten-Dark-Mode" oben. Erfordert einen einmaligen manuellen Schritt in der Google Cloud Console, um sichtbar zu werden.
   - **Zurück-Button**: `components/BackButton.tsx` (`router.back()` mit Fallback-Link), auf der Restaurant-Detailseite und im Admin-Dashboard.
   - **Keine Emojis außer Spoon-Rating**: neues `components/icons.tsx`, alle dekorativen Emojis app-weit ersetzt (s. „Wichtige Muster" oben).
   - **Neue Spoon-Rating-Farbcodierung**: Gold (bester) → Flieder → Altrosa/Mauve → Grau (`--c-lilac`/`--c-mauve`-Tokens in `app/globals.css`, s. `lib/ratings.ts`).
   - **Admin-Tabelle**: Name verlinkt direkt zur öffentlichen Seite, Edit/Delete-Buttons permanent sichtbar (vorher nur bei Hover — auf Mobile nie erreichbar), Nutzerverwaltung standardmäßig eingeklappt.
   - **Suchergebnisliste**: „Bewertung"-Filterzeile war durch `marginLeft: auto` uneinheitlich eingerückt — jetzt wie Küche/Preis eine eigene, linksbündige Zeile. Trefferzeilen sind jetzt aufklappbar (Live-Öffnungszeiten + „Zur Restaurant-Seite"/`NavigateButton`) statt direkt zu navigieren.
10. **Weitere UX-Runde** (2026-07-16) — ✅ umgesetzt, noch nicht per Browser-Test verifiziert
    - **Kategorie-Karten einspaltig**: sowohl auf der Restaurant-Detailseite als auch im Admin-Edit-Panel stehen die 4 Kategorie-Karten jetzt untereinander statt im 2×2-/auto-fit-Grid — die App ist für längere Fließtexte je Kategorie gedacht, dafür war das Grid zu eng.
    - **Fotovorschau auf 3 Bilder begrenzt**: sowohl `getPlaceDetails()` (`app/actions/places.ts`, holt jetzt nur noch bis zu 3 statt 5 Foto-URIs von Google) als auch das Admin-Edit-Panel (`placePhotos.slice(0, 3)`) — deckungsgleich mit der Detailseite, die ohnehin nie mehr als 3 zeigte.
    - **🫗 als Fehler-/Leerzustand-Emoji wieder eingeführt**: `app/error.tsx`, „Keine Restaurants gefunden" in `app/page.tsx` und `SearchResultsView.tsx` zeigen wieder das Spoon-Rating-Glas (`SPOON_RATINGS[0].emoji`) statt `IconEmptyState` — war bei der „Keine Emojis"-Bereinigung versehentlich mitentfernt worden, obwohl Spoon-Rating-Glyphen explizit die erlaubte Ausnahme sind.
    - **Telefonnummer + Website**: neue Spalten `restaurants.phone`/`restaurants.website` (Migration `20260716000002_restaurant_contact_info.sql`, **noch nicht gepusht** — `supabase db push` steht aus), analog zu `address` standardmäßig live von Google Places bezogen (`getPlaceDetails()` liefert jetzt zusätzlich `phone`/`website`) mit persistiertem Fallback. Restaurant-Detailseite zeigt „Anrufen"/„Website"-Buttons neben `<NavigateButton>`.
    - **Manuelle Öffnungszeiten**: neue Spalte `restaurants.opening_hours` (rein manueller Freitext, dieselbe Migration) als Fallback, wenn Google keine Live-Öffnungszeiten liefert.
    - **„Kontakt & Öffnungszeiten"-Abschnitt im Admin-Edit-Panel**: Toggle-Chips für Telefon/Website/Öffnungszeiten (State `visibleContactFields`) — blendet die jeweiligen Felder nur ein, wenn relevant; automatisch aktiviert, sobald Google beim Places-Lookup einen Wert liefert. Funktioniert identisch im Google-Such- und im manuellen Erfassungs-Modus, macht damit „Ort manuell erfassen" gezielt erweiterbar um genau die Zusatzfelder, die ein Eintrag tatsächlich hat.
    - **Cuisine-Eingabe als echte Combobox**: neue `CuisineCombobox`-Komponente ersetzt das native `<input list>` (dessen Browser-eigener Dropdown-Pfeil/Filterverhalten uneinheitlich war). Vorschläge kommen jetzt aus `getCuisines()` (tatsächlich bereits verwendete Küchen, als `cuisineSuggestions`-Prop von `app/admin/dashboard/page.tsx` durchgereicht) statt einer hartkodierten Liste, gefiltert per Substring-Match beim Tippen.
    - **Mehrfachauswahl + Bulk-Löschen im Admin-Dashboard**: Checkbox-Spalte in der Restaurant-Tabelle + Auswahl-Leiste, neue Server Action `deleteRestaurants(ids)` (`app/actions/restaurants.ts`); `DeleteModal` ist jetzt auf `restaurants: Restaurant[]` verallgemeinert (1 vs. mehrere).
    - **Dark-Mode-Kartenstil geprüft**: Code/Env-Var-Setup (`MapView.tsx`, `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID_DARK`) ist korrekt und folgt dem dokumentierten Zwei-Map-ID-Muster — das Problem lag nicht im Code. Ursache ist ein noch fehlender manueller Schritt in der Google Cloud Console (neuer Stil nur mit der hellen Map-ID verknüpft, nicht mit der dunklen), s. „Karten-Dark-Mode" oben.

    Migration: `20260716000002_restaurant_contact_info.sql` (lokal erstellt, **noch nicht gepusht**, zusammen mit den bereits offenen Migrationen aus Schritt 5/6/9 per `supabase db push`).
11. **Account-Verwaltung + weitere UX-Fixes** (2026-07-16) — ✅ umgesetzt, noch nicht per Browser-Test verifiziert
    - **Passwort vergessen/ändern über Supabase Auth** (s. „Auth & Berechtigungen" oben): neue Route `app/auth/reset-password/` + Server Actions `requestPasswordReset`/`updatePassword` (`app/actions/auth.ts`). Login-Seite hat einen „Passwort vergessen?"-Link; eingeloggte Nutzer finden „Passwort ändern" im neuen `<UserMenu>`-Kebab-Menü im Header. Beide lösen denselben E-Mail-Link-Flow aus (kein inline Alt-/Neu-Passwort-Formular).
    - **Header-Kebab-Menü** (`components/UserMenu.tsx`): „Passwort ändern" + „Abmelden" stehen nicht mehr als eigene Buttons im Header, sondern hinter einem Drei-Punkte-Icon (`IconDotsVertical`), das bei Klick außerhalb automatisch schließt — hält den Header auf schmalen Viewports schlank.
    - **„Auswahl"-Sektion auf der Landing-Page**: neue Spalte `restaurants.featured` (Migration `20260716000003_restaurant_featured.sql`, **noch nicht gepusht**), `getFeaturedRestaurants()`/`setFeatured()` (`app/actions/restaurants.ts`), Stern-Toggle (`IconStar`) in der Admin-Tabelle. `app/page.tsx` zeigt die Reihe oberhalb von „Neu hinzugefügt", nur wenn Einträge markiert sind.
    - **CSV-Import: Spoon-Rating für alle neuen Zeilen wählbar**: `confirmCsvImport(selection, bulkSpoonRating?)` — Chip-Picker im `ImportModal`-Preview-Schritt, praktisch bei CSV-Listen, die bereits einer einzigen Bewertungsstufe entsprechen. Dabei auch einen Bug gefunden und gefixt: der zurückgegebene Datensatz trug noch das Default-Rating (vor dem `sync_restaurant_spoon_rating`-Trigger), wodurch die Tabelle direkt nach dem Import kurz das falsche Emoji zeigte, bis ein Reload die korrekten Daten nachlud — jetzt wird der Rückgabewert in-memory korrigiert (dieselbe Technik wie in `createRestaurant`).
    - **Suchergebnis-Akkordeon**: in `SearchResultsView.tsx` ist immer nur eine Trefferzeile gleichzeitig aufgeklappt — der Expand-State wurde von `ResultCard` (lokal) in die Elternkomponente (`expandedId`) verschoben.
    - **Preis-Level auf der Restaurant-Detailseite**: stand vorher klein in der Meta-Zeile neben Adresse/Öffnungszeiten und ging dort unter; steht jetzt groß/fett direkt gegenüber dem Cuisine-Label in derselben Zeile.
    - **Kein horizontales Scrollen**: `overflow-x: hidden` + `max-width: 100vw` auf `html, body` (`app/globals.css`) als generelles Sicherheitsnetz, plus `overflow-wrap: break-word` und `img, video { max-width: 100% }`.

    Migration: `20260716000003_restaurant_featured.sql` (lokal erstellt, **noch nicht gepusht**, zusammen mit den bereits offenen Migrationen aus Schritt 5/6/9/10 per `supabase db push`).
12. **Ladeindikatoren, CSV-Import-Autofill, Site-Audit (Fehler/Performance/Security)** (2026-07-16) — ✅ umgesetzt, noch nicht per Browser-Test verifiziert. Keine Schema-Änderung, keine neue Migration.
    - **Ladeindikatoren für Aktionen mit spürbarer Wartezeit**: neue `.gp-spinner-sm`-CSS-Klasse (`app/globals.css`) für kleine Inline-Spinner in Buttons/Feldern (Ergänzung zum großen `.gp-spinner` aus `loading.tsx`). `LocationSearch.tsx` zeigt jetzt einen `resolving`-State während der Google-Places/Geocoder-Auflösung vor dem `router.push` (s. Eintrag oben). `DeleteCommentButton.tsx` (neu) gibt dem Kommentar-Löschen-Button per `useFormStatus()` ein „Löscht…"-Feedback. Registrierungs-Freischalten/Ablehnen-Buttons zeigen „…" während `busyId` aktiv ist. Die meisten anderen Aktionen hatten bereits einen Pending-State (`useTransition`/`useActionState`) oder werden implizit von Next.js' routenweitem `loading.tsx` abgedeckt — geprüft, aber nicht verändert.
    - **CSV-Import befüllt jetzt auch Adresse + Cuisine automatisch**: `resolvePlaceForImport()` (`app/actions/places.ts`) fragt zusätzlich `formattedAddress`/`primaryTypeDisplayName`/`primaryType`/`types` ab und liefert `address`/`cuisine` zurück (per neuem, aus `PlacesAutocomplete.tsx` extrahiertem `guessCuisine()` in `lib/cuisine.ts`); `confirmCsvImport()` persistiert beide Felder jetzt mit. Vorher bekamen importierte Entwürfe nur `google_place_id`/`lat`/`lng` automatisch, Adresse/Cuisine mussten immer manuell im Edit-Panel nachgetragen werden.
    - **Live-Öffnungszeiten-Hinweis im Admin-Edit-Panel**: neuer `hasLiveOpeningHours`-State (aus demselben `getPlaceDetails()`-Aufruf wie die Fotovorschau) zeigt über den „Kontakt & Öffnungszeiten"-Toggle-Chips einen grünen Haken, wenn Google für den gewählten Ort bereits Live-Öffnungszeiten liefert — vorher gab es dafür überhaupt keine Rückmeldung im Formular, obwohl `getPlaceDetails()` diese Information längst mitlieferte.
    - **Bugfix — Entwürfe waren für Admins außerhalb des Admin-Dashboards sichtbar**: `getRestaurants()`/`getRecentRestaurants()`/`getFeaturedRestaurants()`/`getCuisines()` (`app/actions/restaurants.ts`) verließen sich für „keine Entwürfe in Suche/„Neu hinzugefügt"/„Auswahl"" bisher rein auf RLS — die aber `is_admin()` vollen SELECT-Zugriff gibt. Ein Admin, der ganz normal (nicht im `/admin/dashboard`) die Startseite oder Suche besuchte, sah dadurch Entwürfe zwischen den echten Einträgen. Jetzt filtern alle vier explizit `.eq("status", "published")`; `getRestaurantById()` bleibt bewusst ungefiltert (Admins müssen Entwürfe über den Tabellen-Link weiterhin direkt aufrufen können).
    - **Bugfix — Karte reagierte nicht auf eine neue Suche aus der Ergebnisliste heraus**: `MapView.tsx`s `<Map>` nutzt unkontrolliertes `defaultCenter` (Absicht, s. Eintrag zu `MapView.tsx` oben) — dessen `key` bezog bisher nur die Map-ID (Light/Dark) ein, nicht die Center-Koordinaten. Eine neue Suche über die Suchleiste innerhalb von `SearchResultsView` aktualisierte dadurch die Trefferliste, ließ die Karte aber auf dem alten Ort stehen. `key` kombiniert jetzt Map-ID **und** Center-Koordinaten.
    - **Security-Audit**: alle Server Actions (`app/actions/*.ts`), `proxy.ts`/`auth-helpers.ts` und der Send-Email-Webhook auf fehlende Auth-/Ownership-Checks geprüft — keine weiteren Lücken über die beiden Bugfixes oben hinaus gefunden (RLS + `requireAuth`/`requireApproved`/`requireAdmin`-Muster durchgängig korrekt angewendet). Zwei konkrete Funde behoben: (1) der „Maps ↗"-Link im CSV-Import-Preview rendert `mapsUrl` jetzt nur noch bei `http`/`https`-Schema (`sanitizeMapsUrl()` in `csvImport.ts`) — vorher hätte eine präparierte CSV-Datei eine `javascript:`-URI in einen echten Link im Admin-Dashboard schmuggeln können; (2) `next.config.ts` setzt jetzt Baseline-HTTP-Security-Header (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` — s. „HTTP-Security-Header" oben), vorher gab es keine.
    - **Performance**: `attachEmails()` (`app/actions/profiles.ts`) nutzte einen `getUserById()`-Call pro Profil (N Supabase-Admin-API-Requests bei N Accounts auf jedem Dashboard-Load) — jetzt ein einzelner `listUsers({ perPage: 1000 })`-Call mit lokalem Lookup. `next/image` bewusst weiterhin nicht eingesetzt (s. `eslint-disable @next/next/no-img-element`-Kommentare an den drei `<img>`-Stellen) — Googles Foto-URIs sind signiert/kurzlebig (`cache: "no-store"`) und würden den Optimierungs-Cache ohnehin ständig umgehen.
13. **Google-APIs auf Deutsch + verbleibende englische UI-Texte übersetzt** (2026-07-16) — ✅ umgesetzt, noch nicht per Browser-Test verifiziert. Keine Schema-Änderung, keine neue Migration.
    - **Google Places/Maps durchgehend mit `languageCode=de&regionCode=DE`**: server-seitig in `getPlaceDetails()` war das schon gesetzt (deutsche Öffnungszeiten-Strings), `resolvePlaceForImport()` (CSV-Import) hatte es aber gefehlt — dadurch kam der Cuisine-Vorschlag (`primaryTypeDisplayName`) beim CSV-Import auf Englisch zurück. Jetzt bei beiden REST-Lookups (direkte ID-Auflösung als Query-Param, Textsuche `places:searchText` als POST-Body-Feld) gesetzt. Client-seitig bekommt jedes `<APIProvider>` (`LocationSearch.tsx`, `MapView.tsx`, `AdminDashboard.tsx`) jetzt `language="de" region="DE"` — betrifft die komplette darüber geladene Maps-JS-API-Session (Autocomplete-Vorschläge, Geocoder, `Place.fetchFields()` im Admin-Edit-Panel). S. „Wichtige Muster" oben.
    - **Verbleibende englische UI-Texte gefunden und übersetzt**: v.a. im Admin-Dashboard (`AdminDashboard.tsx`) — Slide-Over-Titel/Buttons („Add Restaurant"/„Edit Restaurant"/„Save Changes"/„Saving…" → „Restaurant hinzufügen"/„Restaurant bearbeiten"/„Änderungen speichern"/„Speichert…"), Lösch-Dialog („Delete restaurant?"/„Keep it"/„Yes, delete"/„Deleting…" → „Restaurant löschen?"/„Behalten"/„Ja, löschen"/„Löscht…"), Tabellen-Header („Cuisine"/„Price"/„Rating"/„Place ID" → „Küche"/„Preis"/„Bewertung"/„Platz-ID"), Toasts („Restaurant added"/„Changes saved"/„Restaurant deleted"), Buttons/Placeholder („Edit"/„Delete"/„Add new"/„Cancel"/„Search…"/„Search establishment…"/„Find on Google Maps"/„No place ID"/„Latitude"/„Longitude"), Leerzustände („No restaurants match your search."/„No restaurants yet. Add one!"). Außerdem `MapView.tsx`s InfoWindow-Link („View details →" → „Details ansehen →") und die „Reader Experiences"-Überschrift auf der Restaurant-Detailseite (→ „Leser-Erfahrungen"). **Bewusst NICHT übersetzt**: die Spoon-Rating-Labels (`SPOON_RATINGS[...].label`/`labelShort` in `lib/ratings.ts`, „Absolute Recommendation"/„Worth Mentioning"/„Remembering"/„Not Recommended") — auf ausdrücklichen Wunsch weiterhin Englisch, sichtbar u.a. im Verdict-Badge auf der Restaurant-Detailseite, `RestaurantCard`, `SearchResultsView` und den Filter-Chip-Tooltips.
