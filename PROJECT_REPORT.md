# MediCheck — Full Project Report

> **"Your Village Doctor, In Your Pocket"**
> AI-Powered Rural Health Assistant for India

---

## 1. Project Overview

**MediCheck** is a comprehensive, AI-powered healthcare web application designed to serve **500M+ rural Indians** who lack access to qualified doctors. It provides symptom triage via text in regional languages, nearby hospital discovery with live interactive maps, a family health vault, and ASHA worker integration — all accessible through a browser with zero installation cost.

| Detail | Value |
|---|---|
| **Project Name** | MediCheck |
| **Type** | Full-Stack Web Application (SPA) |
| **Architecture** | Express.js Backend + Vanilla JS Frontend |
| **Database** | File-based JSON (zero external DB dependency) |
| **Deployment** | Node.js server, no build step required |
| **External APIs** | 4 free, open-source APIs (no API keys needed) |
| **Lines of Code** | ~3,800+ (frontend) + ~800+ (backend) |

---

## 2. Problem Statement

| Problem | Statistic |
|---|---|
| **No Doctor Access** | 65% of Indian villages have no doctor within 10 km |
| **Deadly Delay** | 4–6 hour average delay to reach medical help |
| **Wrong Tools** | Existing health apps are English-only, urban-focused |
| **Language Barrier** | Rural users need Hindi, Punjabi, and local language support |
| **Cost Barrier** | Paid health platforms exclude economically weaker sections |

**MediCheck addresses all five** with a free, multilingual, offline-capable health assistant.

---

## 3. Complete Tech Stack

### 3.1 Backend

| Technology | Version | Purpose |
|---|---|---|
| **Node.js** | v24.x | Runtime environment |
| **Express.js** | ^4.21.2 | Web framework & API server |
| **jsonwebtoken** | ^9.0.3 | JWT access & refresh token generation/verification |
| **bcryptjs** | ^2.4.3 | Password hashing (12 salt rounds) |
| **helmet** | ^8.0.0 | HTTP security headers (HSTS, X-Frame-Options, etc.) |
| **express-rate-limit** | ^7.5.0 | Brute-force protection on login & refresh |
| **cookie-parser** | ^1.4.7 | Secure httpOnly cookie parsing |
| **dotenv** | ^16.4.7 | Environment variable management |

### 3.2 Frontend (CDN-based, zero build step)

| Technology | Purpose |
|---|---|
| **Vanilla JavaScript** | All interactivity — no React/Vue/Angular |
| **Leaflet.js** 1.9.4 | Interactive OpenStreetMap rendering |
| **Cabinet Grotesk** (Google Fonts) | Heading typeface |
| **DM Sans** (Google Fonts) | Body typeface |
| **JetBrains Mono** (Google Fonts) | Stats/monospace typeface |

### 3.3 External APIs (All Free, No API Key Required)

| API | Endpoint | Used For |
|---|---|---|
| **Nominatim** (OpenStreetMap) | `nominatim.openstreetmap.org/search` | Geocoding (text → coordinates) + live autocomplete |
| **Overpass API** | `overpass-api.de/api/interpreter` | Hospital search by amenity/healthcare tags worldwide |
| **OSRM** | `router.project-osrm.org` | Driving route calculation with distance & duration |
| **OpenStreetMap Tiles** | `tile.openstreetmap.org` | Map tile rendering in Leaflet |

### 3.4 Database

- **File-based JSON** (`medicheck-db.json`) — read/write via Node.js `fs` module
- **Zero external dependency** — no MongoDB, PostgreSQL, or SQLite required
- Schema: `{ users: [], refresh_tokens: [] }`
- Auto-migration for schema evolution

---

## 4. Complete Feature List

### Feature 1: AI-Powered Symptom Checker (Chatbot)

- Real working chat interface with pattern-matching engine
- Covers **20 symptoms** and **18 disease profiles** from medical knowledge base
- Returns: possible conditions, home remedies, warning signs, severity level
- Confidence meter and condition probability bars shown in real-time
- Supports symptom keywords in English + transliterated Hindi/Punjabi
- Detects hospital search intent automatically from conversation
- Includes coordinate extraction from natural language text

