---
name: Currency detection scan window
description: Why currency symbol/code detection must look near the matched amount, not the whole email body, plus a processor-domain fallback.
---

`extractAmount()` in `artifacts/api-server/src/routes/gmail.ts` originally scanned the ENTIRE email body for the first `$`/`£`/`€`/currency-code match to decide currency, independent of where the actual charged amount was found. An unrelated `$` elsewhere in the email (footer disclaimer, USD-equivalent note, upsell blurb) silently overrode the real currency next to the charge — e.g. Flutterwave (Nigerian processor) receipts importing as USD instead of NGN.

**Why:** Currency signals must be spatially tied to the amount they describe. Whole-body search conflates unrelated mentions with the actual charge.

**How to apply:** Search for currency symbol/code within a narrow window (±~20 chars) around the regex match index for the amount, never the whole body. When no symbol/code is found in that window at all, fall back to a sender-domain → default-currency map (`PROCESSOR_DEFAULT_CURRENCY`, e.g. flutterwave.com/paystack.com → NGN) rather than defaulting to USD — pass the sender's domain into `extractAmount(text, senderDomain)`.
