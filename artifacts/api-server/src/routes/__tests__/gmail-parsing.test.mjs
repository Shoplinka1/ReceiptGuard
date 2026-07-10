import { extractAmount, getMerchantName } from "../gmail.ts";

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"} ${name} -> got ${JSON.stringify(actual)}${ok ? "" : ` expected ${JSON.stringify(expected)}`}`);
  ok ? pass++ : fail++;
}

// Amount extraction
check("simple total", extractAmount("Your Total: $12.99"), { amount: 12.99, currency: "USD" });
check("thousands sep", extractAmount("Amount charged: $1,234.56"), { amount: 1234.56, currency: "USD" });
check("european decimal", extractAmount("Total: €1.234,56"), { amount: 1234.56, currency: "EUR" });
check("currency code suffix", extractAmount("Grand total 45.00 NGN"), { amount: 45, currency: "NGN" });
check("below min rejected", extractAmount("Total: $0.10"), { amount: null, currency: "USD" });
check("above max rejected", extractAmount("Total: $75,000.00"), { amount: null, currency: "USD" });
check("negative/refund rejected", extractAmount("Refund: -$12.99"), { amount: null, currency: "USD" });
check("parenthesized negative rejected", extractAmount("Adjustment: ($12.99)"), { amount: null, currency: "USD" });
check("labeled negative rejected", extractAmount("Amount charged: -$12.99"), { amount: null, currency: "USD" });
check("labeled negative with 'total' rejected", extractAmount("Total: -$45.00"), { amount: null, currency: "USD" });
check("no amount found", extractAmount("Thanks for your order, ship date pending"), { amount: null, currency: "USD" });
check("NaN-proof garbage", extractAmount("$$$ ---- ,,,,"), { amount: null, currency: "USD" });
check("multi-currency body picks first symbol seen", extractAmount("Total: $19.99 (approx €18.20)"), { amount: 19.99, currency: "USD" });
check(
  "unrelated $ elsewhere doesn't override nearby-window currency",
  extractAmount("Some unrelated $ pricing note above.\nTotal charged: 5,000.00 NGN\nThank you."),
  { amount: 5000, currency: "NGN" },
);
check(
  "Flutterwave receipt with no explicit currency defaults to NGN via sender domain",
  extractAmount("Payment received. Total: 5,000.00", "flutterwave.com"),
  { amount: 5000, currency: "NGN" },
);
check(
  "non-Flutterwave receipt with no explicit currency still defaults to USD",
  extractAmount("Payment received. Total: 5,000.00", "example.com"),
  { amount: 5000, currency: "USD" },
);

// Merchant extraction
check("known domain", getMerchantName("netflix.com", '"Netflix" <info@netflix.com>'), "Netflix");
check("subdomain of known domain", getMerchantName("billing.netflix.com", '"Netflix Billing" <billing@netflix.com>'), "Netflix");
check("display name cleanup", getMerchantName("example.com", '"Example Co Receipts" <noreply@example.com>'), "Example Co");
check("unknown domain fallback", getMerchantName("weirdstore123.io", "noreply@weirdstore123.io"), "Weirdstore123");
check("empty display name falls back to domain", getMerchantName("shop.io", "<noreply@shop.io>"), "Shop");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
