---
name: Gmail parsing & dashboard fixes
description: Key decisions made when fixing subscription detection, merchant normalization, yearly pricing, and warranty dedup in the Gmail scan pipeline.
---

# Gmail parsing & dashboard fixes

## Rule: rawBody must be on ParsedMessage
The per-message scan loop processes results from `parseMessage()` in a `Promise.all` map where the original `body` string is not in scope. Any logic that needs the email body text after parse (subscription detection, yearly-billing detection) must use `parsed.rawBody`, not a local `body` variable.

**Why:** This was a `ReferenceError` that silently aborted subscription and warranty creation for every imported receipt despite receipts themselves saving correctly.

## Rule: Set both yearly_price AND monthly_price for yearly subscriptions
When auto-inserting a subscription detected as yearly billing, set:
- `yearly_price = parsed.amount` (the actual charge)
- `monthly_price = amount / 12` (rounded to 2 decimal places)
- `billing_cycle = 'yearly'`

**Why:** `dashboard.ts` calculates Money Saved as `sum(yearly_price / 12)` for yearly subs. If `yearly_price` is null (old behavior: only `monthly_price` was set), yearly subs contribute $0 to the total, causing Money Saved = $0.

## Rule: Merchant normalization must happen at parse time and at aggregation time
`normalizeMerchantName()` is applied in `getMerchantName()` so stored merchant names are already canonical. It is also applied again in the top-merchants aggregation in `dashboard.ts` to handle receipts that were imported before the normalization was added.

**Why:** Without normalization, "Amazon", "Amazon.com", and "Amazon Marketplace" appear as separate entries in Top Merchants with split totals.

## Rule: Warranty dedup key = orderId/invoiceNumber when available, else product+date
Warranty upsert uses `(user_id, product_name)` as the conflict key. The `product_name` field is now set to:
1. `"${productName} (${orderId})"` if an order/invoice ID was extracted  
2. `"${productName} (${purchaseDate})"` as fallback

**Why:** Using just merchant name caused all warranties from the same merchant to conflict. Using productName alone caused same-product-different-purchase collisions. The ID or date suffix makes the key idempotent per purchase while allowing multiple purchases over time.

## Rule: Subscription detection must check rawBody, not just subject+from
The `isSubscriptionEmail` check must include `parsed.rawBody` in the search text, and must also match known subscription service names (Netflix, Spotify, etc.) even when they don't use "subscription" in their email subjects.

**How to apply:** Streaming category receipts are automatically treated as subscription emails. Named SaaS services in the subject/body/from are also matched via a broad regex.
