/**
 * Copy system for variation engine.
 * Provides niche-specific content + family-tone-adjusted headlines/CTAs.
 */

// ── NICHE CONTENT (shared across families) ──────────────────────────────────

const nicheContent = {
  hvac: {
    nicheLabel: 'HVAC Service',
    emoji: '❄️',
    services: [
      { title: 'AC Repair & Installation', desc: 'Expert diagnosis and repair for all air conditioning systems. Same-day service available.' },
      { title: 'Furnace & Heating Repair', desc: 'Keep your home warm with fast, reliable furnace repair and replacement services.' },
      { title: 'Ductwork & Ventilation', desc: 'Complete duct cleaning, sealing, and installation for better airflow and efficiency.' },
      { title: 'Preventive Maintenance', desc: 'Annual tune-ups that extend equipment life and prevent costly emergency breakdowns.' },
      { title: 'Heat Pump Services', desc: 'Installation, repair, and maintenance for energy-efficient heat pump systems.' },
      { title: 'Indoor Air Quality', desc: 'Air purifiers, humidifiers, and filtration systems for cleaner, healthier indoor air.' },
    ],
    serviceOptions: ['AC Repair', 'AC Installation', 'Furnace Repair', 'Heating Installation', 'Duct Cleaning', 'Maintenance Plan', 'Heat Pump Service', 'Air Quality Assessment', 'Emergency Service', 'Other'],
    faqs: [
      { q: 'How quickly can you get to my home?', a: 'For emergencies, we typically dispatch a technician within 30-60 minutes. For scheduled service, we offer 2-hour arrival windows so you\'re not waiting around all day.' },
      { q: 'Do you offer financing?', a: 'Yes, we offer flexible financing options for larger installations. Apply in minutes with no impact to your credit score. Ask about our 0% APR promotions.' },
      { q: 'How often should I service my HVAC system?', a: 'We recommend professional maintenance at least twice per year — once before cooling season and once before heating season. This keeps efficiency high and prevents breakdowns.' },
      { q: 'What brands do you service?', a: 'We service all major brands including Carrier, Trane, Lennox, Rheem, Goodman, Daikin, and more. Our technicians are factory-trained on the latest equipment.' },
      { q: 'Are your technicians licensed and insured?', a: 'Every technician on our team is fully licensed, background-checked, drug-tested, and insured. Your home and family\'s safety is our top priority.' },
    ],
    quickReplies: ['Get a Quote', 'Schedule Service', 'Emergency Help', 'Pricing Info'],
  },
  plumbing: {
    nicheLabel: 'Plumbing Service',
    emoji: '🔧',
    services: [
      { title: 'Emergency Plumbing', desc: 'Burst pipes, overflows, and water emergencies handled 24/7 with rapid response times.' },
      { title: 'Drain Cleaning', desc: 'Professional drain clearing using hydro-jetting and camera inspection technology.' },
      { title: 'Water Heater Service', desc: 'Repair and replacement for tank and tankless water heaters. Same-day installation available.' },
      { title: 'Leak Detection & Repair', desc: 'Advanced leak detection with non-invasive technology. Fix leaks before they cause water damage.' },
      { title: 'Pipe Repair & Repiping', desc: 'From spot repairs to whole-house repiping. We work with copper, PEX, and all modern materials.' },
      { title: 'Fixture Installation', desc: 'Faucets, toilets, sinks, and shower systems installed with precision and backed by warranty.' },
    ],
    serviceOptions: ['Emergency Plumbing', 'Drain Cleaning', 'Water Heater Repair', 'Water Heater Installation', 'Leak Detection', 'Pipe Repair', 'Toilet Repair', 'Faucet Installation', 'Sewer Line Service', 'Other'],
    faqs: [
      { q: 'Do you handle emergencies?', a: 'Absolutely. We offer true 24/7 emergency plumbing service. Call us any time — nights, weekends, holidays — and we\'ll have a licensed plumber at your door fast.' },
      { q: 'How much does a service call cost?', a: 'Our service call fee is $89, which covers the trip and diagnosis. We provide an upfront quote before any work begins, so there are never surprises on your bill.' },
      { q: 'Do you offer warranties on your work?', a: 'Yes. Every repair comes with a minimum 1-year labor warranty. Major installations include extended warranties on both parts and labor.' },
      { q: 'Can you help with water damage?', a: 'We can stop the source of water damage and make emergency repairs. For restoration, we partner with trusted water damage specialists and can coordinate the referral.' },
      { q: 'What payment methods do you accept?', a: 'We accept all major credit cards, checks, and cash. We also offer financing for larger jobs with affordable monthly payments.' },
    ],
    quickReplies: ['Emergency Help', 'Get a Quote', 'Schedule Plumber', 'Pricing'],
  },
  roofing: {
    nicheLabel: 'Roofing Service',
    emoji: '🏠',
    services: [
      { title: 'Roof Repair', desc: 'Fast, reliable repairs for leaks, storm damage, missing shingles, and structural issues.' },
      { title: 'Full Roof Replacement', desc: 'Complete tear-off and installation with premium materials and workmanship warranty.' },
      { title: 'Storm Damage Restoration', desc: 'Hail, wind, and storm damage assessment. We work directly with your insurance company.' },
      { title: 'Free Roof Inspection', desc: 'Comprehensive inspection with detailed photo documentation and honest assessment.' },
      { title: 'Gutter Services', desc: 'Gutter installation, repair, and cleaning to protect your roof and foundation.' },
      { title: 'Commercial Roofing', desc: 'Flat roofs, TPO, EPDM, and metal roofing for commercial properties of all sizes.' },
    ],
    serviceOptions: ['Roof Repair', 'Roof Replacement', 'Storm Damage', 'Free Inspection', 'Gutter Service', 'Insurance Claim Help', 'Commercial Roofing', 'Skylight Installation', 'Ventilation', 'Other'],
    faqs: [
      { q: 'Do you offer free inspections?', a: 'Yes! Every inspection is completely free with no obligation. We provide a written report with photos so you can make an informed decision.' },
      { q: 'Do you work with insurance companies?', a: 'We handle insurance claims every day. We\'ll document the damage, meet with your adjuster, and help ensure you receive the full coverage you\'re entitled to.' },
      { q: 'How long does a roof replacement take?', a: 'Most residential roof replacements are completed in 1-3 days depending on size and complexity. We protect your landscaping and leave the site clean.' },
      { q: 'What roofing materials do you recommend?', a: 'It depends on your budget, climate, and aesthetic preferences. We install architectural shingles, metal roofing, tile, and flat roof systems. We\'ll help you choose the best option.' },
      { q: 'What warranties do you offer?', a: 'We offer a 10-year workmanship warranty on all installations, plus manufacturer warranties of 25-50 years depending on the material. Your investment is protected.' },
    ],
    quickReplies: ['Free Inspection', 'Get Estimate', 'Storm Damage Help', 'Insurance Claim'],
  },
};