### Feature 2: Multilingual Support (English / Hindi / Punjabi)

- Full trilingual symptom database with English, Hindi, and Punjabi translations
- 10–20+ synonyms per symptom including transliterated regional terms
- Language selector in chatbot interface
- Designed for India's linguistically diverse rural population
- Covers 22 Indian language placeholders for future expansion

### Feature 3: Nearby Hospital Finder (Real-Time API)

- Finds real hospitals using **OpenStreetMap Overpass API**
- Search by: text location, GPS coordinates, or click on map
- Configurable radius (1 / 2 / 5 / 10 / 25 km) and result limit (Top 5 / 10 / 20)
- Rich hospital data returned:
  - Name, full address, distance from user
  - Phone number, website URL
  - Opening hours, emergency department status
  - Operator name, bed count, healthcare type
  - Google Maps link + OpenStreetMap link
- **In-memory caching** with 10-minute TTL to reduce API calls
- **Retry with exponential backoff** for API resilience

### Feature 4: Interactive Leaflet.js Map

- Full-screen interactive map section with OpenStreetMap tiles
- **Live autocomplete search bar** — type a location, get Nominatim suggestions with keyboard navigation
- **"My Location" GPS button** — uses browser geolocation API
- **Click-on-map** — click anywhere to search hospitals at that point
- **Custom markers**: Blue pulsing dot (user), 🏥 emoji markers (hospitals), orange/red hospital pins
- **Radius circle visualization** — shows search area on map
- **OSRM driving route overlay** — click a hospital to see exact driving route with distance and estimated duration
- **Rich hospital popups** — phone, website, hours, operator, beds, emergency badge
- **Hospital result cards** below map with all details
- **Loading overlay** with spinner during searches

### Feature 5: Family Health Vault

- Store and track health records for up to 4 family members
- Expandable member cards: Dadi, Papa, Mama, Chhotu (Indian family roles)
- Designed for multi-generational household health tracking
- Each member has individual health profile

### Feature 6: ASHA Worker Dashboard Mode

- Household risk list for community health workers
- Weekly report generation button
- Designed for India's 1.1 million ASHA workers
- Risk-based prioritization of household visits

### Feature 7: Geo-Contextual Awareness

- India map SVG with pulsing alert dots showing disease hotspots
- Location-aware recommendations
- Auto-detects user region for contextual health alerts

### Feature 8: Voice-First Interface

- Microphone with ring-wave animation
- Voice input support for non-literate users
- Typewriter animation effect showing Hindi phrase translation
- Audio-visual feedback for accessibility

### Feature 9: Photo Analysis / Visual Triage

- Camera viewfinder with scan-line animation
- Visual examination for skin conditions, wounds, rashes
- AI-assisted photo-based symptom identification

### Feature 10: Symptom Timeline Tracking

- SVG chart with animated path drawing on scroll
- Tracks symptom progression over days
- Critical threshold dot animation
- Visual health trend analysis

### Feature 11: User Location Management

- Save/update personal location (text address or GPS coordinates)
- Location settings panel integrated in chatbot
- Coordinate toggle (manual lat/lon entry)
- Geocoding with ambiguity detection (Nominatim importance score analysis)
- **Geocode cache** with 24-hour TTL

### Feature 12: JWT Token Authentication System

- Full signup/login/logout flow
- Secure password storage with bcrypt (12 rounds)
- Dual JWT tokens (access + refresh) — detailed in Security section below
- Auto-refresh interceptor in frontend

---

## 5. Security Architecture (Unique Selling Point)

### 5.1 JWT Token System

| Feature | Implementation |
|---|---|
| **Access Token** | 15-minute expiry, HS256 algorithm, `medicheck` issuer claim |
| **Refresh Token** | 7-day expiry, separate signing secret |
| **Token Storage** | httpOnly cookies (not localStorage) — immune to XSS |
| **Cookie Flags** | `sameSite: 'strict'`, `secure: true` in production |
| **Token Rotation** | Every refresh issues a new token pair, old token invalidated |
| **Reuse Detection** | Family-based — if a stolen refresh token is replayed, the entire token family is revoked, logging out the attacker AND the user for safety |
| **Token Hashing** | SHA-256 hash stored in DB — raw tokens never persisted |

