# Guide Karn Design System

_Started 2026-06-03 14:02 UTC_

---

## User

Prompt:
Create a minimalist and highly aesthetic design system for a premium restaurant guide website called "Guide Karn".
•	Style: Extremely clean, modern, and elegant (inspired by the Michelin Guide, but more contemporary). Lots of whitespace.
•	Typography: The branding text "Guide Karn" must be in a bold, striking, and premium serif or elegant sans-serif font. Body text should be highly readable.
•	Colors: A sophisticated, muted color palette (e.g., deep charcoal, warm off-white, and a subtle accent color like muted gold or dark burgundy for highlights).
•	UI Elements: Rounded corners (sm/md), subtle shadows, and clean iconography for price ranges (€ to €€€€) and a custom rating system based on emojis (🍽️absolute recommendation🍴worth mentioning🥄remembering🫗not recommended). 
Provide a color palette, typography scale, and basic button/card styles.

## Assistant

_[tool: update_todos]_

_[tool: write_file]_

Building the **Guide Karn** design system now — no questions needed, the brief is crystal clear. Let me craft this.

_[tool: done]_

_[tool: fork_verifier_agent]_

The **Guide Karn Design System** is live — here's what's inside:

---

**Color System**
- `Charcoal` · `Ivory` · `Warm Gold` · `Gold Mid/Tint` · `Burgundy` · `Burg. Tint`
- 8-step warm-tinted neutral scale (N50 → N700)
- All colors defined as `oklch()` tokens for perceptual consistency

**Typography**
- **Cormorant Garamond** — display, brand mark, all headings
- **DM Sans** — body, labels, UI elements
- 12-step scale from 11px caption → 120px hero

**Spacing & Surfaces**
- Base-4 spacing scale · 6 radii tokens (sm → pill) · 5 shadow levels including a gold focus ring

**Components**
- 5 button variants × 3 sizes with hover lift states
- Badges/chips in 5 colorways + cuisine tag row
- **Restaurant cards** — grid & list layouts with embedded rating + price
- **Rating system** — 🍽️ 🍴 🥄 🫗 with pip indicators (card + inline row)
- **Price range** — €–€€€€ with gold treatment for fine dining
- Form inputs with search icon + gold focus ring
- Navigation bar sample

**Next steps you might want:**
- A live prototype page (homepage, search, restaurant detail)
- Dark mode token layer
- Mobile / responsive breakpoints
- Icon set for cuisine categories

## User

Based on the previous design system, design the Homepage for "Guide Karn" (Desktop and Mobile responsive).
•	Header: A minimalist navigation bar containing only the prominent text-logo "Guide Karn", a simple search icon, and a "Login" button.
•	Hero Section: A very clean intro stating the purpose of the guide, directly followed by a prominent, elegant search bar with quick-filter chips underneath (e.g., Cuisine Type, Price €-€€€€, Spoons 0-2).
•	Content Section: Below the hero, display horizontal scrolling rows or a clean grid for recommendations:
	1.	"Latest Entries" (Neueste Einträge)
	2.	"Top Rated"
•	Card Design: Each restaurant card should be minimalist, showing a beautiful preview image, Name, Cuisine, Price Range (€-€€€€), and the Spoon Rating.

## Assistant

_[tool: update_todos]_

_[tool: write_file]_

Building now — pulling every token straight from the design system.

_[tool: done]_

_[tool: fork_verifier_agent]_

The **Guide Karn Homepage** is live. Here's what was built:

---

**Header**
- Sticky, frosted-glass with scroll-triggered lift shadow
- Cormorant Garamond logotype · search icon (focuses hero input on click) · Login button with ink-fill hover

**Hero**
- Large "GK" watermark behind the headline (same treatment as the design system)
- Staggered fade-up entrance animation on all elements
- Pill-shaped search bar — gold focus ring, inline Search button
- Three filter groups with separators: **Cuisine** (radio), **Price** (toggle), **Spoons** (toggle) — all interactive

**Content**
- *Neueste Einträge* — horizontal scroll row with right-side fade gradient
- Gold ornament divider between sections
- *Top Rated* — same pattern, 8 cards per row
- Each card: striped image placeholder + city label, rating emoji badge, name in Cormorant Garamond, cuisine in gold uppercase, price €–€€€€, rating emoji in footer