// ── FAMILY-TONE HEADLINES + CTAS ────────────────────────────────────────────
// Each family × niche combo gets distinct copy tone

const familyCopy = {
  luxury: {
    hvac: {
      headline: 'Refined Home Comfort',
      headlineSub: 'Engineered for {city}',
      subline: 'Precision climate control for discerning homeowners. Quiet systems, flawless installation, and white-glove service — on your schedule.',
      cta1: 'Schedule a Consultation',
      cta2: 'Explore Our Services',
      whyTitle: 'The {biz} Standard',
      whySub: 'We believe comfort should be effortless. Every detail, handled.',
    },
    plumbing: {
      headline: 'Master Plumbing, Elevated',
      headlineSub: 'Serving {city} With Precision',
      subline: 'Expert craftsmanship meets modern technology. Licensed master plumbers delivering flawless work with zero disruption to your home.',
      cta1: 'Request a Consultation',
      cta2: 'View Our Work',
      whyTitle: 'The {biz} Difference',
      whySub: 'Precision, cleanliness, and lasting quality — in every job.',
    },
    roofing: {
      headline: 'Expertly Built. Beautifully Finished.',
      headlineSub: 'Premium Roofing in {city}',
      subline: 'Architectural roofing that protects your home and elevates its beauty. Premium materials, meticulous installation, and a lasting guarantee.',
      cta1: 'Book a Free Assessment',
      cta2: 'View Our Portfolio',
      whyTitle: 'Built to a Higher Standard',
      whySub: 'Your roof is the crown of your home. We treat it that way.',
    },
  },
  trust: {
    hvac: {
      headline: 'Your Neighborhood HVAC Team',
      headlineSub: 'Family-Owned in {city} Since Day One',
      subline: 'Three generations of honest service. We treat every home like our own — because your comfort is our family\'s legacy.',
      cta1: 'Call Us Today',
      cta2: 'Meet Our Team',
      whyTitle: 'Why {city} Families Trust Us',
      whySub: 'Real people. Real service. Real results — for over {years} years.',
    },
    plumbing: {
      headline: '{city}\'s Trusted Plumber',
      headlineSub: 'Honest Work, Fair Prices, Every Time',
      subline: 'We\'ve been the family plumber for thousands of {city} homes. Licensed, insured, and recommended by your neighbors.',
      cta1: 'Give Us a Call',
      cta2: 'Read Our Reviews',
      whyTitle: 'Why Families Choose {biz}',
      whySub: 'Trust is earned. We\'ve been earning it for {years} years.',
    },
    roofing: {
      headline: '{city}\'s Family Roofer',
      headlineSub: 'Protecting Homes for {years} Years',
      subline: 'From your first roof repair to a full replacement — we\'re the team your neighbors recommend. Honest, reliable, always.',
      cta1: 'Get a Free Estimate',
      cta2: 'See Our Reviews',
      whyTitle: 'A Name {city} Knows',
      whySub: 'Your home deserves a roofer who cares. That\'s us.',
    },
  },
  emergency: {
    hvac: {
      headline: 'HVAC Down?',
      headlineSub: 'We\'re on the Way — {city}',
      subline: 'Same-day repairs. No overtime fees. Licensed technicians dispatched in under 60 minutes. Available 24/7/365.',
      cta1: 'Get Emergency Service Now',
      cta2: 'Call {phone}',
      whyTitle: 'Fast. Reliable. Done Right.',
      whySub: 'When your system fails, every minute matters. We move fast.',
    },
    plumbing: {
      headline: 'Plumbing Emergency?',
      headlineSub: '{city} — We\'re Already Rolling',
      subline: 'Burst pipe? Sewage backup? Flooding? Our emergency plumbers are dispatched immediately. No overtime charges. Ever.',
      cta1: 'Get Help Now',
      cta2: 'Call {phone}',
      whyTitle: 'When Minutes Matter',
      whySub: 'We don\'t keep you waiting. Rapid response, 24/7.',
    },
    roofing: {
      headline: 'Storm Damage? Act Now.',
      headlineSub: 'Emergency Roofing — {city}',
      subline: 'Hail, wind, fallen trees — we respond immediately with tarping, emergency repair, and full insurance claim support. Call now.',
      cta1: 'Report Storm Damage',
      cta2: 'Call {phone}',
      whyTitle: 'Emergency Roof Response',
      whySub: 'Protect your home now. We handle the insurance later.',
    },
  },
  modern: {
    hvac: {
      headline: 'Smart Climate. Simple Service.',
      headlineSub: 'HVAC Solutions for {city}',
      subline: 'Book online. Track your technician. Get upfront pricing. Modern HVAC service designed around your schedule.',
      cta1: 'Book Online Now',
      cta2: 'View Services',
      whyTitle: 'HVAC, Modernized',
      whySub: 'No phone tag. No guessing. Just better service.',
    },
    plumbing: {
      headline: 'Plumbing Made Simple',
      headlineSub: 'Book. Track. Done. — {city}',
      subline: 'Online booking, real-time tech tracking, and upfront pricing. Plumbing service built for how you actually live.',
      cta1: 'Book a Plumber',
      cta2: 'See Services',
      whyTitle: 'Why {biz} Is Different',
      whySub: 'We rebuilt plumbing service from the ground up.',
    },
    roofing: {
      headline: 'Roof Intelligence',
      headlineSub: 'Data-Driven Roofing for {city}',
      subline: 'Drone inspections, satellite assessment, and transparent digital reports. Know exactly what your roof needs — before anyone climbs up.',
      cta1: 'Get a Digital Assessment',
      cta2: 'How It Works',
      whyTitle: 'Roofing, Reimagined',
      whySub: 'Technology meets craftsmanship. Better decisions, better roofs.',
    },
  },
  regional: {
    hvac: {
      headline: '#1 Rated HVAC in {city}',
      headlineSub: 'Serving the Entire {city} Metro',
      subline: '{jobs}+ jobs completed. {rating}-star on Google. Licensed, bonded, and trusted by more {city} homeowners than any other HVAC company.',
      cta1: 'Request Service',
      cta2: 'See Service Areas',
      whyTitle: '{city}\'s HVAC Leader',
      whySub: 'The numbers speak for themselves.',
    },
    plumbing: {
      headline: '{city}\'s Top-Rated Plumber',
      headlineSub: '{jobs}+ Jobs. {rating}-star Google Rating.',
      subline: 'More {city} homeowners trust us than any other plumber. See why we\'re the area\'s highest-rated plumbing service.',
      cta1: 'Schedule Service',
      cta2: 'View Service Area',
      whyTitle: 'The {city} Plumbing Authority',
      whySub: 'Proven by the numbers. Trusted by your neighbors.',
    },
    roofing: {
      headline: '{city}\'s Roofing Authority',
      headlineSub: '{jobs}+ Roofs. {rating}-star Rating.',
      subline: 'The most experienced roofing team in the {city} metro. Insurance-approved, BBB accredited, and backed by {years} years of local work.',
      cta1: 'Get Your Free Quote',
      cta2: 'See Our Coverage Area',
      whyTitle: 'Dominating {city} Roofing',
      whySub: 'Area-wide coverage. Unmatched reputation.',
    },
  },
  craft: {
    hvac: {
      headline: 'Climate Crafted',
      headlineSub: 'By {city}\'s Finest Technicians',
      subline: 'Every installation is a craft project. Custom ductwork, precision calibration, and systems designed for your home\'s unique needs.',
      cta1: 'Start Your Project',
      cta2: 'See Our Process',
      whyTitle: 'The Craft Behind Your Comfort',
      whySub: 'We don\'t just install systems — we engineer comfort.',
    },
    plumbing: {
      headline: 'Master Craft Plumbing',
      headlineSub: 'Built by Hand in {city}',
      subline: 'Where precision meets durability. Our master plumbers bring decades of trade expertise to every pipe, fixture, and connection.',
      cta1: 'Start a Project',
      cta2: 'View Our Craftsmanship',
      whyTitle: 'Trade Mastery, Every Job',
      whySub: 'Some things should still be done by hand. Plumbing is one.',
    },
    roofing: {
      headline: 'Roofing as Craft',
      headlineSub: '{city}\'s Detail-Obsessed Roofers',
      subline: 'Every ridge, valley, and flashing — installed with the precision of artisans. Premium materials meet decades of trade mastery.',
      cta1: 'View Our Projects',
      cta2: 'Request a Consultation',
      whyTitle: 'Obsessed with Detail',
      whySub: 'The difference is in the details you don\'t see.',
    },
  },
};

