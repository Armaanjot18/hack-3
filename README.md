# MediCheck Auth Setup

This project now includes secure authentication with signup/login, protected routes, and a separate database module.

## What is implemented

- `db.js`: reusable DB connection and users table initialization
- `POST /auth/signup`
- `POST /auth/login` (rate-limited)
- `POST /auth/logout`
- `GET /auth/me`
- `POST /api/nearby/hospitals` (authenticated)
- Secure session cookies (`httpOnly`, `sameSite`, `secure` in production)
- Route guards for pages and API routes
- Protected app page (`public/app.html`) requiring login
- Nearby hospital lookup tool via OpenStreetMap (Nominatim + Overpass)

## Required environment variables

Copy `.env.example` to `.env` and fill values:

- `PORT`
- `NODE_ENV`
- `SESSION_SECRET`
- `DB_URL`
- `BCRYPT_ROUNDS`
- `LOGIN_RATE_LIMIT_MAX`
- `MAPS_PROVIDER`
- `NOMINATIM_URL`
- `OVERPASS_URL`
- `OSM_USER_AGENT`
- `MAPS_TIMEOUT_MS`
- `OVERPASS_MAX_RETRIES`
- `HOSPITALS_CACHE_TTL_MS`

## Install and run

```bash
npm install
npm start
```

Open:

- `http://localhost:3000/signup`
- `http://localhost:3000/login`

After login, you will be redirected to the protected app at `/`.

## Database schema

The app auto-creates a database file with a `users` collection:

- `id`
- `email` (enforced unique in auth layer)
- `password_hash`
- `created_at`
- `name` (optional)

## Nearby hospitals API

Endpoint:

- `POST /api/nearby/hospitals`

Request body:

```json
{
	"location": "Boston, MA",
	"lat": 42.3601,
	"lon": -71.0589,
	"radius_km": 5,
	"limit": 5
}
```

Rules:

- Provide either `location` OR both `lat` and `lon`
- `radius_km` is clamped to `1..25` (default `5`)
- `limit` is clamped to `1..20` (default `5`)

Response shape:

```json
{
	"query": {
		"location": "Boston, MA",
		"geocoded_location": "Boston, Suffolk County, Massachusetts, United States",
		"lat": 42.3602534,
		"lon": -71.0582912,
		"radius_km": 5,
		"limit": 5,
		"cached": false
	},
	"hospitals": [
		{
			"name": "Massachusetts General Hospital",
			"address": "55, Fruit Street, Boston, MA, 02114, United States",
			"lat": 42.3621,
			"lon": -71.0692,
			"distance_km": 0.93,
			"osm_id": "way/123456",
			"maps_url": "https://www.google.com/maps?q=42.3621,-71.0692"
		}
	]
}
```

## Security notes

- Passwords are hashed using `bcryptjs`
- No plaintext password storage
- Login endpoint is rate-limited
- Unauthorized API requests return `401`
- Unauthorized page access redirects to `/login`
