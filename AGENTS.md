# AGENTS.md

# D’Bridge Bookshop — Coding Agent Instructions

## 1. Your Role
You are the primary coding agent for the D’Bridge Bookshop project.

Your responsibility is to implement the application described in `PRD.md`.

Do not treat this as a simple frontend mockup.

This is a functional full-stack e-commerce application.

The core integrations are:

```
React
    ↓
Authentication
    ↓
Supabase
    ↓
Products
    ↓
Cart
    ↓
Checkout
    ↓
Orders
    ↓
Mailgun confirmation
```
The application must work in production.

---

# 2. Source of Truth
Before making significant architectural decisions, read:

```
PRD.md
README.md
AGENTS.md
```
The PRD defines the intended product behavior.

This file defines how you should work.

Do not silently replace major requirements with easier alternatives.

If a requirement is technically ambiguous, choose the simplest production-appropriate solution that preserves the requirement.

---

# 3. Business Context
The application is for:

D’Bridge Bookshop

Business location:

Benin City, Edo State, Nigeria.

The business sells books focused primarily on:

- Business
- Entrepreneurship
- Leadership
- Personal development
- Self-help
- Motivation
- Christian growth
- Finance
- Relationships
- Productivity
- Habits
- Career development
- Communication
The business positioning is:

> Connecting minds to the right books.
The website should therefore feel like a bookstore and a book-discovery platform.

Do not make it feel like a generic template bookstore.

---

# 4. Development Philosophy
Prioritize:

1. Correctness
2. Security
3. Maintainability
4. Simplicity
5. User experience
6. Testability
Do not over-engineer the project.

Do not introduce a library merely because it is popular.

Do not rewrite working parts of the application unnecessarily.

Do not create fake integrations.

---

# 5. HNG Lesson 2 Requirements
The following are mandatory:

- Shop/product experience
- Add to cart
- Checkout
- Supabase database
- Persistent orders
- Google authentication
- Mailgun confirmation email
- User order history
- Logout
- Re-login
- Orders remain available after reopening the website
Optional:

- Paystack
- Flutterwave
- Stripe
Do not allow optional payment functionality to delay the mandatory requirements.

---

# 6. Implementation Order
Build in this order unless the existing codebase requires a different sequence:

## Phase 1 — Foundation

- Project setup
- Routing
- Tailwind
- Layout
- Navigation
- Responsive structure

## Phase 2 — Product System

- Supabase connection
- Product schema
- Product seed data
- Product listing
- Search
- Categories
- Product detail

## Phase 3 — Authentication

- Supabase Auth
- Google OAuth
- Auth state
- Protected routes
- Logout

## Phase 4 — Cart

- Add product
- Remove product
- Update quantity
- Cart totals
- Persistence during browsing

## Phase 5 — Checkout

- Customer information
- Delivery information
- Order summary
- Server-side validation

## Phase 6 — Orders

- Create order
- Create order items
- Persist order
- User order history
- Order detail

## Phase 7 — Mailgun

- Mailgun configuration
- Email template
- Confirmation email
- Error handling

## Phase 8 — Owner Admin

- Verify admin role from the server-side profile on every request
- Product CRUD, archive/restore, availability, and stock management
- Admin order listing, detail, and status updates
- Secure book-cover upload and validation

## Phase 9 — Testing

- API tests
- Auth tests
- Order tests
- Security tests
- End-to-end testing

## Phase 10 — Production

- Deploy
- Configure environment variables
- Configure OAuth redirects
- Configure Mailgun
- Configure Supabase
- Test production

---

# 7. Database Rules
Use Supabase PostgreSQL.

Recommended tables:

```
profiles
products
orders
order_items
```
Use foreign keys appropriately.

Orders must belong to authenticated users.

Order items must belong to orders.

Never rely exclusively on client-side data for order creation.

The server must determine:

- Product price
- Quantity validity
- Stock availability
- Subtotal
- Total

---

# 8. Order Ownership
This is critical.

A user must only be able to retrieve their own orders.

Never implement:

```
GET /orders
```
in a way that exposes every customer's orders to every authenticated user.

Use authenticated user identity when querying order data.

Configure Supabase Row Level Security appropriately.

Admin access is granted only through `profiles.role = 'admin'` and is verified by the server for every admin API request. Never trust frontend state or user-editable authentication metadata for authorization. Keep role writes out of customer profile updates.

