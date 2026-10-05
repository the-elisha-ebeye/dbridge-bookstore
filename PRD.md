# D’Bridge Bookshop — Product Requirements Document

## 1. Product Overview

### Product Name
D’Bridge Bookshop

### Product Type
Full-stack e-commerce/book discovery website.

### Business
D’Bridge Bookshop is a physical and online-oriented book business in Benin City, Edo State, Nigeria.

The business focuses primarily on personal development, leadership, business, Christian, motivational, self-help, and related books.

The core business proposition is not simply "selling books."

D’Bridge Bookshop helps customers identify and obtain the right books for the knowledge, problem, goal, or stage of life they are dealing with.

Core positioning:

> Connecting minds to the right books.

### Project Objective
Build a production-ready MVP that allows customers to:

1. Discover books.
2. Search and filter books.
3. View detailed book information.
4. Add books to a cart.
5. Create an account/sign in using Google.
6. Complete checkout.
7. Have their order permanently stored in the database.
8. Receive a confirmation email after successful checkout.
9. Close and reopen the website.
10. Sign in again.
11. Still see their previous orders.

The project must satisfy the HNG Lesson 2 shop/integration requirements.

---

# 2. Problem Statement
Many customers know they want to improve in an area but do not necessarily know which book they need.

A conventional bookstore primarily asks:

> "Which book do you want?"

D’Bridge Bookshop should instead help communicate:

> "What are you trying to learn, solve, improve, or become?"

The website should therefore make book discovery simple while creating room for recommendation-oriented discovery.

---

# 3. Target Users

## Primary Users

### Personal Development Reader
Someone looking for books about:

- Habits
- Discipline
- Personal growth
- Confidence
- Productivity
- Mindset
- Purpose
- Relationships

### Business/Entrepreneurship Reader
Someone interested in:

- Entrepreneurship
- Leadership
- Sales
- Marketing
- Business strategy
- Management
- Finance
- Career development

### Christian Reader
Someone looking for:

- Christian living
- Faith
- Spiritual growth
- Leadership
- Purpose
- Christian relationships
- Biblical principles

### New Reader
Someone who wants to start reading but does not know where to begin.

---

# 4. Core User Experience
The ideal flow is:

Home
→ Discover books
→ Search/filter
→ Open book
→ Add to cart
→ Cart
→ Checkout
→ Sign in with Google
→ Enter/confirm delivery information
→ Place order
→ Order saved in Supabase
→ Mailgun confirmation email
→ Order appears in My Orders

Returning customer:

Home
→ Sign in with Google
→ My Orders
→ Previous orders visible

---

# 5. Required HNG Features
These are mandatory.

## Authentication
Use Google Authentication.

Requirements:

- Google sign-in must work.
- User identity must be persisted.
- Users must be able to sign out.
- Authentication must work in production.
- OAuth redirect URLs must be correctly configured for production.

Preferred implementation:

Supabase Auth with Google OAuth.

Google Cloud Console is still required for configuring the OAuth credentials.

---

# 6. Product Catalog
The application must have a real database-backed product catalog.

Each book should contain at minimum:

```
id
title
author
description
price
category
image_url
stock_quantity
isbn
featured
created_at
updated_at
```

Optional fields:

```
publisher
publication_year
pages
format
tags
rating
```

## Categories
Initial categories should include:

- Business
- Entrepreneurship
- Leadership
- Personal Development
- Self-Help
- Motivation
- Christian
- Finance
- Relationships
- Productivity
- Habits
- Career
- Communication

The category system must be easy to modify.

---

# 7. Seed Catalog
The development catalog may begin with representative books.

Examples:

