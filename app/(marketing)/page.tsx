import { Hero } from "@/components/marketing/hero";
import { LogoRail } from "@/components/marketing/logo-rail";
import { FeatureRouting } from "@/components/marketing/feature-routing";
import { FeatureCompliance } from "@/components/marketing/feature-compliance";
import { Capabilities } from "@/components/marketing/capabilities";
import { Showcase } from "@/components/marketing/showcase";
import { Developers } from "@/components/marketing/developers";
import { Cta } from "@/components/marketing/cta";

export default function HomePage() {
  return (
    <>
      <Hero />
      <LogoRail />
      <FeatureRouting />
      <FeatureCompliance />
      <Capabilities />
      <Showcase />
      <Developers />
      <Cta />
    </>
  );
}
