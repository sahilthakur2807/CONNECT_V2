import { useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import { useAuth } from "@/hooks/use-auth";

export function LandingCTA() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { user } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      if (user) {
        window.location.href = "/home";
      } else if (email) {
        window.location.href = `/auth?mode=register&email=${encodeURIComponent(email)}`;
      } else {
        window.location.href = "/auth?mode=register";
      }
    }, 1000);
  };

  return (
    <section ref={ref} className="bg-[#0d0d0d] py-28 overflow-hidden relative">
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 60% at 50% 50%, #d42b2b14 0%, transparent 70%)" }}
      />

      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div>
            <motion.h2
              initial={{ opacity: 0, y: 32 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
              className="leading-[0.95] mb-8"
              style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(44px, 7vw, 90px)", fontWeight: 900 }}
            >
              <span className="text-[#f0ede6]">The internet has plenty of</span>{" "}
              <span className="text-[#f0ede6]">noise.</span>
              <br />
              <span style={{ color: "#d42b2b", fontStyle: "italic" }}>Bring us your questions.</span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.35 }}
              className="text-[#555550] max-w-xl"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "16.25px", lineHeight: 1.7 }}
            >
              No algorithms ranking your worth. No quote-tweet dunks. Just thousands of
              minds, all over the world, where someone is asking the same thing you are
              — but better.
            </motion.p>
          </div>

          {/* Right — signup */}
          <motion.div
            initial={{ opacity: 0, x: 32 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          >
            <div
              className="bg-[#161616] border border-white/[0.08] p-10"
              style={{ borderRadius: "4px" }}
            >
              <div
                className="text-[#888880] mb-8 uppercase"
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "15.625px", letterSpacing: "0.14em" }}
              >
                Become one of us 
              </div>

              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-8"
                >
                  <div
                    className="text-[#d42b2b] mb-3 text-3xl"
                    style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic" }}
                  >
                    You're in.
                  </div>
                  <p
                    className="text-[#555550]"
                    style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "15px", lineHeight: 1.6 }}
                  >
                    We'll find the corner of the network made for you.
                  </p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <input
                    type="email"
                    placeholder="you@thinking.org"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#0d0d0d] border border-white/[0.12] text-[#f0ede6] px-5 py-4 outline-none focus:border-[#d42b2b] transition-colors duration-200 placeholder:text-[#333330]"
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "16.25px",
                      borderRadius: "2px",
                    }}
                  />
                  <button
                    type="submit"
                    className="w-full bg-[#d42b2b] hover:bg-[#b82020] text-[#f0ede6] py-4 transition-all duration-200 hover:scale-[0.99] active:scale-95 flex items-center justify-center gap-2"
                    style={{
                      fontFamily: "'Hedvig Letters Serif', serif",
                      fontSize: "15px",
                      letterSpacing: "0.06em",
                      borderRadius: "2px",
                    }}
                  >
                    {user ? "Go to Dashboard →" : "Join Now →"}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
