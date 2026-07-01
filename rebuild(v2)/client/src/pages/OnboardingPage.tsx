import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, ArrowRight, Sparkles, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';

const CATEGORIES = ['All Topics', 'Politics', 'Technology', 'Economy', 'Environment', 'World Affairs', 'Science', 'Health', 'Culture', 'Sports'];

export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const nextStep = () => {
    if (step < 2) setStep(step + 1);
    else navigate('/home');
  };

  return (
    <div className="min-h-screen bg-[#f5f4ef] flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-12">
        {/* Progress bar */}
        <div className="flex gap-2 max-w-[200px] mx-auto">
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

        {step === 1 ? (
          <div className="space-y-10 text-center animate-in fade-in slide-in-from-bottom duration-300">
            <div className="space-y-4">
              <h1
                className="text-4xl md:text-5xl text-[#0d0d0d] tracking-tight"
                style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900 }}
              >
                What topics move you?
              </h1>
              <p
                className="text-[#888880] text-lg max-w-md mx-auto"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                Select your interests to personalize your conversation feed and discover your first communities.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {CATEGORIES.filter(c => c !== 'All Topics').map((cat) => (
                <button
                  key={cat}
                  onClick={() => toggleInterest(cat)}
                  className={cn(
                    "relative p-4 rounded-2xl border-2 transition-all duration-300 text-left group cursor-pointer",
                    selectedInterests.includes(cat)
                      ? "bg-white border-primary shadow-lg shadow-primary/5"
                      : "bg-white/50 border-black/[0.04] hover:border-black/[0.1] hover:bg-white"
                  )}
                >
                  <div className="flex flex-col gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                      selectedInterests.includes(cat) ? "bg-primary/10 text-primary" : "bg-black/5 text-[#888880]"
                    )}>
                      <Hash size={20} />
                    </div>
                    <span
                      className={cn(
                        "text-sm font-bold tracking-tight transition-colors",
                        selectedInterests.includes(cat) ? "text-[#0d0d0d]" : "text-[#888880]"
                      )}
                    >
                      {cat}
                    </span>
                  </div>
                  {selectedInterests.includes(cat) && (
                    <div className="absolute top-3 right-3 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-white">
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-10 text-center animate-in fade-in slide-in-from-right duration-300">
            <div className="space-y-4">
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Sparkles size={32} />
              </div>
              <h1
                className="text-4xl md:text-5xl text-[#0d0d0d] tracking-tight"
                style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900 }}
              >
                You're all set.
              </h1>
              <p
                className="text-[#888880] text-lg max-w-md mx-auto"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                We've curated a few conversations based on your interests. Dive in and start debating.
              </p>
            </div>

            <div className="bg-white rounded-3xl border border-black/[0.04] p-8 space-y-6 text-left">
               <h3
                className="text-[11px] font-black text-primary uppercase tracking-[0.2em]"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Personalized Preview
              </h3>
              <div className="space-y-4">
                {selectedInterests.slice(0, 3).map((interest, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-[#f9fafb] border border-black/[0.02]">
                    <div className="w-10 h-10 bg-white rounded-xl border border-black/[0.05] flex items-center justify-center text-[#0d0d0d] font-bold">
                      {interest[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-[#0d0d0d]">Top Discussion in {interest}</p>
                      <p className="text-xs text-[#888880]">Join 1.2k participants debating now</p>
                    </div>
                    <ArrowRight size={16} className="text-[#888880]" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-8 border-t border-black/[0.04]">
          <Button
            variant="ghost"
            onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)}
            className="text-[#888880] hover:text-[#0d0d0d] font-bold cursor-pointer"
          >
            {step === 1 ? 'Back to sign in' : 'Back'}
          </Button>
          <Button
            onClick={nextStep}
            disabled={step === 1 && selectedInterests.length === 0}
            className="rounded-full px-8 h-14 font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20 cursor-pointer animate-pulse"
          >
            {step === 1 ? 'Continue' : 'Enter Network'} <ArrowRight size={16} className="ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
export default OnboardingPage;
