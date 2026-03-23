import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Latchly",
  description: "Latchly privacy policy. How we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-5 py-20">
        <Link href="/" className="text-sm text-brand font-semibold hover:underline mb-8 inline-block">
          &larr; Back to Home
        </Link>
        <h1 className="font-display text-4xl font-black tracking-tight text-slate-900 mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-slate-400 mb-10">Last updated: March 21, 2026</p>

        <div className="prose prose-slate prose-sm max-w-none [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-4 [&_p]:leading-relaxed [&_p]:text-slate-600 [&_li]:text-slate-600">
          <h2>1. Information We Collect</h2>
          <p>
            When you use Latchly (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;), we collect the following types of information:
          </p>
          <ul>
            <li><strong>Account information:</strong> Name, email address, business name, and billing details when you sign up.</li>
            <li><strong>Chat data:</strong> Conversations between your website visitors and the Latchly AI assistant, including visitor-provided contact details (name, phone, email).</li>
            <li><strong>Usage data:</strong> Page views, feature usage, and performance metrics to improve our service.</li>
            <li><strong>Cookies:</strong> We use essential cookies for authentication and optional analytics cookies (you can opt out).</li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <ul>
            <li>To provide, maintain, and improve the Latchly service.</li>
            <li>To send lead notifications (email or SMS) when visitors interact with your chat widget.</li>
            <li>To process payments via Stripe (we never store card numbers directly).</li>
            <li>To send service updates and respond to support requests.</li>
          </ul>

          <h2>3. Data Sharing</h2>
          <p>We do not sell your data. We share information only with:</p>
          <ul>
            <li><strong>Service providers:</strong> Stripe (payments), Resend (email delivery), Anthropic (AI processing), Vercel (hosting).</li>
            <li><strong>Legal requirements:</strong> When required by law or to protect our rights.</li>
          </ul>

          <h2>4. Data Security</h2>
          <p>
            All data is encrypted in transit (TLS) and at rest. Conversation data is stored in secure PostgreSQL databases with access controls. We conduct regular security reviews.
          </p>

          <h2>5. Data Retention</h2>
          <p>
            Chat transcripts and lead data are retained for the duration of your subscription plus 90 days. You can request deletion of your data at any time by contacting us.
          </p>

          <h2>6. Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li>Access, correct, or delete your personal data.</li>
            <li>Export your data in a standard format.</li>
            <li>Opt out of marketing communications.</li>
            <li>Request we stop processing your data (subject to contractual obligations).</li>
          </ul>

          <h2>7. California Residents (CCPA)</h2>
          <p>
            California residents have additional rights under the CCPA, including the right to know what personal information we collect and the right to request deletion. We do not sell personal information.
          </p>

          <h2>8. Children&apos;s Privacy</h2>
          <p>
            Latchly is not directed to children under 13. We do not knowingly collect personal information from children.
          </p>

          <h2>9. Changes to This Policy</h2>
          <p>
            We may update this policy from time to time. Material changes will be communicated via email or a notice on our website.
          </p>

          <h2>10. Contact Us</h2>
          <p>
            For privacy questions or data requests, contact us at{" "}
            <a href="mailto:matt@latchlyai.com" className="text-brand hover:underline">matt@latchlyai.com</a>.
          </p>
          <p>Latchly &middot; Gainesville, FL</p>
        </div>
      </div>
    </div>
  );
}