### 5.2 Password Security

| Feature | Implementation |
|---|---|
| **Hashing** | bcryptjs with 12 salt rounds |
| **Strength Validation** | Minimum 8 chars + uppercase + lowercase + digit required |
| **Server-side enforcement** | Validated on backend, not just frontend |

### 5.3 HTTP Security Headers (via Helmet.js)

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN` (clickjacking protection)
- `Strict-Transport-Security` (HSTS)
- `X-XSS-Protection`
- `X-DNS-Prefetch-Control`
- `Referrer-Policy`

### 5.4 Rate Limiting

| Endpoint | Limit |
|---|---|
| `POST /auth/login` | 8 attempts per 15 minutes |
| `POST /auth/refresh` | 30 attempts per 15 minutes |

### 5.5 Cache Security (Back/Forward Protection)

| Layer | Mechanism |
|---|---|
| **Server-side** | `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate` on ALL HTML pages |
| **Pragma** | `no-cache` header |
| **Expires** | Set to `0` |
| **Surrogate-Control** | `no-store` |
| **Result** | Browser back/forward button CANNOT show cached protected pages after logout |

### 5.6 Frontend Auth Guards (Triple Layer)

| Guard | When |
|---|---|
| **`ensureAuthenticated()`** | Runs on every page load — calls `/auth/me`, redirects to `/login` on 401 |
| **`pageshow` event** | Re-checks auth when navigating via browser back/forward (bfcache) |
| **`visibilitychange` event** | Re-checks auth when switching tabs back to MediCheck |
| **`fetch` interceptor** | Global wrapper auto-retries any 401 by refreshing tokens first |
| **Refresh queue** | Concurrent 401s share a single refresh call, preventing race conditions |

### 5.7 Input Validation & Sanitization

| Input | Validation |
|---|---|
| Email | Server-side regex + lowercase normalization + trim |
| Name | Whitespace collapse, max 80 characters |
| Location text | 3–200 character range |
| Coordinates | Latitude ±90, Longitude ±180 bounds check |
| Radius | Clamped between 1–25 km |
| Result limit | Clamped between 1–20 |
| HTML output | `escapeHtml()` function on all dynamically rendered content (XSS prevention) |

### 5.8 Server Startup Validation

- JWT_SECRET must be ≥32 characters or server refuses to start
- JWT_REFRESH_SECRET must be ≥32 characters or server refuses to start
- Expired refresh tokens auto-cleaned every 30 minutes

### 5.9 Other Security Measures

- `.env` file gitignored (secrets never committed)
- No `express.static()` — all pages served through explicit route handlers with middleware checks
- Logged-in users redirected away from `/login` and `/signup` (prevents session confusion)
- Refresh token cookie path-scoped to `/auth` only (minimal exposure)

---

## 6. API Endpoints (Complete Reference)

### Authentication

| Method | Path | Auth | Rate-Limited | Description |
|---|---|---|---|---|
| `POST` | `/auth/signup` | No | No | Create account (name, email, password, confirmPassword) |
| `POST` | `/auth/login` | No | Yes (8/15min) | Authenticate with email + password, receive token cookies |
| `POST` | `/auth/refresh` | Cookie | Yes (30/15min) | Rotate refresh token, get new access + refresh pair |
| `POST` | `/auth/logout` | Cookie | No | Revoke single refresh token, clear cookies |
| `POST` | `/auth/logout-all` | Token | No | Revoke ALL refresh tokens for the user |
| `GET` | `/auth/me` | Token | No | Return authenticated user's profile |

### User & Location

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/me/location` | Yes | Get saved location |
| `PUT` | `/api/me/location` | Yes | Save/update location (text or coordinates) |
| `GET` | `/api/me/nearby-hospitals` | Yes | Find hospitals near saved location |

