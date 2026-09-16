import { HeroSection } from "@/components/marketing/hero-section";
import { LogoCloud } from "@/components/marketing/logo-cloud";
import { BentoGrid } from "@/components/marketing/bento-grid";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { TerminalDemo } from "@/components/marketing/terminal-demo";
import { Pricing } from "@/components/marketing/pricing";
import { Testimonials } from "@/components/marketing/testimonials";
import { Comparison } from "@/components/marketing/comparison";
import { FAQ } from "@/components/marketing/faq";
import { FinalCTA } from "@/components/marketing/final-cta";

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <LogoCloud />
      <BentoGrid />
      <HowItWorks />
      <TerminalDemo />
      <Testimonials />
      <Comparison />
      <Pricing />
      <FAQ />
      <FinalCTA />
    </>
  );
}