- Atomic Habits — James Clear
- How to Win Friends and Influence People — Dale Carnegie
- The 7 Habits of Highly Effective People — Stephen R. Covey
- Think and Grow Rich — Napoleon Hill
- Rich Dad Poor Dad — Robert Kiyosaki
- The Power of Habit — Charles Duhigg
- The 48 Laws of Power — Robert Greene
- The Psychology of Money — Morgan Housel
- Start With Why — Simon Sinek
- The 5 AM Club — Robin Sharma
- Good to Great — Jim Collins
- The Purpose Driven Life — Rick Warren
- Who Moved My Cheese? — Spencer Johnson
- The Magic of Thinking Big — David J. Schwartz
- Leaders Eat Last — Simon Sinek

IMPORTANT:

These are development/seed products only.

Do not represent the prices, stock quantities, images, or availability of these books as verified D’Bridge Bookshop inventory.

The catalog must be designed so the real inventory can replace the seed data.

---

# 8. Home Page
The home page should immediately communicate the D’Bridge identity.

## Hero
Suggested direction:

"Find the right book for where you are going."

Supporting message:

"Books that help you learn, grow, lead and become more."

Primary CTA:

"Explore Books"

Secondary CTA:

"Help Me Find a Book"

The exact marketing copy can be refined during implementation.

---

# 9. Book Discovery
The shop page should provide:

- Search
- Category filtering
- Sorting
- Product cards
- Price display
- Availability/stock status
- Add to cart
- View details

Search should support:

- Book title
- Author
- Category
- Relevant tags

---

# 10. Book Details Page
Each book should have:

- Cover image
- Title
- Author
- Price
- Category
- Description
- Availability
- Quantity selector
- Add to cart button

Optional:

- Related books
- Recommended books
- "You may also like"

---

# 11. Recommendation Experience
A lightweight recommendation experience should be included.

The user should be able to select or describe an area such as:

- I want to start a business
- I want to develop better habits
- I want to become a better leader
- I want to improve my finances
- I want to grow spiritually
- I want to improve my relationships
- I want to become more productive
- I want to start reading

The MVP does NOT need a complex AI recommendation engine.

For the first version, use category/tag-based recommendations.

Example:

User chooses:

"Improve my habits"

System recommends books tagged:

```
habits
productivity
discipline
personal-development
```

Architecture should leave room for a future intelligent recommendation system.

---

# 12. Cart
Users must be able to:

- Add products
- Remove products
- Increase quantity
- Decrease quantity
- See subtotal
- See total quantity
- Proceed to checkout

Cart state should survive normal page navigation.

A reasonable MVP may persist the cart locally until checkout.

Orders, however, MUST be persisted in the database.

---

# 13. Checkout
Checkout must collect the information required to fulfill an order.

Minimum:

- Customer name
- Email
- Phone number
- Delivery address
- City
- State
- Order items
- Quantity
- Total

The authenticated user's email should be populated from the authentication session where appropriate.

Before placing the order, show an order summary.

---

# 14. Order Creation
When checkout is successfully completed:

1. Validate the authenticated user.
2. Validate cart contents.
3. Validate product availability.
4. Calculate the order total on the server.
5. Create the order in Supabase.
6. Create order item records.
7. Reduce stock where appropriate.
8. Trigger confirmation email.
9. Show successful order confirmation.
10. Make the order visible under "My Orders."

Do not trust totals calculated only on the frontend.

---

# 15. Database
Primary database:

Supabase PostgreSQL.

Neon is an accepted alternative according to the HNG requirements, but Supabase is preferred because it can also provide authentication and integrates naturally with the project.

Suggested tables:

## profiles

```
id
email
full_name
avatar_url
phone
created_at
updated_at
```

## products

```
id
title
author
description
price
category
image_url
isbn
stock_quantity
featured
created_at
updated_at
```

## orders

```
id
user_id
customer_name
email
phone
delivery_address
city
state
subtotal
shipping_fee
total
status
created_at
updated_at
```

## order_items

```
id
order_id
product_id
product_title
unit_price
quantity
subtotal
created_at
```

Store the product title and unit price in order_items as a snapshot so historical orders do not change when a product is later edited.

---

# 16. Order Status
Initial statuses:

```
pending
confirmed
processing
shipped
delivered
cancelled
```

