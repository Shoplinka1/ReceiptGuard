import { Link } from 'wouter'
import { Button } from '@/components/ui/button'

const LAST_UPDATED = 'July 4, 2026'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">R</div>
              <span className="font-bold text-lg">ReceiptGuard</span>
            </div>
          </Link>
          <Link href="/login"><Button variant="outline" size="sm">Sign in</Button></Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-14 prose prose-sm dark:prose-invert">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground text-sm mb-10">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="text-lg font-semibold mb-3">1. What we collect</h2>
            <p className="text-muted-foreground">
              ReceiptGuard collects only the information necessary to provide the service:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-muted-foreground">
              <li><strong className="text-foreground">Account information:</strong> Your email address and optional display name, used to identify your account.</li>
              <li><strong className="text-foreground">Gmail OAuth tokens:</strong> Read-only access tokens issued by Google when you connect a Gmail account. These are encrypted with AES-256 and stored server-side only — never in your browser or exposed to the client.</li>
              <li><strong className="text-foreground">Receipt and transaction data:</strong> Extracted from emails you authorise us to scan: merchant name, amount, date, category.</li>
              <li><strong className="text-foreground">Subscription and warranty data:</strong> Detected from your emails or manually entered by you.</li>
              <li><strong className="text-foreground">Usage data:</strong> Aggregate usage metrics (pages visited, features used) to improve the service. We do not track individual user behaviour beyond what is necessary to operate the service.</li>
              <li><strong className="text-foreground">Payment data:</strong> Processed by Paystack. ReceiptGuard never sees or stores your card number or banking credentials.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">2. How we use your data</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>To provide and improve the ReceiptGuard service.</li>
              <li>To send renewal reminder notifications you have opted into.</li>
              <li>To process your subscription payments via Paystack.</li>
              <li>To respond to support requests.</li>
              <li>We <strong className="text-foreground">do not</strong> sell, rent, or share your personal data with third parties for advertising.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">3. Gmail data usage</h2>
            <p className="text-muted-foreground">
              ReceiptGuard's use of Gmail data is limited to:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-muted-foreground">
              <li>Scanning emails matching known receipt, invoice, and purchase confirmation patterns.</li>
              <li>Extracting merchant name, amount, date, and order information from those emails.</li>
              <li>Detecting subscription renewals and warranty information from purchase emails.</li>
            </ul>
            <p className="mt-3 text-muted-foreground">
              We <strong className="text-foreground">never</strong> read personal conversations, newsletters, or any email not matching a recognised purchase/receipt pattern. Gmail access is strictly read-only. We comply with Google's <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-primary underline" target="_blank" rel="noopener noreferrer">API Services User Data Policy</a>, including the Limited Use requirements.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">4. Data retention</h2>
            <p className="text-muted-foreground">
              Your data is retained for as long as your account is active. You may delete your account and all associated data at any time from <strong className="text-foreground">Settings → Data → Delete Account</strong>. Deletion is immediate and permanent.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">5. Security</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Gmail OAuth tokens are encrypted at rest using AES-256-CBC with a unique IV per token.</li>
              <li>All data is transmitted over HTTPS/TLS.</li>
              <li>Passwords are hashed using bcrypt via Supabase Auth and are never stored in plaintext.</li>
              <li>Access to your data is restricted to your account via Row Level Security policies in our database.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">6. Your rights</h2>
            <p className="text-muted-foreground">You have the right to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-muted-foreground">
              <li>Access the data we hold about you (export via Settings → Data).</li>
              <li>Delete your account and all associated data (Settings → Data → Delete Account).</li>
              <li>Revoke Gmail access at any time (Settings → Gmail Accounts → Disconnect, or via your Google Account settings).</li>
              <li>Opt out of email notifications (Settings → General → Notifications).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">7. Contact</h2>
            <p className="text-muted-foreground">
              For privacy questions or data requests, contact us via the <Link href="/support" className="text-primary underline">Support page</Link>.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border text-xs text-muted-foreground flex flex-wrap gap-4">
          <Link href="/"><span className="hover:text-foreground cursor-pointer">Home</span></Link>
          <Link href="/terms"><span className="hover:text-foreground cursor-pointer">Terms of Service</span></Link>
          <Link href="/support"><span className="hover:text-foreground cursor-pointer">Support</span></Link>
        </div>
      </div>
    </div>
  )
}
