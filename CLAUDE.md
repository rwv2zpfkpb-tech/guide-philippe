> **Pflicht:** Diese Datei bei jeder strukturellen Änderung (neue Routen, neue Tabellen, neue Actions, neue Komponenten, geänderte Auth-Logik) sofort aktualisieren. Sie ist der primäre Kontext für KI-Assistenten — veraltete Inhalte führen zu falschen Empfehlungen.

# Guide Philippe — Projektübersicht

Restaurant-Guide-App. Admins pflegen Restaurants, eingeloggte Nutzer hinterlassen Kommentare, Besucher sehen die Liste.

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
  layout.tsx              – Root-Layout (Cormorant Garamond + DM Sans Fonts, Theme-Cookie, Body-Wrapper)
  page.tsx                – Startseite (Server Component, lädt Restaurants)
  loading.tsx             – Suspense-Fallback für die Startseite
  error.tsx               – Error Boundary für die Startseite (fängt z.B. transiente Supabase-Fetch-Fehler ab), zeigt Retry-Button
  globals.css
  login/
    page.tsx              – Server Component: redirect wenn eingeloggt
    LoginForm.tsx          – Client Component: Login/Signup-Tabs
  auth/confirm/
    page.tsx              – Server Component: Ziel des Signup-Bestätigungslinks. Tauscht PKCE-`code` gegen Session (`exchangeCodeForSession`), zeigt Erfolgs-/Fehler-Screen
  restaurant/[id]/
    page.tsx              – Detailseite (Places-Details, Kommentare)
    loading.tsx
    CommentForm.tsx        – Client Component: Kommentar abgeben
  actions/                – Alle Server Actions ("use server")
    auth.ts               – signIn / signUp / signOut
    restaurants.ts        – CRUD Restaurants (Admin-Schutz)
    comments.ts           – CRUD Kommentare (Auth + RLS-Schutz)
    places.ts             – Google Places Details (Server-only API-Key)
    storage.ts            – Supabase Storage (Bilder-Upload, Admin)
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
  FilterBar.tsx            – Client Component: Küche/Preis/Bewertung-Filterchips
  LocationSearch.tsx       – Client Component: Orts-/Restaurantsuche (Google Places)
  SearchResultsView.tsx    – Client Component: Liste + Karte für Ortssuche
  RestaurantCard.tsx       – Karte in der Restaurant-Grid-Ansicht
  PriceLevelDots.tsx       – Gemeinsame €-Preisanzeige (1–4 Symbole)
  admin/
    PlacesAutocomplete.tsx – Google Places Autocomplete (Client)
  map/
    MapView.tsx            – Kartenansicht (Client)

lib/
  ratings.ts               – Single Source of Truth für Spoon-Rating-Emoji/Labels
  resend.ts                – getResendClient() Factory + RESEND_FROM_EMAIL (Server-only)
  auth-emails.ts           – Deutsche HTML-Templates für Supabase-Auth-Mails (signup, recovery, ...)

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
- `price_level` 1–4 | null (€ bis €€€€)
- `spoon_rating` 0–3 (Kern-Bewertungssystem, s.u.)
- `official_review` text | null — Redaktioneller Text

**`profiles`** — Erstellt automatisch via Supabase Auth Trigger
- `id` uuid (= auth.users.id)
- `username` text | null
- `role` `'user'` | `'admin'`

**`comments`** — Nutzerkommentare zu Restaurants
- `restaurant_id` uuid FK → restaurants
- `user_id` uuid FK → profiles
- `content` text
- `secondary_rating` int 1–5 | null

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

### Supabase-Funktion
`is_admin()` — RLS-Hilfsfunktion, prüft ob aktueller User `role = 'admin'` hat.

## Auth & Berechtigungen

### Drei Zugriffsebenen

| Ebene | Supabase-Zustand | Zugang |
|---|---|---|
| Besucher | nicht eingeloggt | Restaurant-Liste lesen |
| User | eingeloggt | Kommentare erstellen/bearbeiten/löschen |
| Admin | eingeloggt + `role = 'admin'` | Restaurants CRUD, Bilder-Upload |

### Wie Auth-Prüfung funktioniert

In Server Actions immer `requireAuth()` oder `requireAdmin()` aus `utils/supabase/auth-helpers.ts` verwenden — diese werfen bei Verstoß einen Error.

```ts
// Für eingeloggte Nutzer
const { user } = await requireAuth();

// Für Admins
await requireAdmin(); // wirft 'Forbidden' wenn kein Admin
```

Die RLS-Policies in Supabase sind **zusätzliche Absicherung** — nicht der einzige Schutz.

### Session-Refresh (Proxy)