// ── TESTIMONIALS & STATS POOLS ──────────────────────────────────────────────

const testimonialSets = [
  [
    { name: 'Jennifer M.', text: 'Called at 9 PM with a burst pipe. They had someone here in 35 minutes. Incredible service.', rating: 5 },
    { name: 'Carlos R.', text: 'Upfront pricing, no surprises. The tech explained everything before starting. Will use again.', rating: 5 },
    { name: 'Sarah T.', text: 'They found the leak in 10 minutes that another company couldn\'t find in 2 hours.', rating: 5 },
  ],
  [
    { name: 'Mike D.', text: 'Professional from start to finish. They even cleaned up after the job. That\'s rare.', rating: 5 },
    { name: 'Lisa K.', text: 'Best service I\'ve had in 20 years of homeownership. Fair price, fast work, friendly crew.', rating: 5 },
    { name: 'James W.', text: 'They showed up on time, diagnosed the problem fast, and fixed it right. No upselling.', rating: 5 },
  ],
  [
    { name: 'Amanda P.', text: 'The technician was knowledgeable and patient — answered all my questions without rushing.', rating: 5 },
    { name: 'Robert H.', text: 'Emergency call on a Sunday and they still had someone here within an hour. Lifesavers.', rating: 5 },
    { name: 'Diana L.', text: 'Finally found a company I trust. They\'ve done 3 jobs for us now and every one was perfect.', rating: 5 },
  ],
  [
    { name: 'Kevin S.', text: 'Scheduled a tune-up and the tech found a small issue before it became a big one. Saved us hundreds.', rating: 5 },
    { name: 'Patricia N.', text: 'The whole process was seamless. From the phone call to the finished job — about 3 hours total.', rating: 5 },
    { name: 'Thomas B.', text: 'I\'ve recommended them to 4 neighbors now. Every single one has thanked me.', rating: 5 },
  ],
  [
    { name: 'Rachel G.', text: 'Transparent pricing, great communication, and the work was done perfectly. Five stars isn\'t enough.', rating: 5 },
    { name: 'Steve M.', text: 'They went above and beyond. Found an issue I didn\'t even know about and fixed it at no extra charge.', rating: 5 },
    { name: 'Nancy C.', text: 'Fast, clean, professional. They treated our home with respect. Will absolutely call again.', rating: 5 },
  ],
];