Promote the shop owner manually with a trusted SQL statement after their first sign-in. Never add self-service role escalation. Archive products instead of hard-deleting them so historical order item snapshots and references remain stable.

The admin Storage upload path must validate image file signatures and size, keep service-role credentials server-side, and restrict mutations to admins. Public catalog queries must exclude archived books; checkout must reject archived or unavailable products transactionally.

---

# 9. Product Pricing
Never trust a price sent by the browser.

Bad:

```
createOrder({
  productId,
  price: clientPrice
});
```
Preferred:

```
client sends product ID + quantity
        ↓
server retrieves product
        ↓
server retrieves actual database price
        ↓
server calculates subtotal
        ↓
server creates order
```

---

# 10. Cart
The cart may initially use local browser persistence.

For example:

```
localStorage
```
is acceptable for the MVP cart.

However:

```
ORDERS MUST BE STORED IN SUPABASE.
```
Do not confuse cart persistence with order persistence.

---

# 11. Authentication
Use Supabase Auth with Google OAuth.

The implementation must handle:

- Sign in
- Auth callback
- Session restoration
- Logout
- Protected pages
- Authenticated API requests
Do not build a fake authentication system.

Do not store Google passwords.

Do not create custom password authentication unless the PRD specifically requires it.

---

# 12. Google OAuth
The developer/user must manually configure:

- Google Cloud Console
- OAuth credentials
- Authorized origins
- Redirect URLs
- Supabase Google provider configuration
The coding agent must provide the required configuration values/instructions but must not assume access to the user's external Google Cloud account.

Production OAuth must be tested.

---

# 13. Mailgun
Use Mailgun for real confirmation emails.

The email must be sent after successful order creation.

Do not send the email before the order is successfully persisted.

Preferred sequence:

```
Validate order
↓
Create order
↓
Create order items
↓
Confirm transaction/result
↓
Send Mailgun email
↓
Return successful checkout response
```
If email delivery fails after the order succeeds:

- Do not delete the successful order.
- Log the email failure.
- Return an appropriate application state.
- Design the system so email can be retried later.
Never expose the Mailgun API key to frontend JavaScript.

---

# 14. Environment Variables
Never commit secrets.

`.gitignore` must include:

```
.env
.env.local
.env.*.local
```
Do not hardcode:

- API keys
- OAuth secrets
- Mailgun credentials
- Supabase service keys
Public client configuration and server secrets must be clearly separated.

---

# 15. API Design
If Express/backend endpoints are used, keep them RESTful and predictable.

Possible endpoints:

```
GET    /api/products
GET    /api/products/:id
POST   /api/orders
GET    /api/orders
GET    /api/orders/:id
```
Additional endpoints may be created when justified.

Admin endpoints belong under `/api/admin`, must use the verified Supabase user identity, and must check the profile role server-side before accessing admin data. Cover uploads must validate actual image bytes, not only the submitted MIME type or file name.

Do not create unnecessary endpoints.

---

# 16. API Validation
Every endpoint must validate input.

Validate:

- IDs
- quantities
- required fields
- email
- phone
- address
- authenticated user
- product existence
- stock availability
Return useful HTTP status codes.

Examples:

```
200 OK
201 Created
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
500 Internal Server Error
```
Do not return `200 OK` for every possible failure.

---

# 17. Testing Rule
CRITICAL HNG REQUIREMENT:

> Write tests for all endpoints that you create and always validate that these endpoints are working.
Every newly created endpoint must have an associated test.

At minimum:

```
products endpoint
orders endpoint
order detail endpoint
```
must be tested if they exist.

Tests should verify both successful and failure cases.

Every admin route needs success and denial/input-failure coverage, including upload validation, product archive/restore, dashboard reads, and order status changes. Explicitly test that authenticated customers receive 403 from admin APIs.

Example:

```
POST /api/orders

Test:
- unauthenticated request rejected
- invalid product rejected
- invalid quantity rejected
- insufficient stock rejected
- valid order created
- order belongs to authenticated user
```

---

# 18. Security Tests
Explicitly test:

### User A cannot read User B's orders.

### User A cannot modify User B's orders.

### Client cannot manipulate product price.

### Unauthenticated users cannot access protected order information.

### Service credentials never appear in browser code.

---

# 19. UI Design
Brand:

```
Orange + Purple
```
The visual system should feel:

