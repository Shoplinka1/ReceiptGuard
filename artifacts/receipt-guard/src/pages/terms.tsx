import { Link } from 'wouter'
import { Button } from '@/components/ui/button'

const LAST_UPDATED = 'July 4, 2026'

export default function TermsPage() {
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

      <div className="max-w-3xl mx-auto px-6 py-14">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground text-sm mb-10">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By creating an account or using ReceiptGuard, you agree to these Terms of Service. If you do not agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">2. Description of Service</h2>
            <p className="text-muted-foreground">
              ReceiptGuard is a personal finance tool that helps you track receipts, subscriptions, warranties, and renewal dates by scanning your Gmail inbox (with your permission) and providing reminders and analytics.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">3. Account Responsibilities</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You must provide accurate information when creating an account.</li>
              <li>You must be at least 13 years of age to use ReceiptGuard.</li>
              <li>You are responsible for all activity that occurs under your account.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">4. Gmail Access</h2>
            <p className="text-muted-foreground">
              When you connect a Gmail account, you grant ReceiptGuard read-only access to scan emails for receipts and purchase information. You may revoke this access at any time. ReceiptGuard will not read, store, or share personal conversations or emails unrelated to purchases.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">5. Subscription and Payment</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>ReceiptGuard offers a free tier and a paid Pro tier ($9.99/month or $99.99/year).</li>
              <li>Payments are processed by Paystack. By subscribing, you agree to Paystack's Terms of Service.</li>
              <li>Pro subscriptions renew automatically at the end of each billing period unless cancelled.</li>
              <li>You may cancel at any time. Access continues until the end of the current billing period.</li>
              <li>If payment fails, your account is automatically downgraded to the Free plan.</li>
              <li>All prices are displayed in USD.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">6. Free Plan Limits</h2>
            <p className="text-muted-foreground">
              Free plan users are limited to 1 connected Gmail account, 50 stored receipts, and 5 active subscriptions. These limits are enforced automatically. Upgrading to Pro removes all limits.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">7. Acceptable Use</h2>
            <p className="text-muted-foreground">You agree not to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-muted-foreground">
              <li>Use ReceiptGuard for any unlawful purpose.</li>
              <li>Attempt to reverse-engineer or circumvent the service.</li>
              <li>Interfere with the service or its infrastructure.</li>
              <li>Share your account with others.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">8. Disclaimers</h2>
            <p className="text-muted-foreground">
              ReceiptGuard is provided "as is" without warranties of any kind. Receipt parsing and subscription detection are automated and may not always be accurate. ReceiptGuard is not a financial advisor and the data shown should not be relied upon for financial decisions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">9. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              To the maximum extent permitted by law, ReceiptGuard shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">10. Changes to Terms</h2>
            <p className="text-muted-foreground">
              We may update these terms from time to time. Continued use of the service after changes constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">11. Contact</h2>
            <p className="text-muted-foreground">
              For questions about these terms, contact us via the <Link href="/support" className="text-primary underline">Support page</Link>.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border text-xs text-muted-foreground flex flex-wrap gap-4">
          <Link href="/"><span className="hover:text-foreground cursor-pointer">Home</span></Link>
          <Link href="/privacy"><span className="hover:text-foreground cursor-pointer">Privacy Policy</span></Link>
          <Link href="/support"><span className="hover:text-foreground cursor-pointer">Support</span></Link>
        </div>
      </div>
    </div>
  )
}