const statsSets = [
  { avgResponse: '42', jobs: '1,247', rating: '4.9', years: '12' },
  { avgResponse: '35', jobs: '2,100', rating: '4.8', years: '18' },
  { avgResponse: '28', jobs: '890', rating: '5.0', years: '8' },
  { avgResponse: '50', jobs: '3,400', rating: '4.9', years: '22' },
  { avgResponse: '30', jobs: '1,580', rating: '4.7', years: '15' },
  { avgResponse: '45', jobs: '640', rating: '5.0', years: '6' },
];

const whyUsSets = [
  [
    { title: 'Same-Day Response', desc: 'On-site in 30–60 minutes for emergencies. Scheduled visits within 2-hour windows.' },
    { title: 'Upfront Pricing', desc: 'You\'ll know the exact cost before any work begins. No surprises, no hidden fees.' },
    { title: 'Licensed Experts', desc: 'Every technician is fully certified, background-checked, and insured.' },
    { title: 'Satisfaction Guaranteed', desc: 'Not happy? We\'ll make it right — that\'s our promise to every customer.' },
  ],
  [
    { title: 'Fast Dispatch', desc: 'Technicians ready to roll, often at your door in under an hour. 24/7 availability.' },
    { title: 'No Hidden Fees', desc: 'We quote the price before we start. What we say is what you pay. Period.' },
    { title: 'Background-Checked', desc: 'Every team member passes a background check and drug test. Your safety matters.' },
    { title: '5-Star Reviews', desc: 'Hundreds of 5-star reviews from real homeowners. See why they keep calling us back.' },
  ],
  [
    { title: '24/7 Availability', desc: 'Emergencies don\'t wait for business hours. Neither do we. Call anytime.' },
    { title: 'Transparent Quotes', desc: 'No surprise bills. We walk you through the pricing before a single tool comes out.' },
    { title: 'Trained & Certified', desc: 'Our team trains continuously on the latest equipment and techniques.' },
    { title: 'Warranty on All Work', desc: 'Every job comes with a warranty. If something\'s not right, we fix it — free.' },
  ],
  [
    { title: 'Rapid Response', desc: 'We respect your time. Narrow arrival windows, on-time techs, and quick diagnostics.' },
    { title: 'Fair, Honest Pricing', desc: 'We\'ll never recommend work you don\'t need. Competitive and transparent pricing.' },
    { title: 'Fully Insured', desc: 'Licensed, bonded, and fully insured. Your home and property are protected.' },
    { title: 'Family-Owned', desc: 'We treat every home like our own. That\'s the family business difference.' },
  ],
];