### Hospital Search

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/nearby/hospitals` | Yes | Find hospitals by ad-hoc location/coordinates |

### Pages

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/` | Yes (redirect) | Main app (app.html) |
| `GET` | `/app` | Yes (redirect) | Alias for main app |
| `GET` | `/login` | No* | Login page (*redirects to `/` if already authenticated) |
| `GET` | `/signup` | No* | Signup page (*redirects to `/` if already authenticated) |
| `GET` | `/logout` | No | Clear cookies, redirect to login |

---

## 7. Database Schema

### Users Collection

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Auto-generated via `crypto.randomUUID()` |
| `name` | string / null | Optional, max 80 chars |
| `email` | string | Unique, lowercase, trimmed |
| `password_hash` | string | bcrypt hash (12 rounds) |
| `created_at` | ISO 8601 | Auto-set on creation |
| `location_text` | string / null | Human-readable saved location |
| `location_lat` | number / null | Saved latitude |
| `location_lon` | number / null | Saved longitude |
| `location_updated_at` | ISO 8601 / null | Last location update |

### Refresh Tokens Collection

| Field | Type | Notes |
|---|---|---|
| `token_hash` | string | SHA-256 hash of raw JWT |
| `user_id` | UUID | References users.id |
| `family` | UUID | Token family for rotation tracking |
| `created_at` | ISO 8601 | Auto-set |
| `expires_at` | ISO 8601 | 7-day default |

---

## 8. Medical Knowledge Base

### 20 Symptoms Covered

| ID | Symptom | Severity |
|---|---|---|
| S001 | Fever / Bukhar / ਬੁਖਾਰ | Moderate |
| S002 | Cough / Khansi / ਖੰਘ | Mild |
| S003 | Headache / Sar Dard / ਸਿਰ ਦਰਦ | Mild |
| S004 | Sore Throat / Gala Kharab | Mild |
| S005 | Shortness of Breath / Saans Phoolna | High |
| S006 | Fatigue / Thakan / ਥਕਾਵਟ | Mild |
| S007 | Vomiting / Ulti / ਉਲਟੀ | Moderate |
| S008 | Diarrhea / Dast / ਦਸਤ | Moderate |
| S009 | Chest Pain / Seene Mein Dard | Critical |
| S010 | Runny Nose / Naak Behna | Mild |
| S011 | Back Pain / Kamar Dard | Moderate |
| S012 | Skin Rash / Khujli / ਖਾਰਸ਼ | Moderate |
| S013 | Abdominal Pain / Pet Dard | Moderate |
| S014 | Eye Problem / Aankh | Moderate |
| S015 | Ear Pain / Kaan Dard | Moderate |
| S016 | Toothache / Daant Dard | Moderate |
| S017 | Urination Problem / Peshab | Moderate |
| S018 | Anxiety / Ghabrahat | Moderate |
| S019 | Swelling / Sujan / ਸੋਜ | Moderate |
| S020 | Dizziness / Chakkar | Moderate |

### 18 Diseases Profiled

Influenza, COVID-19, Dengue, Malaria, Typhoid, Common Cold, Pneumonia, Food Poisoning, Gastritis, Asthma, Migraine, Diabetes, Hypertension, Anemia, Allergic Rhinitis, UTI, Heart Attack, Kidney Stones

Each includes: description, when to see a doctor, and precautions.

---

## 9. Frontend Design & UI/UX

### 9.1 Design System

| Property | Value |
|---|---|
| **Color Scheme** | Dark theme (Deep navy `#060B18` base) |
| **Primary Accent** | Cyan `#00E5FF` |
| **Secondary Accent** | Purple `#7B61FF` |
| **Text Colors** | Primary `#EDF2FF`, Muted `#607B96` |
| **Border Color** | `#1A2F4A` |
| **Error** | Red `#FF4C4C` |
| **Success** | Green `#00E676` |
| **Card Style** | Glassmorphism (`backdrop-filter: blur(16px)` + semi-transparent borders) |
| **Corner Radius** | 16–20px (cards), 10–12px (inputs/buttons) |

### 9.2 CSS Techniques Used