The MVP may initially create orders as:

```
confirmed
```

or:

```
pending
```

depending on whether payment is implemented.

---

# 17. My Orders
Authenticated users must have an orders page.

Display:

- Order number
- Date
- Items
- Quantity
- Total
- Status

Clicking an order should show the order details.

Most importantly:

The orders must remain available after:

1. User logs out.
2. Browser/page closes.
3. User returns.
4. User signs in again.

This is one of the main HNG acceptance tests.

---

# 18. Confirmation Email
Use Mailgun.

After a successful order:

Send a professionally formatted confirmation email containing:

- D’Bridge Bookshop branding
- Customer name
- Order number
- Order date
- Items purchased
- Quantity
- Individual prices
- Total
- Delivery information
- Thank-you message

Example subject:

```
Order Confirmation — D’Bridge Bookshop #DB-XXXX
```

The email must be a real email sent through Mailgun.

Do not fake the email functionality.

---

# 19. Payments
Payments are optional for HNG.

If implemented, use test mode.

Possible providers:

- Paystack
- Flutterwave
- Stripe

Do NOT allow payment integration to block the mandatory HNG functionality.

The application should be fully demonstrable even if payment is omitted.

---

# 20. Admin and Inventory Management
The MVP includes a secure, owner-only admin area at `/admin`.

## Admin Access
- Admin identity comes from `profiles.role = 'admin'`, checked by the server for every admin API request.
- Customers cannot grant themselves admin access or manage profile roles.
- Initial owner promotion is performed by a trusted project owner in the Supabase SQL editor.
- Admin authorization must never depend only on frontend route guards or user-editable authentication metadata.

## Dashboard
- Show total orders, non-cancelled order revenue, this-month order count, active catalog size, and low-stock count.
- Show recent orders and a short low-stock list.

## Product and Inventory Management
- Create and edit product title, author, description, category, ISBN, tags, price, cover, featured status, availability, and stock quantity.
- Accept a validated HTTP(S) cover URL or upload JPEG, PNG, or WebP cover art through the authenticated server API (maximum 5 MB).
- Preview the selected cover before saving.
- Archive and restore books; do not hard-delete historical products referenced by orders.
- Public catalog views omit archived items and communicate unavailable/out-of-stock state.
- Checkout must reject archived and unavailable items even if stale cart data is submitted.

## Order Management
- Admins can view all customer orders and their item/delivery snapshots.
- Admins can update order status among `pending`, `confirmed`, `processing`, `shipped`, `delivered`, and `cancelled`.
- Admin privileges must not weaken customer ownership boundaries for customer-facing order endpoints.

## Storage and Auditability
- Use the `book-covers` Supabase Storage bucket with public reads and admin-only mutations.
- Keep Supabase service-role credentials server-side.
- Preserve product title and price snapshots in order items when catalog data changes.

---

# 21. Pages
Minimum pages:

```
/
 /shop
 /shop/:id
 /cart
 /checkout
 /orders
 /orders/:id
 /auth/callback
 /admin
```

Potential additional pages:

```
 /about
 /contact
 /recommend
```

---

# 22. Navigation
Desktop navigation should include:

- D’Bridge Bookshop logo
- Home
- Shop
- Categories
- Recommendations
- Cart
- Account/Orders

Mobile navigation must be responsive.

---

# 23. Brand Direction
Primary brand colors:

- Orange
- Purple

These are existing business colors and should be respected.

Do not create a completely unrelated visual identity.

The design should feel:

- Modern
- Intellectual
- Warm
- Premium
- Approachable
- Knowledge-oriented

Avoid making the interface look like a generic church website or generic Amazon clone.

---

# 24. Responsive Design
The application must work on:

- Desktop
- Laptop
- Tablet
- Mobile

Pay particular attention to:

- Product cards
- Navigation
- Cart
- Checkout forms
- Order history
- Book detail pages

---

# 25. Technical Stack
Preferred stack:

Frontend:

- React
- Vite
- Tailwind CSS

