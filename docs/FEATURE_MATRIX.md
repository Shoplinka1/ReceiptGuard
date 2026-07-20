# ReceiptGuard — Feature Matrix

> Generated: July 2026

---

## Plan Comparison

| Feature | Free | Pro |
|---------|------|-----|
| **Receipts** | Up to 100 | Unlimited |
| **Active subscriptions** | Up to 5 | Unlimited |
| **Warranties** | Up to 10 | Unlimited |
| **Gmail accounts** | 1 | Unlimited |
| **Gmail scan depth** | 100 emails/scan | 10,000 emails/scan |
| **Dashboard** | ✅ Full | ✅ Full |
| **Spending trend charts** | ✅ | ✅ |
| **Top merchants** | ✅ | ✅ |
| **Upcoming renewals widget** | ✅ | ✅ |
| **Subscription breakdown chart** | ✅ | ✅ |
| **Search** | ✅ | ✅ |
| **Basic reminders** | ✅ | ✅ |
| **Reminder windows** | 30d / 14d / 7d / 3d / 1d | 30d / 14d / 7d / 3d / 1d |
| **Email notifications** | ✅ | ✅ |
| **Renewal reminders** | ✅ | ✅ |
| **Warranty reminders** | ✅ | ✅ |
| **Return window reminders** | ✅ | ✅ |
| **In-app notification bell** | ✅ | ✅ |
| **Unread count badge** | ✅ | ✅ |
| **Themes (light/dark/system)** | ✅ | ✅ |
| **Currency setting** | ✅ | ✅ |
| **Language setting** | ✅ | ✅ |
| **Timezone setting** | ✅ | ✅ |
| **Profile editing** | ✅ | ✅ |
| **Password reset** | ✅ | ✅ |
| **Delete account** | ✅ | ✅ |
| **Feedback & bug reports** | ✅ | ✅ |
| **Priority support** | ❌ | ✅ |
| **CSV/PDF export** | ❌ (planned) | ✅ (planned) |
| **Advanced analytics** | ❌ (planned) | ✅ (planned) |

---

## Pricing (NGN)

| Cycle | Price | Per Month |
|-------|-------|-----------|
| Monthly | ₦9,584/month | ₦9,584 |
| Yearly | ₦95,984/year | ₦7,999 (save 17%) |

> Processed via Paystack. USD equivalent at 1600 NGN/USD rate: $5.99/mo, $59.99/yr.

---

## Backend API Routes

### Auth & Users
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/user/profile | Get logged-in user profile (includes isAdmin, plan) |
| PATCH | /api/user/profile | Update name / avatar |
| GET | /api/user/settings | Get user settings (theme, currency, timezone, language) |
| PATCH | /api/user/settings | Update settings |
| GET | /api/user/usage | Get quota usage counts (receipts, subs, warranties, gmail) |
| POST | /api/user/welcome | Send one-time welcome email |
| DELETE | /api/user/account | Delete account and all data |

### Reminders
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/reminders/settings | Get reminder preferences |
| PATCH | /api/reminders/settings | Update reminder preferences |

### Receipts
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/receipts | List receipts (search, filter, sort) |
| POST | /api/receipts | Create receipt (Free: max 100) |
| GET | /api/receipts/:id | Get single receipt |
| PATCH | /api/receipts/:id | Update receipt |
| DELETE | /api/receipts/:id | Delete receipt |
| GET | /api/receipts/summary | Spending summary |

### Subscriptions
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/subscriptions | List subscriptions |
| POST | /api/subscriptions | Create subscription (Free: max 5 active) |
| GET | /api/subscriptions/:id | Get single subscription |
| PATCH | /api/subscriptions/:id | Update subscription |
| DELETE | /api/subscriptions/:id | Delete subscription |
| GET | /api/subscriptions/breakdown | Category + total breakdown |

### Warranties
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/warranties | List warranties |
| POST | /api/warranties | Create warranty (Free: max 10) |
| GET | /api/warranties/:id | Get single warranty |
| PATCH | /api/warranties/:id | Update warranty |
| DELETE | /api/warranties/:id | Delete warranty |

### Gmail
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/gmail/auth-url | Generate Google OAuth consent URL (Free: max 1 account) |
| GET | /api/gmail/callback | OAuth callback — exchanges code, stores tokens, fires scan |
| GET | /api/gmail/accounts | List connected Gmail accounts |
| DELETE | /api/gmail/accounts/:id | Revoke token and disconnect account |
| POST | /api/gmail/scan | Trigger manual inbox scan |

### Notifications
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/notifications | List notifications (paginated) |
| GET | /api/notifications/unread-count | Unread badge count |
| PATCH | /api/notifications/:id/read | Mark one notification read |
| POST | /api/notifications/mark-all-read | Mark all read |
| DELETE | /api/notifications/:id | Delete notification |

### Search
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/search?q= | Cross-entity search (receipts, subscriptions, warranties) |

### Payments (Paystack)
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/paystack/plans | List available plans |
| POST | /api/paystack/initialize | Create checkout session → returns authorizationUrl |
| GET | /api/paystack/verify/:ref | Verify payment after redirect |
| POST | /api/paystack/webhook | Paystack webhook (HMAC-SHA512 verified) |
| GET | /api/paystack/subscription | Get user's active Paystack subscription |
| POST | /api/paystack/cancel | Cancel subscription |
| GET | /api/paystack/payments | Get payment history |