| Technique | Usage |
|---|---|
| **CSS Custom Properties** | 12 theme variables for consistent theming |
| **Glassmorphism** | `backdrop-filter: blur()` + transparent backgrounds on cards |
| **CSS Grid** | Navbar (3-col), hero (2-col), features, stats, impact, footer |
| **Flexbox** | Component-level layouts |
| **`clamp()` fluid typography** | `clamp(30px, 4vw, 44px)` for responsive titles |
| **`min()` containers** | `width: min(1200px, 92vw)` |
| **Gradient text** | `background-clip: text` with cyan→purple gradient |
| **Glow effects** | `box-shadow: 0 0 30px rgba(0, 229, 255, 0.2)` |
| **Scroll-reveal animations** | `IntersectionObserver` with staggered `transitionDelay` |
| **Responsive breakpoints** | 1024px, 900px, 767px (mobile-first grid collapse) |

### 9.3 Animations (15 CSS Keyframe Animations)

| Animation | Used In |
|---|---|
| `fadeInUp` | Section reveals on scroll |
| `pulse` | Map markers, alert dots |
| `ecgDraw` | Hero ECG heartbeat SVG |
| `float` | Hero floating glass cards |
| `shimmer` | Loading states |
| `scanLine` | Photo analysis viewfinder |
| `ringWave` | Voice microphone rings |
| `marquee` | Scrolling content |
| `dashMove` | How-it-works connecting arrows |
| `blink` | Cursor blink in typewriter |
| `bounceDot` | Loading indicators |
| `orbit` | Orbiting dots around How-it-works steps |
| `mapSpin` | Map loading state |
| `mapPulse` | User location marker on map |
| Count-up | Stats bar number animation with `easeOutQuart` |

### 9.4 JavaScript Features (All Vanilla — No Framework)

| Feature | Description |
|---|---|
| **Particle canvas** | 40 animated particles with wrap-around on hero background |
| **ECG path animation** | SVG `stroke-dashoffset` cycling every 3 seconds |
| **Count-up animation** | `easeOutQuart` easing with Indian number formatting (lakhs/crores) |
| **3D phone tilt** | CSS `perspective` + `mousemove` event → `rotateX/Y` on hero phone |
| **Typewriter effect** | Types and deletes Hindi phrases in a continuous loop |
| **Timeline SVG observer** | `IntersectionObserver` draws chart path on scroll |
| **Chatbot engine** | Pattern-matching for symptoms + hospital intent detection |
| **Leaflet map integration** | Custom markers, radius circles, route polylines, autocomplete |
| **JWT auto-refresh** | Global `fetch` wrapper with refresh queue for concurrent requests |
| **Auth guards** | Triple-layer: page load + pageshow + visibilitychange |

---

## 10. Application Architecture

### 10.1 Page Flow

```
User visits / or /app
        │
        ▼
  requireAuthPage middleware
  (JWT cookie check)
        │
   ┌────┴────┐
   │ Valid   │ Invalid
   │         │
   ▼         ▼
 app.html   /login
   │           │
   │     ┌─────┴─────┐
   │     │ POST      │
   │     │/auth/login│
   │     └─────┬─────┘
   │           │ Sets httpOnly cookies
   │           │ (access + refresh)
   │           ▼
   │      redirect to /
   │           │
   ◄───────────┘
   │
   ▼
ensureAuthenticated()
(client-side /auth/me check)
        │
   ┌────┴────┐
   │ 200 OK  │ 401
   │         │
   ▼         ▼
 Show app  Try /auth/refresh
              │
         ┌────┴────┐
         │ Success │ Fail
         │         │
         ▼         ▼
       Retry    /login
```

### 10.2 Token Refresh Flow

```
Access token expires (15 min)
        │
        ▼
  API call returns 401
        │
        ▼
  fetch interceptor catches 401
        │
        ▼
  POST /auth/refresh (with refresh cookie)
        │
   ┌────┴────┐
   │ Valid   │ Invalid/Stolen
   │         │
   ▼         ▼
 Issue new   Delete entire
 token pair  token family
 (rotation)  → 401 → /login
```