`proxy.ts` (Next.js-16-Nachfolger von `middleware.ts`) ruft `updateSession()` auf jeder Route auf — hält Supabase-JWT frisch. Läuft **nicht** auf `_next/static`, `_next/image` und Bilddateien. Proxy läuft standardmäßig im Node.js-Runtime (nicht mehr Edge).

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
- `getRestaurants(filters?)` — Liste, optional gefiltert nach `cuisine`, `price_level`, `spoon_rating`
- `getRestaurantById(id)` — Einzelnes Restaurant inkl. verschachtelter Comments + Profiles
- `createRestaurant(payload)` — Admin-only, `revalidatePath("/", "layout")`
- `updateRestaurant(id, payload)` — Admin-only, revalidiert Startseite + Detailseite
- `deleteRestaurant(id)` — Admin-only

Adresse und Bilder werden **nicht** in der DB gespeichert — kommen live von der Google Places API.

### `comments.ts`
- `addComment(restaurantId, content, secondaryRating)` — Auth required
- `updateComment(commentId, restaurantId, content, secondaryRating)` — Auth required; RLS blockiert Fremdzugriff
- `deleteComment(commentId, restaurantId)` — Auth required; RLS erlaubt nur Owner oder Admin
- `adminDeleteComment(commentId, restaurantId)` — Admin-only

### `places.ts`
- `getPlaceDetails(placeId)` — Ruft Google Places API (New) auf: `formattedAddress`, `regularOpeningHours`, bis zu 5 `photoUris`
- Immer `cache: "no-store"` — Öffnungszeiten und Foto-URLs ändern sich täglich
- API-Key in `GOOGLE_PLACES_API_KEY` (Server-only, nie `NEXT_PUBLIC_`)

### `storage.ts`
- `uploadRestaurantImage(formData)` — Admin-only, Bucket `restaurant-images`, gibt public CDN-URL zurück
- `deleteRestaurantImage(publicUrl)` — Admin-only, extrahiert Dateinamen aus URL

## Supabase-Clients

| Client | Wo verwendet | Key |
|---|---|---|
| `utils/supabase/server.ts` → `createClient()` | Server Components, Server Actions, Route Handlers | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| `utils/supabase/client.ts` → `createClient()` | Client Components | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| `utils/supabase/admin.ts` → `createAdminClient()` | Nur Server, für Storage-Admin-Ops | `SUPABASE_SERVICE_ROLE_KEY` (geheim!) |

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

- **Server Component** (`page.tsx`): Auth-Guard (redirect zu `/login` wenn nicht eingeloggt, redirect zu `/` wenn kein Admin), lädt initiale Restaurant-Liste, rendert `<AdminDashboard>`
- **Client Component** (`AdminDashboard.tsx`): Tabelle mit Suche, Slide-Over-Panel zum Erstellen/Bearbeiten, Delete-Modal, Toast-Benachrichtigungen
- Benutzt `useTransition` für optimistische Updates
- Google Places Autocomplete im Edit-Panel — befüllt Name, `google_place_id`, lat/lng automatisch

## Komponenten

### `components/admin/PlacesAutocomplete.tsx`
Client Component. Gibt bei Auswahl ein `PlaceSelection`-Objekt zurück:
```ts
{ name: string; placeId: string; lat: number; lng: number }
```

### `components/map/MapView.tsx`
Client Component. Erwartet Restaurants mit lat/lng für Kartenanzeige.

### `components/PriceLevelDots.tsx`
Reine Darstellungskomponente: rendert 1–4 „€"-Zeichen, abgedunkelt oberhalb von `level`. Einzige Stelle mit dieser Logik — nicht erneut inline implementieren.

## `lib/ratings.ts`
Single Source of Truth für Spoon-Rating-Emoji/Labels (`SPOON_RATINGS`, `SPOON_RATING_ORDER`). Wird von `RestaurantCard`, der Detailseite, `SearchResultsView`, `MapView`, `FilterBar` und `AdminDashboard` importiert — bei neuen Stellen, die Spoon-Ratings anzeigen, immer von hier importieren statt neu zu deklarieren.

## Wichtige Muster

- **Server-first**: Datenabruf in Server Components, Mutationen als Server Actions
- **Kein API-Layer**: Keine Route Handlers für CRUD — direkt Server Actions. Ausnahme: `app/api/auth/email/route.ts`, weil Supabase dies als HTTP-Webhook aufruft (Server Actions sind dafür nicht ansprechbar)
- **revalidatePath nach Mutation**: Immer aufrufen um Next.js Cache zu leeren
- **Typen aus `types/database.ts`**: Nie inline tippen — immer die exportierten Convenience-Typen verwenden (`Restaurant`, `Comment`, `Profile`, `DataSource`, `RestaurantWithComments`, `CommentWithProfile`)
- **Google-Daten nie cachen**: Places-API-Antworten mit `cache: "no-store"` — Öffnungszeiten und Foto-URIs verfallen täglich
- **Spoon-Ratings aus `lib/ratings.ts`**: Emoji/Label nie inline duplizieren — von dort importieren

## Entwicklung

```bash
npm run dev    # Startet auf http://localhost:3000
npm run build  # Produktions-Build
npm run lint   # ESLint
```

> Hinweis: `AGENTS.md` enthält wichtigen Hinweis zu Next.js 16 Breaking Changes — vor dem Schreiben von Next.js-Code lesen.
