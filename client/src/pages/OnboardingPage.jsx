import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckIcon, ArrowRightIcon, SparklesIcon, HashtagIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

const CATEGORIES = [
  "All Topics",
  "Politics",
  "Technology",
  "Economy",
  "Environment",
  "World Affairs",
  "Science",
  "Health",
  "Culture",
  "Sports",
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedInterests, setSelectedInterests] = useState([]);

  // Lock body scrolling when onboarding mounts
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  const toggleInterest = (interest) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const nextStep = () => {
    if (step === 1) {
      if (selectedInterests.length >= 4) {
        localStorage.setItem("selectedInterests", JSON.stringify(selectedInterests));
        setStep(2);
      }
    } else {
      navigate("/home");
    }
  };

  return (
    <div className="h-screen w-screen bg-[#f5f4ef] flex flex-col justify-between items-center p-4 md:p-6 overflow-hidden select-none">
      <div className="max-w-2xl w-full h-full flex flex-col justify-between py-2 md:py-4">
        
        {/* Progress bar */}
        <div className="flex gap-2 max-w-[200px] w-full mx-auto mb-4 shrink-0">
          {[1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-all duration-500",
                step >= i ? "bg-primary" : "bg-primary/10"
              )}
            />
          ))}
        </div>

        {/* Step Contents */}
        <div className="flex-1 flex flex-col justify-center min-h-0 my-3">
          {step === 1 ? (
            <div className="space-y-6 text-center animate-in fade-in slide-in-from-bottom duration-300 flex flex-col justify-center h-full min-h-0">
              <div className="space-y-2 shrink-0">
                <h1
                  className="text-2xl md:text-3xl font-black text-[#0d0d0d] tracking-tight"
                  style={{
                    fontFamily: "'Playfair Display', serif",
                  }}
                >
                  What topics move you?
                </h1>
                <p
                  className="text-[#888880] text-sm md:text-base max-w-md mx-auto"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  {selectedInterests.length < 4
                    ? `Please select at least ${4 - selectedInterests.length} more topic${selectedInterests.length === 3 ? "" : "s"} to personalize your feed.`
                    : "Excellent choice. You can now click continue."}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4 overflow-y-auto max-h-[50vh] pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {CATEGORIES.filter((c) => c !== "All Topics").map((cat) => (
                  <button
                    key={cat}
                    onClick={() => toggleInterest(cat)}
                    className={cn(
                      "relative p-3 rounded-2xl border-2 transition-all duration-300 text-left group cursor-pointer",
                      selectedInterests.includes(cat)
                        ? "bg-white border-primary shadow-lg shadow-primary/5"
                        : "bg-white/50 border-black/[0.04] hover:border-black/[0.1] hover:bg-white"
                    )}
                  >
                    <div className="flex flex-col gap-2">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0",
                          selectedInterests.includes(cat)
                            ? "bg-primary/10 text-primary"
                            : "bg-black/5 text-[#888880]"
                        )}
                      >
                        <HashtagIcon className="w-4 h-4" />
                      </div>
                      <span
                        className={cn(
                          "text-xs md:text-sm font-bold tracking-tight transition-colors truncate",
                          selectedInterests.includes(cat)
                            ? "text-[#0d0d0d]"
                            : "text-[#888880]"
                        )}
                      >
                        {cat}
                      </span>
                    </div>
                    {selectedInterests.includes(cat) && (
                      <div className="absolute top-2.5 right-2.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center text-white">
                        <CheckIcon className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 text-center animate-in fade-in slide-in-from-right duration-300 flex flex-col justify-center h-full min-h-0">
              <div className="space-y-2 shrink-0">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-2 shrink-0">
                  <SparklesIcon className="w-6 h-6" />
                </div>
                <h1
                  className="text-2xl md:text-3xl font-black text-[#0d0d0d] tracking-tight"
                  style={{
                    fontFamily: "'Playfair Display', serif",
                  }}
                >
                  You're all set.
                </h1>
                <p
                  className="text-[#888880] text-sm md:text-base max-w-md mx-auto"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  We've curated a few conversations based on your interests. Dive
                  in and start debating.
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-black/[0.04] p-4 md:p-5 space-y-3 text-left mt-2 max-w-md mx-auto w-full overflow-y-auto max-h-[45vh] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <h3
                  className="text-[9px] font-black text-primary uppercase tracking-[0.2em]"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Personalized Preview
                </h3>
                <div className="space-y-2">
                  {selectedInterests.slice(0, 3).map((interest, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-xl bg-[#f9fafb] border border-black/[0.02]"
                    >
                      <div className="w-8 h-8 bg-white rounded-lg border border-black/[0.05] flex items-center justify-center text-[#0d0d0d] font-bold text-xs shrink-0">
                        {interest[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[#0d0d0d] truncate">
                          Top Discussion in {interest}
                        </p>
                        <p className="text-[10px] text-[#888880] truncate">
                          Join 1.2k participants debating now
                        </p>
                      </div>
                       <ArrowRightIcon className="w-3.5 h-3.5 text-[#888880] shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-black/[0.04] shrink-0">
          <Button
            variant="ghost"
            onClick={() => (step > 1 ? setStep(step - 1) : navigate(-1))}
            className="text-[#888880] hover:text-[#0d0d0d] font-bold cursor-pointer"
          >
            {step === 1 ? "Back to sign in" : "Back"}
          </Button>
          <Button
            onClick={nextStep}
            disabled={step === 1 && selectedInterests.length < 4}
            className="rounded-full px-8 h-14 font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20 cursor-pointer animate-pulse"
          >
            {step === 1 ? "Continue" : "Enter Network"}{" "}
            <ArrowRightIcon className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
export default OnboardingPage;