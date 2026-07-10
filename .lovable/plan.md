# MSN Courtier — Build Plan

Mobile-first B2B cross-border sourcing platform (Côte d'Ivoire ↔ China) with groupage campaigns and MLM referrals.

## 1. Design System (src/styles.css)
- Primary Deep Red `#D32F2F`, Secondary Rich Violet `#7B1FA2`, dark `#212121`, bg `#F5F5F5`.
- Convert to oklch tokens; add gradients (red→violet), semantic tokens for `--urgency`, `--premium`, `--success`.
- Mobile-first: max-width container, bottom nav, image-heavy cards, pulse animation for urgent deals.
- Fonts: Inter (body) + Space Grotesk (display) via `<link>` in __root.

## 2. Backend (Lovable Cloud)
Enable Cloud. Tables:

- **profiles**: `id` (auth.users FK), `full_name`, `phone`, `city`, `referral_code` (unique), `referred_by` (uuid → profiles), `mlm_level` (int), `created_at`.
- **products**: `id`, `title`, `description`, `image_urls` (text[]), `category`, `cny_price` (numeric), `logistics_fee_xof` (numeric), `exchange_rate_cny_xof` (numeric, default 85), `active` (bool).
- **groupage_campaigns**: `id`, `title`, `shipping_type` (enum: sea/air), `target_quantity`, `current_participants` (int, default 0), `end_date`, `status` (enum: open/closed/shipped/arrived), `eta_days`, `container_image`.
- **campaign_products**: join `campaign_id` ↔ `product_id`.
- **orders**: `id`, `user_id`, `product_id`, `campaign_id`, `quantity`, `total_xof`, `status` (enum: pending/paid_confirmed/shipped/transit/abidjan/delivered), `created_at`.
- **commissions**: `id`, `referrer_id`, `buyer_id`, `order_id`, `amount_xof`, `level` (1/2/3), `created_at`.
- **user_roles** + `has_role()` function (admin/member).

RLS on all tables. GRANTs to authenticated + service_role.

### Triggers/Functions
- **Trigger A** on `orders` insert: increment `groupage_campaigns.current_participants` by qty; if reaches target → set status='closed'.
- **Trigger B** on `orders` update to `paid_confirmed`: walk `profiles.referred_by` up 3 levels; insert commission rows (10%/5%/2% of order total).
- **Function** `handle_new_user()` → create profile row with unique referral_code; capture `referred_by` from signup metadata.

Price computed client-side & server-verified: `cny_price * exchange_rate + logistics_fee`.

## 3. Routes (TanStack Start file-based)
```
src/routes/
  __root.tsx              // shell + bottom nav
  index.tsx               // Landing (catalog + banner)
  groupage.tsx            // Hub with tabs (all/sea/air)
  product.$id.tsx         // Product detail
  auth.tsx                // Sign in / sign up (with referral code capture from ?ref=)
  _authenticated/
    route.tsx             // (integration-managed) auth gate
    mlm.tsx               // MLM dashboard
    profile.tsx           // User profile + orders
    orders.tsx            // Order history + tracking
```

Bottom nav: Home / Groupage / MLM / Profile.

## 4. Key Components
- `ProductCard` with progress bar + countdown timer + import fee badge.
- `CountdownTimer` (client-only, useEffect interval).
- `ProgressBar` with pulse animation when >80%.
- `CampaignCard` for groupage hub.
- `MLMTree` recursive list view.
- `BottomNav` fixed mobile nav.
- `Header` with logo + search.

## 5. Seed Data
Migration seeds ~12 products (electronics, outillage, textile, cosmétique) with realistic CNY prices, 3 active campaigns (2 sea, 1 air).

## 6. Auth Flow
Email/password. Signup accepts `?ref=CODE` query → stored in user_metadata → trigger links `referred_by`.

## Technical Notes
- Progress % = `current_participants / target_quantity * 100`.
- Countdown updates every 1s, hides after 0.
- Currency formatting: `Intl.NumberFormat('fr-CI', {style:'currency', currency:'XOF'})`.
- All product prices computed via helper `computePrice(product)`.
- Server functions for order creation (uses `requireSupabaseAuth`).
- Public catalog reads via publishable-key server client + `TO anon` SELECT policies.

## Out of scope (v1)
- Real payment integration (order marks as "pending payment", admin marks `paid_confirmed` manually).
- Actual image upload for product sharing (uses existing image URLs).
- Chat / notifications.

Approve and I'll build it end-to-end.