Backend/application:

- Node.js
- Express where backend API routes are required

Database:

- Supabase PostgreSQL

Authentication:

- Supabase Auth
- Google OAuth
- Google Cloud Console

Email:

- Mailgun

Deployment:

- Vercel, Netlify, Render, or another suitable platform

The exact stack may be adjusted if the HNG environment or existing project structure requires it, but unnecessary technology changes should be avoided.

---

# 26. Environment Variables
Secrets MUST NEVER be committed to Git.

Expected environment configuration should include the appropriate variables for:

- Supabase URL
- Supabase anonymous/public key
- Supabase service key where server-side use is necessary
- Google OAuth credentials where required
- Mailgun API key
- Mailgun domain
- Mailgun sender
- Application URL

Never expose server secrets in frontend code.

---

# 27. Security Requirements
The application must:

- Validate authenticated users server-side.
- Never trust frontend order totals.
- Validate product IDs.
- Validate quantities.
- Check stock.
- Prevent users from reading other users' orders.
- Protect service-role credentials.
- Use environment variables for secrets.
- Avoid committing `.env`.
- Configure Supabase Row Level Security appropriately.

---

# 28. Testing
Tests must cover important application behavior.

At minimum test:

### Authentication

- Authenticated user can access orders.
- Unauthenticated user cannot access protected order data.

### Products

- Products can be retrieved.
- Invalid product IDs are handled.

### Orders

- Authenticated user can create an order.
- Order is persisted.
- Order items are persisted.
- Order total is calculated correctly.
- User can retrieve their own orders.
- User cannot retrieve another user's orders.

### Email
Where practical, test that the email service is invoked with the expected order information.

All API endpoints created by the project must have tests.

After creating endpoints, validate that they actually work.

---

# 29. Git Requirements
Use meaningful commits.

Examples:

```
feat: build book catalog
feat: add Google authentication
feat: implement cart
feat: add checkout flow
feat: persist orders
feat: add Mailgun confirmation email
test: add order API tests
fix: protect order ownership
```

Do not commit:

```
.env
API keys
OAuth secrets
Mailgun credentials
Supabase service keys
```

---

# 30. Acceptance Criteria
The project is complete only when the following works in production:

### Test 1 — Sign In
User can sign in with Google.

### Test 2 — Browse
User can browse real database-backed products.

### Test 3 — Cart
User can add books to the cart.

### Test 4 — Checkout
User can complete checkout.

### Test 5 — Persistence
The order is stored in Supabase.

### Test 6 — Email
The customer receives a real Mailgun confirmation email.

### Test 7 — Orders
The user can open "My Orders" and see the order.

### Test 8 — Logout
The user can log out.

### Test 9 — Reopen
The user can close/reopen the website.

### Test 10 — Re-authenticate
The user can sign in again.

### Test 11 — Historical Orders
The previous order is still visible.

If any of these fail, the project is not complete.

---

# 31. Future Vision
Future versions can evolve D’Bridge Bookshop from an e-commerce store into a personalized book discovery platform.

Potential future features:

- AI book recommendation
- "Tell us what you are struggling with"
- Reading profiles
- Personalized reading lists
- Book bundles
- Gift books
- Corporate book orders
- School/institutional orders
- Reading challenges
- Community integration
- Reviews
- Wishlist
- WhatsApp ordering
- Delivery tracking
- Payment integration
- Admin dashboard
- Inventory management
- Analytics

The architecture should avoid preventing these future capabilities.

---

# 32. Definition of Done
The D’Bridge Bookshop MVP is done when:

- UI is responsive.
- Products come from the database.
- Google authentication works.
- Cart works.
- Checkout works.
- Orders persist.
- Users can retrieve their own historical orders.
- Mailgun sends real confirmation emails.
- Secrets are protected.
- Tests exist for created API endpoints.
- Production environment variables are configured.
- Production authentication works.
- Production database works.
- Production email works.
- End-to-end testing has been completed.