### 10.3 Services Architecture

```
routes/nearbyHospitals.js
        │
        ▼
nearbyHospitalsService.js ──► In-memory cache (10 min TTL)
        │
        ▼
    mapProvider.js (factory pattern)
        │
        ▼
    osmProvider.js
        │
   ┌────┴────────────────┐
   │                     │
   ▼                     ▼
Nominatim API       Overpass API
(geocoding)         (hospital search)
```

---

## 11. Unique Selling Points

### 11.1 Technical Differentiators

| # | Unique Point |
|---|---|
| 1 | **Zero-dependency frontend** — No React, Vue, or Angular. Pure HTML/CSS/JS reduces load time and works on low-bandwidth rural connections |
| 2 | **Zero-cost external APIs** — All 4 APIs (Nominatim, Overpass, OSRM, OSM Tiles) are free and require no API keys |
| 3 | **File-based JSON database** — No MongoDB/PostgreSQL setup. Single JSON file makes deployment trivial |
| 4 | **Refresh token rotation with reuse detection** — Enterprise-grade security pattern rarely seen in hackathon projects |
| 5 | **Family-based token revocation** — If a token is stolen and replayed, the entire family is revoked, cutting off the attacker |
| 6 | **Triple-layer auth guards** — Server middleware + client page-load check + visibility/pageshow re-check |
| 7 | **No-store cache headers** — Even browser back button respects logout (most student projects miss this) |
| 8 | **In-memory caching with TTL** — Hospital results and geocode lookups cached to minimize API calls |
| 9 | **Retry with exponential backoff** — API resilience for unreliable rural network connections |
| 10 | **Provider factory pattern** — Map provider is swappable (OSM today, Google tomorrow) without code changes |

### 11.2 Healthcare Differentiators

| # | Unique Point |
|---|---|
| 1 | **Trilingual symptom database** — English + Hindi + Punjabi with 10–20 synonyms per symptom including transliterated regional terms |
| 2 | **Severity classification** — Each symptom rated Mild/Moderate/High/Critical with specific warning signs |
| 3 | **Home remedies** — Culturally appropriate first-aid guidance for rural users without immediate doctor access |
| 4 | **India-specific diseases** — Covers Dengue, Malaria, Typhoid (common rural India diseases) alongside global conditions |
| 5 | **ASHA worker integration** — Dashboard for 1.1M government community health workers |
| 6 | **Family health vault** — Multi-generational tracking matching Indian joint family structure (Dadi, Papa, Mama, Chhotu) |
| 7 | **Real hospital data** — Returns actual hospital names, phone numbers, bed counts from OpenStreetMap |
| 8 | **Driving directions** — OSRM route overlay shows exact road path to hospital, not just distance |
| 9 | **₹0 cost** — Completely free for end users, no premium tier |
| 10 | **Works on low-end devices** — No heavy JS framework, minimal bundle size |

### 11.3 UI/UX Differentiators

| # | Unique Point |
|---|---|
| 1 | **15 CSS animations** — Professional-grade motion design (ECG heartbeat, particle canvas, 3D tilt, typewriter) |
| 2 | **Glassmorphism design** — Modern blur + transparency aesthetic throughout |
| 3 | **Interactive map with autocomplete** — Live search suggestions, keyboard navigation, click-to-search |
| 4 | **Scroll-reveal system** — IntersectionObserver with staggered delays for cinematic page flow |
| 5 | **Indian number formatting** — Stats display in lakhs (1,50,000+) matching local convention |
| 6 | **Responsive down to mobile** — Grid collapse at 3 breakpoints, hamburger menu, stacked layouts |
| 7 | **Dark theme** — Reduces eye strain and battery consumption on OLED screens |

---

## 12. Project Structure