// ── PUBLIC API ───────────────────────────────────────────────────────────────

const { hashStr, pick } = require('./utils');

function getCopy(familyName, niche, lead) {
  const seed = hashStr(lead.business_name + (lead.city || ''));
  const base = nicheContent[niche] || nicheContent.hvac;
  const tone = (familyCopy[familyName] || familyCopy.modern)[niche] || familyCopy.modern.hvac;
  const stats = pick(statsSets, seed);
  const testimonials = pick(testimonialSets, seed + 1);
  const whyUs = pick(whyUsSets, seed + 2);

  const city = lead.city || 'Your City';
  const biz = lead.business_name;
  const phone = lead.phone || '(555) 000-0000';

  function r(s) {
    return s.replace(/\{city\}/g, city)
      .replace(/\{biz\}/g, biz)
      .replace(/\{phone\}/g, phone)
      .replace(/\{years\}/g, stats.years)
      .replace(/\{jobs\}/g, stats.jobs)
      .replace(/\{rating\}/g, stats.rating);
  }

  return {
    ...base,
    headline: r(tone.headline),
    headlineSub: r(tone.headlineSub),
    subline: r(tone.subline),
    cta1: r(tone.cta1),
    cta2: r(tone.cta2),
    whyTitle: r(tone.whyTitle),
    whySub: r(tone.whySub),
    stats,
    testimonials,
    whyUs,
  };
}

module.exports = { getCopy, nicheContent, familyCopy, testimonialSets, statsSets, whyUsSets };