- Modern
- Premium
- Intellectual
- Warm
- Clean
- Human
Do not overload the UI with purple and orange.

Use them intentionally.

Prioritize typography, whitespace, hierarchy, and book imagery.

---

# 20. Product Cards
Every product card should clearly communicate:

- Cover
- Title
- Author
- Category
- Price
- Availability
- Add to cart
Avoid overly complicated cards.

---

# 21. Mobile First
The website must be usable on mobile.

Test:

```
320px
375px
390px
430px
768px
1024px
1440px
```
Pay special attention to checkout.

---

# 22. Loading States
Do not leave blank screens while waiting for data.

Use:

- Skeletons
- Loading indicators
- Disabled buttons where appropriate

---

# 23. Error States
Errors should be understandable.

Bad:

```
Error 500
```
Better:

```
We could not complete your order right now.
Please try again.
```
Developer details should go to logs, not users.

---

# 24. Empty States
Provide useful empty states.

Example:

```
Your cart is empty.

Find your next book and start building your library.
```
Orders:

```
You have not placed any orders yet.
Explore the bookstore to find your next book.
```

---

# 25. Recommendation Feature
The first version does not need an AI model.

Use metadata.

Example:

```
User goal:
"Improve my habits"

Relevant tags:
habits
discipline
productivity
personal-development
```
Return relevant products.

Keep the recommendation logic modular so it can later be replaced by an AI recommendation engine.

---

# 26. Seed Data
Seed data is for development.

Do not claim that development prices or stock levels represent actual D’Bridge inventory.

The product schema must make it easy to replace seed data with real inventory.

---

# 27. Code Quality
Prefer:

- Small components
- Clear functions
- Descriptive names
- Reusable utilities
- Separation of concerns
- Explicit error handling
Avoid:

- Giant components
- Repeated API logic
- Hardcoded credentials
- Unnecessary abstractions
- Dead code
- Unused dependencies

---

# 28. Git
Use meaningful commits.

Examples:

```
feat: create bookstore layout
feat: connect product catalog to supabase
feat: implement google authentication
feat: add shopping cart
feat: implement checkout
feat: persist orders
feat: send order confirmation email
test: add order endpoint tests
fix: enforce order ownership
```
Do not use meaningless commits such as:

```
update
changes
fix stuff
done
```

---

# 29. Working With Existing Code
Before changing an existing file:

1. Read it.
2. Understand its purpose.
3. Check imports/dependencies.
4. Identify existing conventions.
5. Make the smallest reasonable change.
Do not rewrite the entire application simply because another architecture looks cleaner.

---

# 30. Before Declaring a Feature Complete
Run:

```
lint
tests
build
```
where available.

Then manually verify the feature.

For API work:

```
write endpoint
↓
write test
↓
run test
↓
manually verify endpoint
↓
only then mark complete
```

---

# 31. Production Verification
Local success is not enough.

Before final completion verify:

- Production URL works.
- Google login works.
- OAuth redirect works.
- Supabase production database works.
- Products load.
- Cart works.
- Checkout works.
- Orders persist.
- Orders are visible after re-login.
- Mailgun sends email.
- Email is actually received.
- No secrets are exposed.

---

# 32. Do Not Fake Completion
Never claim:

```
Google OAuth is working
```
unless it has actually been tested.

Never claim:

```
Mailgun is working
```
unless a real email has been sent and verified.

Never claim:

```
Orders persist
```
unless the application has been closed/reopened and the order retrieved after re-authentication.

---

# 33. Session Continuity
At the end of every significant development session:

Update `README.md` with:

```
Current status
Completed features
Current blockers
Environment/configuration requirements
Known bugs
Next recommended task
```
This allows another coding agent to continue the project without reconstructing the entire history.

---

# 34. Final Definition of Done
Do not declare the project complete until:

- Product catalog works
- Search works
- Category filtering works
- Product details work
- Cart works
- Google authentication works
- Logout works
- Checkout works
- Supabase persists orders
- Order ownership is secure
- My Orders works
- Orders survive logout/re-login
- Orders survive closing/reopening the website
- Mailgun sends confirmation email
- Confirmation email contains correct order information
- API tests exist
- API tests pass
- Production build succeeds
- Production authentication works
- Production database works
- Production email works
- Secrets are not committed
- End-to-end production test passes
The project is not finished until the complete customer journey works.