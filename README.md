# D’Bridge Bookshop
A full-stack e-commerce and book-discovery platform for D’Bridge Bookshop.

> Connecting minds to the right books.

---

## Implementation Status

### Working in the current local preview

- Responsive React/Vite storefront with Home, Shop, book details, Cart, Checkout, Recommendations, and account/order routes.
- Development catalog supports search across title, author, category, and tags; category filtering; and sorting.
- Book discovery recommendations use deterministic category/tag matching.
- Cart quantities, totals, and items persist in this browser with `localStorage`.
- Supabase product loading, session restoration, Google OAuth, and owner-scoped order history are wired when configured.
- Express validates order details and authenticated identity. PostgreSQL calculates prices from product records, locks stock rows, and saves idempotent order snapshots transactionally through an RPC.
- Mailgun confirmation delivery runs after order persistence; delivery attempts are recorded and an authenticated owner can retry from order details.
- An owner-only admin area provides dashboard metrics, product CRUD and soft-archive/restore, stock and availability management, cover uploads, and order review/status updates.
- Every admin API checks the authenticated Supabase profile role on the server; customer accounts cannot use admin endpoints.
- Supabase Storage cover uploads validate actual file signatures and enforce JPEG/PNG/WebP and a 5 MB limit.
- Replaced and abandoned uploaded covers have an admin-only cleanup path to prevent unnecessary Storage leftovers.
- Customer storefront catalog queries exclude archived books, and checkout rejects archived or unavailable products server-side.
- Admin routes are `/admin`; order history is never hard-deleted when a book is archived.
- Supabase schema migrations and clearly labeled seed data are in `supabase/`.

The bundled books, prices, and stock are demonstration data, not confirmed D’Bridge inventory. Generated cover art is used until real cover images are supplied. Product ratings/reviews are not fabricated.

### Not implemented or configured yet

- Supabase project credentials; the included migrations and optional seed have not been applied to a live project.
- Google Cloud OAuth credentials and Supabase Google provider configuration.
- Mailgun credentials/domain/sender.
- Live admin sign-in, uploads, and management operations until the latest Supabase migrations are applied and an owner is manually promoted.
- Supabase Storage bucket provisioning and production policies (created by the admin migration when applied).
- Verified D’Bridge inventory, real prices, stock, and cover images.
- Deployment and end-to-end production verification.

Checkout only creates real orders when Supabase is configured and all database migrations have been applied. It never treats browser-submitted prices as authoritative.

### Local setup

```bash
npm install
# Fill in the existing git-ignored .env.local using .env.example as a template.
# Add the frontend and server variables listed below when services are configured.
npm run dev
```

`npm run dev` starts Vite and the Express API. Configure `.env.local` with:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
MAILGUN_API_KEY=
MAILGUN_DOMAIN=
MAILGUN_FROM=
```

The `VITE_` values are public browser configuration. The service-role key and all Mailgun values are server-only secrets; never rename them with a `VITE_` prefix.

Apply migrations in filename order, including `supabase/migrations/20261001232000_admin_inventory.sql`. Optionally run `supabase/seed.sql` for development examples. Configure Google as an Auth provider in Supabase/Google Cloud and allow `http://localhost:5173/auth/callback` as a redirect URL.

After the first owner account signs in, promote that account once from the Supabase SQL editor. Use its exact authenticated user UUID:

```sql
update public.profiles
set role = 'admin'
where id = 'OWNER_AUTH_USER_UUID';
```

Do not add a self-service role editor. Only a trusted project owner should run this statement. Admin cover uploads use the `book-covers` public-read bucket provisioned by the migration; the server service-role credential must remain private. Admin API access is server-verified against `profiles.role` on every request.

Run verification with `npm test` and `npm run build`. For a production-style local server, build first and run `npm start`.

---

## About
D’Bridge Bookshop is a book business based in Benin City, Edo State, Nigeria.

The bookstore focuses on books that help people grow in areas such as:

- Business
- Entrepreneurship
- Leadership
- Personal development
- Self-help
- Motivation
- Christian growth
- Finance
- Productivity
- Habits
- Relationships
- Career development

The website is designed to do more than display books.

It should help customers discover books relevant to what they are trying to learn, improve, solve, or become.

---

# Features

## Customer Features

- Browse books
- Search books
- Filter by category
- View book details
- Add books to cart
- Update cart quantities
- Remove books
- Google authentication
- Checkout
- Persistent order history
- Order details
- Logout
- Re-login
- Confirmation email
- Owner-only inventory and order-management dashboard

---

# HNG Lesson 2 Requirements
This project is being built to satisfy the HNG Lesson 2 individual shop task.

Mandatory integrations:

```
Google Authentication
Supabase
Mailgun
```

Mandatory functionality:

```
Shop
↓
Cart
↓
Checkout
↓
Order persistence
↓
Confirmation email
↓
Order history
```

The project must work after deployment.

---

# Technology
Current target stack:

### Frontend

- React
- Vite
- Tailwind CSS

### Backend

- Node.js
- Express where required

### Database

- Supabase PostgreSQL

### Authentication

- Supabase Auth
- Google OAuth
- Google Cloud Console

