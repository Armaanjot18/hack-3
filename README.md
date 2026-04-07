# MediCheck

MediCheck is a full-stack, multilingual health assistant focused on fast symptom triage and nearby hospital discovery.

It combines:
- secure authentication,
- AI symptom chat with rule-based fallback,
- location-aware hospital search,
- interactive OpenStreetMap visualization,
- voice input/output support for accessibility.

## Final Project Summary

- Type: Node.js + Express web application
- Frontend: Vanilla HTML/CSS/JavaScript
- Database: file-based JSON (no external DB required)
- Maps stack: OpenStreetMap ecosystem (Nominatim, Overpass, OSRM, Leaflet)
- AI: Gemini (optional via env key) with local fallback logic
- Languages: English, Hindi, Punjabi

## Core Features

1. Authentication and session security
2. Protected app routes and protected APIs
3. Symptom chat with multilingual responses
4. Nearby hospitals by text location, coordinates, or saved user location
5. Radius/limit controls and cached map queries
6. Interactive map with search, markers, and route support
7. Voice assistant controls in chat (speech input and spoken reply)

## Project Structure

- server.js: main Express server and chat endpoint
- db.js: JSON database access and token cleanup helpers
- routes/auth.js: signup/login/refresh/logout/me
- routes/nearbyHospitals.js: authenticated hospital lookup endpoint
- routes/me.js: user location endpoints and saved-location nearby search
- services/nearbyHospitalsService.js: geocode + hospital lookup + caching
- services/userLocationService.js: user location validation and resolution
- services/maps/providers/osmProvider.js: OSM provider integration
- middleware/auth.js: page/API auth guards and token verification
- public/app.html: main protected web app
- public/login.html: login page
- public/signup.html: signup page
- medicine.json: symptom and disease knowledge base
- medicheck-db.json: local runtime database file

## Environment Setup

1. Copy .env.example to .env
2. Update secrets and optional API key

Required .env keys:

- PORT
- NODE_ENV
- JWT_SECRET
- JWT_REFRESH_SECRET
- ACCESS_TOKEN_EXPIRY
- REFRESH_TOKEN_EXPIRY_DAYS
- DB_URL
- BCRYPT_ROUNDS
- LOGIN_RATE_LIMIT_MAX
- MAPS_PROVIDER
- NOMINATIM_URL
- OVERPASS_URL
- OSM_USER_AGENT
- MAPS_TIMEOUT_MS
- OVERPASS_MAX_RETRIES
- HOSPITALS_CACHE_TTL_MS
- GEOCODE_CACHE_TTL_MS
- GEMINI_API_KEY (optional but recommended)

## Install and Run (Final Build/Compile Equivalent)

This project does not need a frontend build step. Run directly with Node.js.

```bash
npm install
node server.js
```

Open in browser:

- http://localhost:3000/signup
- http://localhost:3000/login

After login, the app opens at:

- http://localhost:3000/app

## Main API Endpoints

Authentication:

- POST /auth/signup
- POST /auth/login
- POST /auth/refresh
- POST /auth/logout
- POST /auth/logout-all
- GET /auth/me

User location:

- GET /api/me/location
- PUT /api/me/location
- GET /api/me/nearby-hospitals

Hospital search:

- POST /api/nearby/hospitals

## Example Requests

Signup:

```json
{
  "name": "Armaan",
  "email": "armaan@example.com",
  "password": "StrongPass1",
  "confirmPassword": "StrongPass1"
}
```

Nearby hospitals:

```json
{
  "location": "Ludhiana, Punjab",
  "radius_km": 5,
  "limit": 10
}
```

Save location by coordinates:

```json
{
  "location_text": "Raikot",
  "lat": 30.652,
  "lon": 75.610
}
```

## Security Highlights

- bcrypt password hashing
- JWT access + refresh tokens
- refresh token rotation and revocation logic
- httpOnly cookies for auth tokens
- login rate limiting
- Helmet HTTP headers
- no-cache headers on sensitive pages
- server-side validation for auth and location inputs

## Troubleshooting

Port already in use:

- If you see EADDRINUSE, another process is already using port 3000.
- Stop the existing process or change PORT in .env.

Gemini not working:

- Set GEMINI_API_KEY in .env.
- Without it, chat falls back to local rule-based triage.

Map service issues:

- Verify internet connection and OSM endpoints in .env.
- Retry after a short delay if provider is temporarily unavailable.

## Submission Notes

- Keep source files committed.
- Do not commit runtime data changes from medicheck-db.json.
- For demo, start from /login and show multilingual chat + nearby hospitals + voice controls.

## Disclaimer

MediCheck is an educational project for triage assistance and navigation support.
It does not replace licensed medical diagnosis or emergency care.