### Feedback
| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/feedback | Submit feedback (types: feedback, feature_request, bug_report, support) |
| GET | /api/feedback | List own feedback submissions |

### Admin (requires is_admin = true in profiles)
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/admin/stats | System-wide stats (users, revenue, MRR, ARR, etc.) |
| GET | /api/admin/users | List all users (search, plan filter, pagination) |
| PATCH | /api/admin/users/:id | Update user (suspend, promote to admin, change plan) |
| DELETE | /api/admin/users/:id | Delete user |
| GET | /api/admin/payments | All payment records |
| GET | /api/admin/feedback | All feedback submissions |
| GET | /api/admin/gmail-accounts | All connected Gmail accounts |
| GET | /api/admin/activity-logs | Activity log stream (type filter, user filter) |
| GET | /api/admin/scan-logs | Gmail scan log stream |
| GET | /api/admin/notification-logs | All user notifications |
| GET | /api/admin/receipts | All receipts (admin view) |
| GET | /api/admin/warranties | All warranties |
| GET | /api/admin/subscriptions | All subscriptions |

---

## Background Jobs (Hourly)

| Job | Description |
|-----|-------------|
| Renewal reminders | Checks subscriptions renewing in 30/14/7/3/1 days, sends email + in-app notification |
| Warranty reminders | Same windows for warranty expiry dates |
| Gmail rescan | Rescans each connected account once per 24 hours for new receipts |
| Expiry downgrade | Finds expired user_subscriptions and resets plan_id to 'free' |

---

## Transactional Emails

| Trigger | Email |
|---------|-------|
| Signup / first login | Welcome email with onboarding steps |
| Gmail connected | Gmail connection confirmation with scan notice |
| Feedback submitted | Confirmation email to submitter + admin notification |
| Subscription renewal reminder | Renewal reminder with amount and date |
| Warranty expiry reminder | Warranty expiry reminder |

---

## Database Tables (Supabase + Row Level Security)

| Table | Purpose |
|-------|---------|
| profiles | User profiles (plan_id, is_admin, is_suspended) |
| plans | Plan definitions (free, pro, pricing) |
| receipts | Email receipts |
| subscriptions | Recurring subscriptions |
| renewals | Renewal tracking entries |
| warranties | Product warranties |
| reminders | Scheduled reminder records |
| payments | Paystack payment records |
| user_subscriptions | Active billing subscriptions |
| email_accounts | Connected Gmail accounts (tokens AES-256-CBC encrypted) |
| notifications | In-app notifications |
| settings | Per-user preferences |
| activity_logs | User and system activity stream |
| feedback | User feedback submissions |
| support_messages | Support message threads |

---

## Environment Variables Required

### API Server (Railway)

| Variable | Required | Description |
|----------|----------|-------------|
| PORT | ✅ | Assigned by Railway automatically |
| SUPABASE_URL | ✅ | Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY | ✅ | Supabase service role key (bypasses RLS) |
| GOOGLE_CLIENT_ID | ✅ | Google OAuth 2.0 client ID |
| GOOGLE_CLIENT_SECRET | ✅ | Google OAuth 2.0 client secret |
| GOOGLE_REDIRECT_URI | ✅ | Must be `https://<railway-domain>/api/gmail/callback` |
| ENCRYPTION_KEY | ✅ | 32-byte hex key (64 chars). Generate: `openssl rand -hex 32` |
| PAYSTACK_SECRET_KEY | ✅ | Paystack secret key (used for API + webhook HMAC-SHA512) |
| EMAIL_HOST | ✅ | SMTP host (e.g. smtp.gmail.com) |
| EMAIL_USER | ✅ | SMTP username |
| EMAIL_PASS | ✅ | SMTP password / app password |
| FRONTEND_URL | ✅ | Frontend URL for redirect URLs and email links |
| SESSION_SECRET | ✅ | Secret for OAuth state signing (any long random string) |
| EMAIL_FROM | optional | Display name for sent emails (defaults to EMAIL_USER) |
| EMAIL_PORT | optional | SMTP port (default: 587) |

### Frontend (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| VITE_SUPABASE_URL | ✅ | Supabase project URL |
| VITE_SUPABASE_ANON_KEY | ✅ | Supabase anon key |
| VITE_API_URL | ✅ | Railway API URL (e.g. `https://your-api.railway.app`) |

---

## Production Checklist

- [ ] All Railway env vars set (especially `ENCRYPTION_KEY`)
- [ ] `GOOGLE_REDIRECT_URI` on Railway = `https://<railway-domain>/api/gmail/callback`
- [ ] Same URI added as Authorized redirect URI in Google Cloud Console
- [ ] `supabase/schema.sql` run in Supabase SQL Editor (particularly reminder_enabled migration)
- [ ] Admin user: `UPDATE profiles SET is_admin = true WHERE email = 'your@email.com';`
- [ ] Paystack webhook URL configured: `https://<railway-domain>/api/paystack/webhook`
- [ ] SMTP credentials verified (test by submitting feedback)