### Email

- Mailgun

### Deployment
Deployment platform may be:

- Vercel
- Netlify
- Render
- Other appropriate production hosting

---

# Project Structure
The final project should generally separate:

```
src/
├── components/
├── pages/
├── layouts/
├── hooks/
├── services/
├── lib/
├── utils/
└── ...
```

Backend/API code should remain separated from presentation logic where applicable.

The exact structure may change as implementation progresses.

---

# Main Pages

```
/
 /shop
 /shop/:id
 /cart
 /checkout
 /orders
 /orders/:id
```

Possible future pages:

```
 /about
 /contact
 /recommend
```

---

# Database
Primary database:

Supabase PostgreSQL.

Core tables:

```
profiles
products
orders
order_items
```

Orders belong to authenticated users.

Order items belong to orders.

Historical order data must remain stable even when product information changes.

---

# Authentication
Google authentication is handled through Supabase Auth.

Google Cloud Console is required for OAuth configuration.

Production redirect URLs must be configured correctly.

Authentication must be tested after deployment.

---

# Email
Mailgun is used for order confirmation.

The confirmation email should contain:

- Customer name
- Order number
- Order date
- Purchased books
- Quantities
- Prices
- Total
- Delivery information
- D’Bridge Bookshop branding

---

# Environment Variables
Secrets must never be committed.

The exact variables depend on the final architecture, but configuration will include values for:

```
Supabase
Google OAuth
Mailgun
Application URL
```

Create a local `.env` file.

Never commit it.

---

# Development
Install dependencies:

```
npm install
```

Start development:

```
npm run dev
```

Run the endpoint tests with `npm test` and validate the production frontend with `npm run build`.

Run production build:

```
npm run build
```

Use the actual scripts defined in `package.json` if they differ.

---

# Testing
Every API endpoint created by the project must have tests.

Tests should cover:

- Authentication
- Product retrieval
- Invalid requests
- Order creation
- Order persistence
- Order ownership
- Invalid quantities
- Stock validation
- Checkout behavior

Critical security test:

> One customer must never be able to retrieve another customer's orders.

---

# Development Workflow
Recommended implementation order:

```
1. Foundation
2. Product catalog
3. Supabase
4. Authentication
5. Cart
6. Checkout
7. Orders
8. Mailgun
9. Testing
10. Deployment
11. Production testing
```

---

# Current Business Information
Business:

D’Bridge Bookshop

Location:

Benin City, Edo State, Nigeria.

Current ordering channels:

- Physical store
- Social media

The website will become an additional digital sales channel.

Contact information and exact business hours should be configurable and added when the real business information is provided.

---

# Brand
Primary existing colors:

```
Orange
Purple
```

Design direction:

- Modern
- Premium
- Knowledge-oriented
- Warm
- Clean
- Human

Avoid creating an unrelated visual identity.

---

# Product Catalog
The development catalog can use representative books until the actual D’Bridge inventory is supplied.

Example seed titles:

```
Atomic Habits
How to Win Friends and Influence People
The 7 Habits of Highly Effective People
Think and Grow Rich
Rich Dad Poor Dad
The Power of Habit
The Psychology of Money
Start With Why
Good to Great
The Purpose Driven Life
The Magic of Thinking Big
Leaders Eat Last
```

These are placeholder development products unless verified against the actual shop's inventory.

Replace:

- Images
- Prices
- Stock
- ISBN
- Descriptions

with actual D’Bridge Bookshop information when available.

---

# Recommendation Concept
A major differentiator of the site is book discovery.

Instead of only asking:

> What book are you looking for?

the site can eventually ask:

> What are you trying to improve?

Example:

```
I want to improve my habits.
```

The system can recommend books tagged:

```
habits
discipline
productivity
personal-development
```

The initial implementation can use deterministic category/tag matching.

A future version can introduce AI-powered recommendations.

---

# Production Checklist
Before deployment:

- Production database configured
- Products seeded
- Google OAuth configured
- Production redirect URLs configured
- Mailgun configured
- Environment variables configured
- Secrets excluded from Git
- Tests passing
- Production build passing

After deployment:

- Google sign-in tested
- Product browsing tested
- Cart tested
- Checkout tested
- Order created
- Order visible in database
- Confirmation email received
- User logs out
- User closes website
- User returns
- User signs in again
- Previous order is still visible

---

# Agent Context
Coding agents should read:

```
AGENTS.md
PRD.md
README.md
```

before beginning substantial work.

At the end of significant development sessions, update this README with:

- Current status
- Completed work
- Blockers
- Known bugs
- Configuration still required
- Next recommended task

This project should always remain understandable to a new coding agent joining the project.

---

# Definition of Done
The project is complete when a real customer can:

```
Visit the website
      ↓
Browse books
      ↓
Select a book
      ↓
Add it to cart
      ↓
Sign in with Google
      ↓
Checkout
      ↓
Have the order saved
      ↓
Receive a real confirmation email
      ↓
Log out
      ↓
Close the website
      ↓
Return later
      ↓
Sign in again
      ↓
See the previous order
```

That complete flow is the primary objective of the project.