```
medicheck-auth-app/
├── .env                         # Secret configuration (gitignored)
├── .env.example                 # 17 documented environment variables
├── .gitignore                   # Node modules, env, db file
├── package.json                 # 8 dependencies, 0 devDependencies
├── README.md                    # Project documentation
│
├── server.js                    # Express entry point, routes, middleware
├── db.js                        # JSON file database with 11 exported functions
├── medicine.json                # 20 symptoms + 18 diseases knowledge base
├── medicheck-db.json            # Live database file (auto-created)
│
├── middleware/
│   └── auth.js                  # JWT verification, extractToken, requireAuth*
│
├── routes/
│   ├── auth.js                  # Signup, login, refresh, logout, logout-all, me
│   ├── me.js                    # User location CRUD + nearby hospitals
│   └── nearbyHospitals.js       # Ad-hoc hospital search endpoint
│
├── services/
│   ├── nearbyHospitalsService.js  # Hospital search + caching logic
│   ├── userLocationService.js     # Geocode + location resolution
│   └── maps/
│       ├── mapProvider.js         # Provider factory (strategy pattern)
│       └── providers/
│           └── osmProvider.js     # Nominatim + Overpass API client
│
└── public/
    ├── app.html                 # Main SPA (~3,800 lines)
    ├── login.html               # Login page (glassmorphism UI)
    └── signup.html              # Signup page (glassmorphism UI)
```

---

## 13. Environment Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | 3000 | Server port |
| `NODE_ENV` | development | Environment mode |
| `JWT_SECRET` | — | Access token signing key (≥32 chars, required) |
| `JWT_REFRESH_SECRET` | — | Refresh token signing key (≥32 chars, required) |
| `ACCESS_TOKEN_EXPIRY` | 15m | Access token lifetime |
| `REFRESH_TOKEN_EXPIRY_DAYS` | 7 | Refresh token lifetime in days |
| `DB_URL` | ./medicheck-db.json | Database file path |
| `BCRYPT_ROUNDS` | 12 | Password hashing rounds |
| `LOGIN_RATE_LIMIT_MAX` | 8 | Max login attempts per window |
| `MAPS_PROVIDER` | osm | Map provider (extensible) |
| `NOMINATIM_URL` | nominatim.openstreetmap.org | Geocoding API |
| `OVERPASS_URL` | overpass-api.de | Hospital search API |
| `OSM_USER_AGENT` | MediCheck/1.0 | API identification header |
| `MAPS_TIMEOUT_MS` | 10000 | API request timeout |
| `OVERPASS_MAX_RETRIES` | 2 | Retry attempts |
| `HOSPITALS_CACHE_TTL_MS` | 600000 | Hospital cache (10 min) |
| `GEOCODE_CACHE_TTL_MS` | 86400000 | Geocode cache (24 hours) |

---

## 14. How to Run

```bash
# 1. Clone the repository
git clone https://github.com/Armaanjot18/hack-3.git
cd hack-3

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env and set JWT_SECRET and JWT_REFRESH_SECRET (≥32 chars each)

# 4. Start the server
node server.js
# → MediCheck server running at http://localhost:3000

# 5. Open in browser
# Visit http://localhost:3000/signup to create an account
# Then http://localhost:3000 to use the app
```

---

## 15. Impact Statistics (Target)

| Metric | Value |
|---|---|
| Rural Indians served | 500M+ |
| ASHA workers supported | 1.1M |
| Healthcare facilities mapped | 1,50,000+ |
| Indian languages (target) | 22 |
| Reduction in ER visits | 30–40% |
| Cost to end user | ₹0 |

---

## 16. Summary

MediCheck is a **production-grade, full-stack healthcare web application** that combines:

- **AI-powered symptom triage** with a trilingual medical knowledge base
- **Real-time hospital discovery** using free OpenStreetMap APIs with driving directions
- **Enterprise-grade JWT security** with refresh token rotation and reuse detection
- **Professional UI/UX** with 15 animations, glassmorphism design, and full mobile responsiveness
- **Zero-cost architecture** — no paid APIs, no external database, no frontend framework

Built specifically for **rural India's healthcare gap**, it's designed to work on low-end devices, slow networks, and in regional languages — making quality healthcare guidance accessible to the 65% of Indian villages that have no doctor within 10 km.

---

*Project Repository: [github.com/Armaanjot18/hack-3](https://github.com/Armaanjot18/hack-3)*