**Responsive**
- Mobile ≤ 768px: tighter padding, smaller cards (196px), filter chips become horizontally scrollable, footer links hidden
- Mobile ≤ 480px: hero subline hidden, search button collapses to icon only

---

**Possible next steps:**
- Restaurant detail page
- Search results / filtered grid view
- Dark mode
- Animated page transitions between views

## User

Design the Search Results Page for "Guide Karn" with a split-screen layout for Desktop and a toggle-view for Mobile.
•	Left Side (Desktop) / Main View: A clean vertical list or grid of restaurant cards matching the search criteria. At the top of the list, include advanced sticky filters: Cuisine Type (dropdown), Price Level (€-€€€€), and Spoon Rating (0, 1, 2).
•	Right Side (Desktop) / Map Overlay: An integrated, minimalist map (Google Maps style but styled darkly or neutrally to match the brand). The map should display custom pins for the filtered restaurants. Clicking a pin highlights the restaurant card.
•	Interactivity: Ensure the design clearly shows how active filters look and how the map seamlessly blends into the minimalist layout.

## User

Design the Search Results Page for "Guide Karn" with a split-screen layout for Desktop and a toggle-view for Mobile.
•	Left Side (Desktop) / Main View: A clean vertical list or grid of restaurant cards matching the search criteria. At the top of the list, include advanced sticky filters: Cuisine Type (dropdown), Price Level (€-€€€€), and Rating .
•	Right Side (Desktop) / Map Overlay: An integrated, minimalist map (Google Maps style but styled darkly or neutrally to match the brand). The map should display custom pins for the filtered restaurants. Clicking a pin highlights the restaurant card.
•	Interactivity: Ensure the design clearly shows how active filters look and how the map seamlessly blends into the minimalist layout.

## Assistant

_[tool: update_todos]_

Building the split-screen search results page now — full interactivity, canvas map, sticky filters.

_[tool: write_file]_

_[tool: done]_

_[tool: get_webview_logs]_

_[tool: fork_verifier_agent]_

The **Guide Karn Search Results** page is live. Here's what's inside:

---

**Layout**
- Fixed split-screen — 420px left panel, map fills all remaining space
- Both panels are exactly viewport height, no page scroll — the list scrolls independently inside

**Left Panel**
- Header: result count + sort dropdown (Highest Rated / Price / Name)
- **Sticky filter bar** with three independent groups:
  - *Cuisine* — styled native dropdown with gold highlight when active
  - *Price* — €/€€/€€€/€€€€ toggle chips (multi-select)
  - *Rating* — 🍽️🍴🥄🫗 toggle chips (multi-select)
  - Active filter count badge + "Reset filters" link appear when any filter is on
- Scrollable results list with custom thin scrollbar
- Each card: index number · thumbnail · name (Cormorant) · cuisine · location · price · rating label
- **Selected state** — gold left border + warm gold-tint background

**Right Panel — Map**
- Hand-drawn Canvas map at full resolution (DPR-aware, ResizeObserver)
- Paris-inspired layout: Haussman-era grid, Seine river, Île de la Cité, Bois de Boulogne, Tuileries, Luxembourg gardens, district labels
- 12 gold teardrop pins, layered so selected always renders on top
- **Hover** — pin enlarges + tooltip floats above (name, cuisine, price)
- **Click pin** — selects restaurant, highlights card in left panel, scroll-to-card, shows "Click elsewhere to deselect" hint
- **Click card** — same effect in reverse, pin pulses with double gold ring
- Clicking empty map space deselects

**Mobile (≤ 680px)**
- Bottom toggle bar: **≡ List** / **◎ Map**
- List and map are full-width, toggled exclusively
- When a pin is tapped on mobile, a bottom sheet slides up with restaurant summary

---

**Possible next steps:**
- Restaurant detail page
- Saved/bookmarked restaurants view
- Real map tiles via Leaflet + OpenStreetMap (no API key needed)
- Animated pin entrance when filters change

## User

Verifier agent check completed

## Assistant

All three pages verified and clean. Here's where the **Guide Karn** project stands:

| Page | Status |
|---|---|
| 🎨 Design System | ✅ Verified |
| 🏠 Homepage | ✅ Verified |
| 🔍 Search Results | ✅ Verified |

Ready for the next screen whenever you are — natural next steps would be the **Restaurant Detail page**, a **Login / Account flow**, or a **Mobile prototype** wrapping all three screens together.

