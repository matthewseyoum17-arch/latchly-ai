import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Latchly",
  description: "Latchly terms of service. Subscription terms, usage policies, and legal information.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-5 py-20">
        <Link href="/" className="text-sm text-brand font-semibold hover:underline mb-8 inline-block">
          &larr; Back to Home
        </Link>
        <h1 className="font-display text-4xl font-black tracking-tight text-slate-900 mb-2">
          Terms of Service
        </h1>
        <p className="text-sm text-slate-400 mb-10">Last updated: March 21, 2026</p>

        <div className="prose prose-slate prose-sm max-w-none [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-4 [&_p]:leading-relaxed [&_p]:text-slate-600 [&_li]:text-slate-600">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using Latchly (&ldquo;the Service&rdquo;), you agree to these Terms of Service. If you do not agree, do not use the Service.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            Latchly provides an AI-powered chat widget for websites that answers visitor questions, captures lead information, and facilitates appointment booking. The Service includes a dashboard for managing leads and widget configuration.
          </p>

          <h2>3. Subscriptions & Billing</h2>
          <ul>
            <li>Subscriptions are billed monthly or annually via Stripe.</li>
            <li>A one-time setup fee of $400 applies to all new accounts and covers implementation and onboarding.</li>
            <li>New accounts include a 14-day free trial. You will not be charged until the trial ends.</li>
            <li>You may cancel at any time. Cancellation takes effect at the end of your current billing period. No refunds for partial months.</li>
          </ul>

          <h2>4. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service for illegal, fraudulent, or deceptive purposes.</li>
            <li>Attempt to reverse-engineer, copy, or resell the Service.</li>
            <li>Overload or disrupt the Service infrastructure.</li>
            <li>Upload malicious content or code through the chat widget.</li>
          </ul>

          <h2>5. Your Content & Data</h2>
          <p>
            You retain ownership of your business content (knowledge base, branding, lead data). You grant Latchly a limited license to use this content solely to provide the Service. We will not use your data for purposes unrelated to your account.
          </p>

          <h2>6. AI-Generated Responses</h2>
          <p>
            Latchly uses AI to generate responses based on the business information you provide. While we strive for accuracy, AI responses may occasionally be imperfect. You are responsible for reviewing and updating the knowledge base to ensure accuracy. Latchly is not liable for decisions made by visitors based on AI responses.
          </p>

          <h2>7. Availability & Support</h2>
          <p>
            We target 99.9% uptime but do not guarantee uninterrupted service. Scheduled maintenance will be communicated in advance. Support is available via email (matt@latchlyai.com) during business hours (Mon–Fri, 9am–6pm ET).
          </p>

          <h2>8. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, Latchly&apos;s total liability is limited to the amount you paid in the 12 months preceding the claim. We are not liable for indirect, incidental, or consequential damages.
          </p>

          <h2>9. Termination</h2>
          <p>
            We may suspend or terminate your account for violation of these terms, non-payment, or extended inactivity (12+ months). Upon termination, your data will be retained for 90 days before deletion.
          </p>

          <h2>10. Changes to Terms</h2>
          <p>
            We may update these terms. Material changes will be communicated 30 days in advance via email. Continued use after changes constitutes acceptance.
          </p>

          <h2>11. Governing Law</h2>
          <p>
            These terms are governed by the laws of the State of Florida. Any disputes will be resolved in the courts of Alachua County, Florida.
          </p>

          <h2>12. Contact</h2>
          <p>
            Questions about these terms? Contact us at{" "}
            <a href="mailto:matt@latchlyai.com" className="text-brand hover:underline">matt@latchlyai.com</a>.
          </p>
          <p>Latchly &middot; Gainesville, FL</p>
        </div>
      </div>
    </div>
  );
}
