"use client";

import { useEffect, useState, useRef } from "react";

import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import DemoSection from "@/components/landing/DemoSection";
import ROICalculator from "@/components/landing/ROICalculator";
import IndustrySection from "@/components/landing/IndustrySection";
import PricingSection from "@/components/landing/PricingSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import FAQSection from "@/components/landing/FAQSection";
import LeadCaptureSection from "@/components/landing/LeadCaptureSection";
import FinalCTA from "@/components/landing/FinalCTA";
import Footer from "@/components/landing/Footer";
import ChatWidget from "@/components/chat/ChatWidget";

export default function LatchlyLanding() {
  const [mounted, setMounted] = useState(false);
  const scrollPosRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Aggressive scroll reset
    history.scrollRestoration = "manual";
    scrollPosRef.current = 0;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    // Prevent any scroll events during initial load
    const preventScroll = (e: Event) => {
      if (window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
    };
    
    window.addEventListener("scroll", preventScroll, { passive: true });
    
    // Remove the listener after a short delay
    const timeout = setTimeout(() => {
      window.removeEventListener("scroll", preventScroll);
      setMounted(true);
    }, 500);
    
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("scroll", preventScroll);
    };
  }, []);
  return (
    <div className="font-sans bg-surface-warm text-slate-800 overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <DemoSection />
      <ROICalculator />
      <IndustrySection />
      <LeadCaptureSection />
      <PricingSection />
      <HowItWorksSection />
      <FAQSection />
      <FinalCTA />
      <Footer />

      {/* Global floating chat widget */}
      <ChatWidget
        config={{
          brandColor: "#0e7c6b",
          businessName: "Dental Office Demo",
          businessType: "dental",
          plan: "team",
          calendlyUrl: "https://calendly.com/latchly/setup",
          hours: {
            "mon-fri": "8am-6pm",
            sat: "9am-2pm",
            sun: "closed",
          },
          nudgeDelay: 5000,
        }}
      />
    </div>
  );
}
