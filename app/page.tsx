"use client";

import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import DemoSection from "@/components/landing/DemoSection";
import ROICalculator from "@/components/landing/ROICalculator";
import IndustrySection from "@/components/landing/IndustrySection";
import PricingSection from "@/components/landing/PricingSection";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import FAQSection from "@/components/landing/FAQSection";
import FinalCTA from "@/components/landing/FinalCTA";
import Footer from "@/components/landing/Footer";

export default function LatchlyLanding() {
  return (
    <div className="font-sans bg-white text-slate-800 overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <DemoSection />
      <ROICalculator />
      <IndustrySection />
      <PricingSection />
      <TestimonialsSection />
      <FAQSection />
      <FinalCTA />
      <Footer />
    </div>
  );
}
