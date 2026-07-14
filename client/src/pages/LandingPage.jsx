import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LandingNavbar } from "@/components/features/landing/LandingNavbar";
import { LandingHero } from "@/components/features/landing/LandingHero";
import { LandingAtlas } from "@/components/features/landing/LandingAtlas";
import { LandingDebate } from "@/components/features/landing/LandingDebate";
import { LandingCTA } from "@/components/features/landing/LandingCTA";
import { LandingFooter } from "@/components/features/landing/LandingFooter";

export function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/home", { replace: true });
    }
  }, [user, navigate]);

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      <LandingNavbar />
      <LandingHero />
      <LandingAtlas />
      <LandingDebate />
      <LandingCTA />
      <LandingFooter />
    </div>
  );
}
export default LandingPage;
