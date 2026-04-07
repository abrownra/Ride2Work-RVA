# RideTracker — Project Spec
> Full context for Claude Code sessions. Read this before writing any code.

---

## Project Overview

A modern PWA replacing an AppSheet-based ride tracking system for a **transportation company** that provides **free rides to work** as part of a **City of Richmond grant initiative**. The grantor (City of Richmond, Dept of Equitable Transportation) reimburses the company per ride — invoices and reports must be audit-ready with signatures or the grantor will not honor payment.

**Built with:** React + Vite, Supabase (Postgres + Auth + Storage + Edge Functions), hosted on Vercel or Netlify, free geocoding via Nominatim (OpenStreetMap).

**Company branding:** TBD — all company name, logo, EIN, address fields are stored in a `settings` table and rendered dynamically. Do not hardcode any company information.

---

## User Roles

| Role | Access | Auth |
|---|---|---|
| Driver | Driver PWA only | No login — selects name from dropdown |
| Admin | Admin dashboard + all data | Supabase Auth (email/password) |

---

## Supabase Schema

### `settings`
Editable from admin dashboard. Used for invoice branding and rate calculation.

| key | value (example) |
|---|---|
| company_name | Community Transportation, LLC |
| company_address | 422 E Franklin St. Suite 100 |
| company_city_state_zip | Richmond, VA 23219 |
| company_phone | (804) 625-6410 |
| company_ein | 88-0530711 |
| invoice_payable_to | Community Transportation, LLC |
| invoice_for_dept | Dept of Equitable Transportation |
| invoice_for_org | City of Richmond |
| invoice_for_address | 900 E Broad St. |
| invoice_for_city_state_zip | Richmond, VA 23219 |
| project_name | Free Rides To Work |
| rate_standard | 17.66 |
| rate_long_distance | 21.00 |
| long_distance_threshold_miles | 20 |
| admin_email | (admin's email for Saturday delivery) |

---

### `drivers`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| name | text | |
| phone | text | |
| email | text | |
| active | boolean | default true |
| created_at | timestamptz | |

---

### `riders`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| name | text | |
| phone | text | |
| email | text | |
| home_address | text | |
| pickup_time | time | preferred pickup time |
| active | boolean | default true |
| created_at | timestamptz | |

---

### `trips`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| trip_number | serial | auto-increment |
| driver_id | uuid FK → drivers | |
| rider_id | uuid FK → riders | |
| rider_count | integer | default 1 |
| status | text | 'in_progress', 'completed' |
| start_lat | numeric | |
| start_lon | numeric | |
| start_address | text | reverse geocoded |
| start_timestamp | timestamptz | |
| pickup_lat | numeric | |
| pickup_lon | numeric | |
| pickup_address | text | reverse geocoded |
| pickup_timestamp | timestamptz | |
| dropoff_lat | numeric | |
| dropoff_lon | numeric | |
| dropoff_address | text | reverse geocoded |
| dropoff_timestamp | timestamptz | |
| odometer_start | integer | |
| odometer_end | integer | |
| miles_traveled | numeric | computed: odometer_end - odometer_start |
| signature_url | text | Supabase Storage URL |
| rate_applied | numeric | snapshot of rate at time of trip |
| trip_total | numeric | rate_applied × rider_count |
| created_at | timestamptz | |

---

### `invoices`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| invoice_number | serial | |
| week_start | date | |
| week_end | date | |
| total_rides | integer | |
| total_riders | integer | |
| total_amount | numeric | |
| pdf_url | text | Supabase Storage URL |
| sent_at | timestamptz | |
| created_at | timestamptz | |

---

## Rate Calculation Logic

```
miles = odometer_end - odometer_start
threshold = settings.long_distance_threshold_miles  // default 20
rate = miles > threshold ? settings.rate_long_distance : settings.rate_standard
trip_total = rate × rider_count
```

Rates change from time to time. Always pull from `settings` table at time of calculation — never hardcode rates. Snapshot the applied rate in `trips.rate_applied` for audit trail.

---

## Driver PWA Flow

Single shared UI — no login required for drivers.

### Screen 1 — Select Driver
- Dropdown list of active drivers from `drivers` table
- Large tap targets, simple UI
- "Start Trip" button

### Screen 2 — Start Trip
- Shows selected driver name
- Select rider from dropdown (`riders` table)
- Rider count stepper (default 1)
- Odometer start (numeric input)
- **"I'm On My Way" button** → captures GPS → reverse geocodes → saves `start_lat`, `start_lon`, `start_address`, `start_timestamp` → creates trip record with status `in_progress`

### Screen 3 — Pick Up
- **"I've Arrived" button** → captures GPS → reverse geocodes → saves `pickup_lat`, `pickup_lon`, `pickup_address`, `pickup_timestamp`
- Triggers notification to rider (SMS via Twilio or email via Resend) — "Your driver is outside!"
- **"Rider is in the car"** advances to next screen

### Screen 4 — Drop Off
- **"Drop Off"** button → captures GPS → reverse geocodes → saves `dropoff_lat`, `dropoff_lon`, `dropoff_address`, `dropoff_timestamp`
- Odometer end input
- Signature pad (canvas) — rider signs on driver's phone
- **"Complete Trip"** → uploads signature to Supabase Storage → saves `signature_url` → calculates `miles_traveled`, `rate_applied`, `trip_total` → sets status to `completed`

### Screen 5 — Confirmation
- Trip summary card (driver, rider, pickup address, dropoff address, miles, total)
- Signature thumbnail visible
- "Start New Trip" button → back to Screen 1

---

## Geocoding

Use **Nominatim (OpenStreetMap)** — fully free, no API key required.

```
GET https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json
```

Parse `display_name` or construct from `road`, `house_number`, `city` fields. Add a 1-second delay between requests to respect Nominatim's rate limit policy. Add a `User-Agent` header identifying the app.

Fallback: if geocoding fails, store raw `lat, lon` string as the address so the trip is never lost.

---

## Notifications

On pickup tap, send rider a notification:
- **SMS:** Twilio (free trial tier, ~$15 credit)
- **Email:** Resend (3,000 emails/month free)
- Message: `"Hi [Rider Name], your driver [Driver Name] has arrived and is outside!"`
- Send to `riders.phone` (SMS) or `riders.email` (email) — whichever is available

---

## Admin Dashboard

Protected by Supabase Auth. Accessible at `/admin`.

### Pages:
1. **Dashboard** — this week's trip count, total amount, rides by driver chart
2. **Trips** — full trip log, filterable by driver / date range / status, signature viewable inline
3. **Riders** — add, edit, deactivate riders
4. **Drivers** — add, edit, deactivate drivers
5. **Invoices** — list of past invoices, download PDF
6. **Settings** — edit all `settings` table values (rates, company info, admin email, threshold)

---

## Weekly Report & Invoice (Auto-Generated)

**Trigger:** Supabase Edge Function with cron — fires every **Saturday at 6:00 PM**

**Report covers:** Monday through Saturday of that week (or Sunday–Saturday, confirm with client)

### Weekly Report PDF includes:
- Driver summary table: Driver | Rides | Rider Count | Payout
- Full trip breakdown table with columns:
  - Trip # | Date | Driver | Rider | Pickup Address | Dropoff Address | Miles | Riders | Rate | Total | **Signature (embedded image)**
- Grand total row

### Invoice PDF includes:
- Company header (from `settings`: name, address, phone, EIN)
- Invoice metadata: invoice number, submitted date, due date (7 days out), payable to, invoice for (dept + org + address), project name
- Same trip breakdown table as report (with signatures)
- Invoice total

### Delivery:
- Both PDFs generated server-side (use `pdf-lib` in Edge Function)
- Attached to single email via Resend
- Sent to `settings.admin_email`
- Invoice record saved to `invoices` table with `pdf_url` and `sent_at`

---

## Signatures — Critical Compliance Requirement

> **The grantor will NOT honor invoices without visible signatures. This is non-negotiable.**

- Signatures are captured as canvas drawings on the driver's phone at dropoff
- Uploaded to Supabase Storage bucket `signatures/`
- Stored as PNG
- `trips.signature_url` holds the public URL
- **Every trip row in both the weekly report PDF and invoice PDF must render the signature image inline**
- If signature is missing, flag the trip row visually (red background or warning text)

---

## Tech Stack Summary

| Layer | Tool | Notes |
|---|---|---|
| Frontend | React + Vite | PWA (installable on mobile) |
| Database | Supabase Postgres | |
| Auth | Supabase Auth | Admin only |
| File Storage | Supabase Storage | Signatures + PDFs |
| Scheduled Jobs | Supabase Edge Functions (cron) | Saturday 6pm report/invoice |
| Geocoding | Nominatim (OpenStreetMap) | Free, no key needed |
| PDF Generation | pdf-lib | Server-side in Edge Function |
| Email | Resend | Free tier, 3k/mo |
| SMS | Twilio | Free trial credit |
| Hosting | Vercel or Netlify | Free tier |
| Version Control | GitHub | Shared repo |

---

## Build Phases

### Phase 1 — Core Driver PWA
- Driver select → start trip → pickup → dropoff → signature → complete
- GPS capture + Nominatim geocoding
- Supabase trip record creation

### Phase 2 — Admin Dashboard
- Auth (login/logout)
- Trip log with filters
- Rider + driver management
- Settings page (rates, company info)

### Phase 3 — Reporting & Invoicing
- PDF generation (report + invoice) with embedded signatures
- Manual "Generate Now" button in admin for testing

### Phase 4 — Automation & Notifications
- Saturday cron Edge Function (auto-generate + email)
- Rider SMS/email notification on pickup

---

## Notes & Constraints

- Drivers are **not tech-savvy** — UI must be extremely simple, large buttons, minimal steps, no confusion
- All company branding (name, EIN, address, etc.) is dynamic from `settings` — never hardcode
- Rates change periodically — always read from `settings`, always snapshot in `trips.rate_applied`
- Signatures are legally required for grant compliance — treat as P0 feature
- App must work on mobile browsers (iOS Safari + Android Chrome) as a PWA
- Nominatim rate limit: max 1 request/second, must include `User-Agent` header
- If geocoding fails, fall back to raw `lat,lon` — never block trip completion due to geocoding failure
