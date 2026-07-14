import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { cn } from "@/utils/cn";
import { useAuth } from "@/hooks/useAuth";

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled ? "bg-[#0d0d0d]/95 backdrop-blur-sm border-b border-white/10" : ""
      )}
    >
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link 
            to="/" 
            className="text-[#f0ede6] hover:opacity-80 transition-opacity"
            style={{ fontFamily: "'Hedvig Letters Serif', serif", fontSize: "16px", fontWeight: 400, letterSpacing: "0.02em" }}
          >
            Connect
          </Link>
          <div className="hidden md:flex items-center gap-8">
            {["Manifesto", "Communities", "Press", "Live"].map((item) => (
              <button
                key={item}
                className="text-[#888880] hover:text-[#f0ede6] transition-colors duration-200 relative group"
                style={{ fontFamily: "'Hedvig Letters Serif', serif", fontSize: "12.5px", letterSpacing: "0.04em" }}
              >
                {item === "Live" && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#d42b2b] mr-1.5 animate-pulse" />
                )}
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <Link
            to={user ? "/home" : "/auth"}
            className="text-[#888880] hover:text-[#f0ede6] transition-colors duration-200"
            style={{ fontFamily: "'Hedvig Letters Serif', serif", fontSize: "14px", letterSpacing: "0.02em" }}
          >
            {user ? "Dashboard" : "Sign in"}
          </Link>
          <Link
            to={user ? "/home" : "/auth?mode=register"}
            className="bg-[#d42b2b] hover:bg-[#b82020] text-[#f0ede6] px-5 py-2 transition-all duration-200 hover:scale-[0.98] active:scale-95"
            style={{ fontFamily: "'Hedvig Letters Serif', serif", fontSize: "14px", letterSpacing: "0.04em", borderRadius: "2px" }}
          >
            {user ? "Continue" : "Get started"}
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}
