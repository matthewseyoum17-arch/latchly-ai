import './globals.css';

export const metadata = {
  title: 'Latchly — Your Site Never Sleeps',
  description: 'A 24/7 AI website assistant that answers questions, captures leads, and sends real customers to your phone — even when you\'re closed.',
  metadataBase: new URL('https://latchly-ai.vercel.app'),
  openGraph: {
    title: 'Latchly — Your Site Never Sleeps',
    description: 'A 24/7 AI website assistant that answers questions, captures leads, and sends real customers to your phone — even when you\'re closed.',
    type: 'website',
    url: 'https://latchly-ai.vercel.app',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Latchly — Your Site Never Sleeps',
    description: 'A 24/7 AI website assistant that answers questions, captures leads, and sends real customers to your phone — even when you\'re closed.',
  },
  alternates: {
    canonical: 'https://latchly-ai.vercel.app',
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "How does the AI know about my specific business?", "acceptedAnswer": { "@type": "Answer", "text": "During setup, you provide your business details — services, pricing, hours, FAQs, and service areas. The AI uses this custom knowledge base to answer questions accurately. We also have pre-built templates for 20+ industries." }},
    { "@type": "Question", "name": "Will this slow down my website?", "acceptedAnswer": { "@type": "Answer", "text": "Not at all. The chat widget loads asynchronously and weighs under 50KB. Zero impact on page load speed and Core Web Vitals." }},
    { "@type": "Question", "name": "What happens if the AI can't answer a question?", "acceptedAnswer": { "@type": "Answer", "text": "The AI gracefully escalates — click-to-call, callback requests, or collecting visitor info for your team to follow up." }},
    { "@type": "Question", "name": "Do I need to change my existing website?", "acceptedAnswer": { "@type": "Answer", "text": "No. One line of embed code — like adding Google Analytics. Works on WordPress, Squarespace, Wix, Shopify, and any platform." }},
    { "@type": "Question", "name": "How are leads delivered to me?", "acceptedAnswer": { "@type": "Answer", "text": "Email, SMS, or both. Every notification includes the full conversation transcript. You can also view everything in your dashboard." }},
    { "@type": "Question", "name": "Is this compliant with privacy regulations?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Privacy notices, consent checkboxes, no payment info stored. Conversation data encrypted and used only for service improvement." }},
    { "@type": "Question", "name": "Can I customize the look and feel?", "acceptedAnswer": { "@type": "Answer", "text": "Absolutely. Brand colors, logo, greeting message, quick-reply buttons. The widget feels like part of your website." }},
    { "@type": "Question", "name": "What industries does this work for?", "acceptedAnswer": { "@type": "Answer", "text": "Any service-based business. We have presets for dental, med spa, HVAC, plumbing, legal, real estate, auto repair, salons, fitness, and more." }},
  ]
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Syne:wght@700;800&display=swap" rel="stylesheet" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
