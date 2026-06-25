import { LandingNavbar } from "@/components/features/landing/LandingNavbar";
import { LandingHero } from "@/components/features/landing/LandingHero";
import { LandingAtlas } from "@/components/features/landing/LandingAtlas";
import { LandingDebate } from "@/components/features/landing/LandingDebate";
import { LandingCommunityGrid } from "@/components/features/landing/LandingCommunityGrid";
import { LandingCTA } from "@/components/features/landing/LandingCTA";
import { LandingFooter } from "@/components/features/landing/LandingFooter";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      <LandingNavbar />
      <LandingHero />
      <LandingAtlas />
      <LandingDebate />
      <LandingCommunityGrid />
      <LandingCTA />
      <LandingFooter />
    </div>
  );
}
