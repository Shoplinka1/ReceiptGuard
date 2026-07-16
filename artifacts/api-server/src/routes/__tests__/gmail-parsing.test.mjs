/**
 * Gmail parsing regression tests.
 * Tests extractAmount, getMerchantName, and normalizeMerchantName in isolation
 * without importing any Express/Supabase dependencies.
 *
 * Run: node --experimental-vm-modules artifacts/api-server/src/routes/__tests__/gmail-parsing.test.mjs
 */
import { extractAmount, getMerchantName, normalizeMerchantName } from '../gmail.ts';

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} -> got ${JSON.stringify(actual)}${ok ? '' : ` expected ${JSON.stringify(expected)}`}`);
  ok ? pass++ : fail++;
}
function section(title) { console.log(`\n── ${title} ─`); }

// ─── extractAmount ─────────────────────────────────────────────────────────────

section('Basic amounts');
check('simple total USD',          extractAmount('Your Total: $12.99'),           { amount: 12.99,   currency: 'USD' });
check('thousands separator USD',   extractAmount('Amount charged: $1,234.56'),    { amount: 1234.56, currency: 'USD' });
check('GBP symbol',                extractAmount('Total: £9.99'),                 { amount: 9.99,    currency: 'GBP' });
check('EUR symbol',                extractAmount('Total: €29.00'),                { amount: 29.00,   currency: 'EUR' });
check('NGN symbol',                extractAmount('Total: ₦5,000'),                { amount: 5000,    currency: 'NGN' });
check('INR symbol',                extractAmount('Total: ₹499'),                  { amount: 499,     currency: 'INR' });

section('Currency code suffix (pattern 3)');
check('NGN code — no decimal',     extractAmount('Grand total 45.00 NGN'),        { amount: 45,      currency: 'NGN' });
check('NGN code — whole number',   extractAmount('Total 5000 NGN'),               { amount: 5000,    currency: 'NGN' });  // was broken: mandatory \.\d{2}
check('EUR code — whole number',   extractAmount('Betrag 100 EUR'),               { amount: 100,     currency: 'EUR' });  // German "Betrag" label + EUR code
check('USD code suffix',           extractAmount('Charged 19.99 USD'),            { amount: 19.99,   currency: 'USD' });
check('CAD code suffix',           extractAmount('Total 25.00 CAD'),              { amount: 25.00,   currency: 'CAD' });
check('AUD code suffix',           extractAmount('Amount 49.99 AUD'),             { amount: 49.99,   currency: 'AUD' });
check('GBP code suffix',           extractAmount('Total 14.99 GBP'),              { amount: 14.99,   currency: 'GBP' });
check('ZAR code suffix',           extractAmount('Total 299 ZAR'),                { amount: 299,     currency: 'ZAR' });
check('AED code suffix',           extractAmount('Total 36.75 AED'),              { amount: 36.75,   currency: 'AED' });
check('CHF code suffix',           extractAmount('Betrag 12.50 CHF'),             { amount: 12.50,   currency: 'CHF' });
check('SEK code suffix',           extractAmount('Totalt 99 SEK'),                { amount: 99,      currency: 'SEK' });
check('NOK code suffix',           extractAmount('Totalt 149 NOK'),               { amount: 149,     currency: 'NOK' });
check('DKK code suffix',           extractAmount('Total 89 DKK'),                 { amount: 89,      currency: 'DKK' });
check('PLN code suffix',           extractAmount('Razem 45.99 PLN'),              { amount: 45.99,   currency: 'PLN' });  // PLN was missing entirely
check('PLN whole number',          extractAmount('Do zapłaty 120 PLN'),           { amount: 120,     currency: 'PLN' });
check('JPY code no decimal',       extractAmount('合計 1500 JPY'),                { amount: 1500,    currency: 'JPY' });

section('European decimal format');
check('EUR comma-decimal',         extractAmount('Total: €1.234,56'),             { amount: 1234.56, currency: 'EUR' });
check('EUR comma-decimal simple',  extractAmount('Gesamtbetrag: 29,99 EUR'),      { amount: 29.99,   currency: 'EUR' });
check('large European amount',     extractAmount('Totale: €1.999,00'),            { amount: 1999,    currency: 'EUR' });

section('Refund / negative amounts — must be rejected');
check('negative dollar rejected',          extractAmount('Refund: -$12.99'),              { amount: null, currency: 'USD' });
check('parenthesized negative rejected',   extractAmount('Adjustment: ($12.99)'),         { amount: null, currency: 'USD' });
check('labeled negative rejected',         extractAmount('Amount charged: -$12.99'),      { amount: null, currency: 'USD' });
check('label+total negative rejected',     extractAmount('Total: -$45.00'),               { amount: null, currency: 'USD' });
check('NGN negative rejected',            extractAmount('Refund: -₦5,000'),              { amount: null, currency: 'NGN' });

section('Sanity bounds');
check('below min rejected',    extractAmount('Total: $0.10'),        { amount: null, currency: 'USD' });
check('above max rejected',    extractAmount('Total: $75,000.00'),   { amount: null, currency: 'USD' });
check('no amount found',       extractAmount('Thanks for your order, ship date pending'), { amount: null, currency: 'USD' });
check('NaN-proof garbage',     extractAmount('$$$ ---- ,,,,'),       { amount: null, currency: 'USD' });

section('Subtotal vs total — must pick total (the final charged amount)');
// The label-priority pattern prefers "total" over "subtotal" because "grand total"
// and "total" appear earlier in the pattern than "subtotal".
check('total wins over subtotal',
  extractAmount('Subtotal: $45.00\nTax: $3.60\nTotal: $48.60'),
  { amount: 48.60, currency: 'USD' });
check('grand total wins',
  extractAmount('Subtotal $20.00\nDiscount -$5.00\nGrand Total $15.00'),
  { amount: 15.00, currency: 'USD' });

section('Tax present alongside total');
// Tax line should be ignored when a final "Total" line exists.
check('total present with tax',
  extractAmount('Tax: $1.50\nTotal: $16.50'),
  { amount: 16.50, currency: 'USD' });

section('Discount / "you saved" lines');
check('discount line present',
  extractAmount('You saved: $5.00\nYou paid: $45.00'),
  { amount: 45.00, currency: 'USD' });

section('Multi-currency email — correct currency must be detected');
// Email with a USD conversion note and an NGN charge total.
// The narrow-window fallback must not pick up the leading $0.00.
check('NGN charge in USD-prefixed email',
  extractAmount('USD equivalent: $0.00\n\nTotal: ₦5,000'),
  { amount: 5000, currency: 'NGN' });

// Email with EUR in a disclaimer and GBP as the actual charge.
check('GBP charge, EUR in disclaimer',
  extractAmount('Prices shown in EUR for reference.\n\nAmount charged: £29.99'),
  { amount: 29.99, currency: 'GBP' });

section('Exchange-rate reference lines — must be ignored');
// Exchange-rate lines typically don't have "Total:" labels, so they naturally
// don't match the label pattern. The amount should be picked from the real
// "Total" line further in the email.
check('exchange rate line + real total',
  extractAmount('Exchange rate: 1 USD = 0.92 EUR\nTotal: $24.99'),
  { amount: 24.99, currency: 'USD' });

section('Previous balance vs amount paid');
// "Amount paid" is a recognized label; "Previous balance" is not in the label
// list and should not be matched by the label pattern.
check('amount paid wins over previous balance',
  extractAmount('Previous balance: $100.00\nAmount paid: $35.00'),
  { amount: 35.00, currency: 'USD' });

section('Multilingual receipt amounts');
// German: "Gesamtbetrag" (total amount)
check('German Gesamtbetrag',
  extractAmount('Gesamtbetrag: 49,99 EUR'),
  { amount: 49.99, currency: 'EUR' });
// French: "Montant"
check('French Montant',
  extractAmount('Montant total: €19,99'),
  { amount: 19.99, currency: 'EUR' });
// Spanish: "Importe"
check('Spanish Importe',
  extractAmount('Importe total: 25,00 EUR'),
  { amount: 25.00, currency: 'EUR' });
// Dutch: "Bedrag"
check('Dutch Bedrag',
  extractAmount('Totaalbedrag: €12,99'),
  { amount: 12.99, currency: 'EUR' });

// ─── getMerchantName ───────────────────────────────────────────────────────────

section('getMerchantName — known domains');
check('netflix exact domain',      getMerchantName('netflix.com',         '"Netflix" <info@netflix.com>'),           'Netflix');
check('subdomain of known domain', getMerchantName('billing.netflix.com', '"Netflix Billing" <billing@netflix.com>'), 'Netflix');
check('spotify domain',            getMerchantName('spotify.com',         '<payment@spotify.com>'),                  'Spotify');
check('amazon.com domain',        getMerchantName('amazon.com',          '"Amazon" <auto-confirm@amazon.com>'),     'Amazon');
check('amazon.co.uk domain',      getMerchantName('amazon.co.uk',        '"Amazon" <auto-confirm@amazon.co.uk>'),  'Amazon UK');
check('github.com domain',        getMerchantName('github.com',          '"GitHub" <billing@github.com>'),          'GitHub');
check('linkedin domain',          getMerchantName('linkedin.com',        '"LinkedIn" <payments@linkedin.com>'),     'LinkedIn');
check('twitter domain → X',      getMerchantName('twitter.com',         '"Twitter" <billing@twitter.com>'),        'X');
check('x.com domain → X',        getMerchantName('x.com',               '"X" <noreply@x.com>'),                   'X');
check('temu domain',              getMerchantName('temu.com',            '"Temu" <noreply@temu.com>'),              'Temu');
check('aliexpress domain',        getMerchantName('aliexpress.com',      '"AliExpress" <noreply@aliexpress.com>'), 'AliExpress');
check('bolt.eu domain',           getMerchantName('bolt.eu',             '"Bolt" <noreply@bolt.eu>'),              'Bolt');
check('audible domain',           getMerchantName('audible.com',        '"Audible" <no-reply@audible.com>'),       'Audible');
check('max.com domain',           getMerchantName('max.com',            '"Max" <noreply@max.com>'),                'Max');
check('primevideo domain',        getMerchantName('primevideo.com',     '"Prime Video" <digital-no-reply@amazon.com>'), 'Prime Video');

section('getMerchantName — display name cleanup');
check('display name cleanup',      getMerchantName('example.com',    '"Example Co Receipts" <noreply@example.com>'),  'Example Co');
check('noreply prefix stripped',   getMerchantName('acme.io',        '"Acme Billing" <noreply@acme.io>'),             'Acme');
check('unknown domain fallback',   getMerchantName('weirdstore123.io', 'noreply@weirdstore123.io'),                   'Weirdstore123');
check('empty display name',        getMerchantName('shop.io',          '<noreply@shop.io>'),                          'Shop');

// ─── normalizeMerchantName ────────────────────────────────────────────────────

section('normalizeMerchantName — Amazon variants (including AMZN)');
check('AMZN',                normalizeMerchantName('AMZN'),                   'Amazon');
check('AMZN Mktp US',       normalizeMerchantName('AMZN Mktp US'),           'Amazon');
check('Amazon Marketplace', normalizeMerchantName('Amazon Marketplace'),     'Amazon');
check('Amazon EU S.à r.l.', normalizeMerchantName('Amazon EU S.à r.l.'),    'Amazon');
check('Amazon Web Services', normalizeMerchantName('Amazon Web Services'),   'Amazon');
check('Amazon Prime',        normalizeMerchantName('Amazon Prime'),          'Amazon');
check('amazon.co.uk',       normalizeMerchantName('amazon.co.uk'),          'Amazon');

section('normalizeMerchantName — other canonical forms');
check('Apple Inc.',          normalizeMerchantName('Apple Inc.'),     'Apple');
check('Apple App Store',     normalizeMerchantName('Apple App Store'), 'Apple');
check('Apple iTunes',        normalizeMerchantName('Apple iTunes'),   'Apple');
check('Google LLC',          normalizeMerchantName('Google LLC'),     'Google');
check('Google Play Store',   normalizeMerchantName('Google Play Store'), 'Google');
check('Microsoft Corporation', normalizeMerchantName('Microsoft Corporation'), 'Microsoft');
check('Microsoft 365',       normalizeMerchantName('Microsoft 365'),  'Microsoft');
check('Notion Labs Inc',     normalizeMerchantName('Notion Labs Inc'), 'Notion');
check('Atlassian Pty Ltd',   normalizeMerchantName('Atlassian Pty Ltd'), 'Atlassian');
check('OpenAI LLC',          normalizeMerchantName('OpenAI LLC'),     'OpenAI');
check('LinkedIn Premium',    normalizeMerchantName('LinkedIn Premium'), 'LinkedIn');
check('Bolt Technologies',   normalizeMerchantName('Bolt Technologies'), 'Bolt');
check('Temu Inc',            normalizeMerchantName('Temu Inc'),        'Temu');
check('AliExpress Logistics', normalizeMerchantName('AliExpress Logistics'), 'AliExpress');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
