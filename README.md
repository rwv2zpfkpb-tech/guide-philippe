# Guide Philippe

Restaurant-Guide-App. Admins pflegen Restaurants, eingeloggte Nutzer hinterlassen Kommentare, Besucher sehen die Liste.

Für Architektur, Datenbankschema, Auth-Modell und Server Actions siehe [CLAUDE.md](./CLAUDE.md) — das ist die primäre Projektdokumentation.

## Setup

1. Abhängigkeiten installieren:
   ```bash
   npm install
   ```
2. `.env.local` anlegen (siehe Variablenliste in [CLAUDE.md](./CLAUDE.md#umgebungsvariablen)).
3. Datenbank-Migrationen anwenden (falls noch nicht geschehen):
   ```bash
   npx supabase db push
   ```

## Entwicklung

```bash
npm run dev    # http://localhost:3000
npm run build  # Produktions-Build
npm run lint   # ESLint
```
