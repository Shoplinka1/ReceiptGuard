---
name: Money Units Convention
description: How payment amounts are stored in the DB and displayed — single canonical unit prevents /100 bugs.
---

All payment amounts in the payments table are stored in NGN MAJOR units (e.g. 4999 = ₦4,999).

Initialize: amountKobo sent to Paystack API; DB insert stores amountKobo / 100.
Webhook: event.data.amount is in kobo → stored as / 100.
Display: Number(p.amount).toLocaleString() — do NOT divide by 100.
Currency field: always 'NGN' (never 'USD').

**Why:** Storing in major units and displaying directly avoids the class of bugs where both storage and display independently apply /100 and amount appears as ₦49.99 instead of ₦4,999.
