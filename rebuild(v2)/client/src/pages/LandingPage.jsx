import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Activity } from "lucide-react";
import { apiClient } from "@/services/apiClient";

export function LandingPage() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [stats, setStats] = useState({
    topics: 124,
    threads: 1482,
    citizens: 59,
  });

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll);
    // Fetch live counts from the platform
    apiClient
      .get("/admin/metrics?startDate=2020-01-01")
      .then((res) => {
        if (res.data?.success) {
          const data = res.data.data;
          setStats({
            topics: data.messageVolume
              ? Math.ceil(data.messageVolume / 4)
              : 124,
            threads: data.messageVolume || 1482,
            citizens: data.registrations || 59,
          });
        }
      })
      .catch(() => {}); // Fallback to pre-populated mock details on any network failures

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const formatNum = (num) => {
    return num.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-[#f0ede6] selection:bg-[#d42b2b]/30 selection:text-white flex flex-col font-sans overflow-hidden">
      {/* Background grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(#f0ede6 1px, transparent 1px), linear-gradient(90deg, #f0ede6 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* ── Navbar ── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-[#0d0d0d]/95 backdrop-blur-sm border-b border-white/10 py-3"
            : "py-5"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link
              to="/"
              className="text-[#f0ede6] hover:opacity-80 transition-opacity text-xl font-bold tracking-wider font-serif"
            >
              CONNECT
            </Link>
            <div className="hidden md:flex items-center gap-8">
              {["Manifesto", "Communities", "Press", "Live"].map((item) => (
                <button
                  key={item}
                  className="text-[#888880] hover:text-[#f0ede6] text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer"
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
              className="text-[#888880] hover:text-[#f0ede6] text-xs font-bold uppercase tracking-widest transition-colors"
            >
              {user ? "Dashboard" : "Sign in"}
            </Link>
            <Link
              to={user ? "/home" : "/auth?mode=register"}
              className="bg-[#d42b2b] hover:bg-[#b82020] text-[#f0ede6] px-5 py-2.5 text-xs font-black uppercase tracking-widest transition-all hover:scale-[0.98] active:scale-95 rounded-sm"
            >
              {user ? "Continue" : "Get started"}
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-[90vh] flex flex-col justify-center items-center px-6 pt-32 pb-20">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8 animate-in fade-in duration-1000">
            <h1
              className="text-[#f0ede6] leading-[0.95] tracking-tight font-serif font-black"
              style={{ fontSize: "clamp(4rem, 8vw, 8rem)" }}
            >
              Talk.
              <br />
              <span className="italic text-[#d42b2b]">Debate.</span>
              <br />
              Discover.
            </h1>

            <p className="text-[#888880] max-w-lg text-base leading-relaxed font-mono">
              Join communities, challenge perspectives, and become part of
              meaningful conversations spanning across thousands of topics — a
              living network where ideas connect, branch, and evolve.
            </p>

            <div className="flex items-center gap-5">
              <Link
                to={user ? "/discussions" : "/auth?mode=register"}
                className="bg-[#d42b2b] hover:bg-[#b82020] text-[#f0ede6] px-6 py-3.5 text-sm font-black uppercase tracking-widest transition-all rounded-sm"
              >
                Join the conversation →
              </Link>
              <Link
                to={user ? "/discover": "/discover"}
                className="text-[#888880] hover:text-[#f0ede6] text-sm font-black uppercase tracking-widest flex items-center gap-2 transition-colors"
              >
                <span className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-xs">
                  ▶
                </span>
                Explore spheres
              </Link>
            </div>

            {/* Statistics */}
            <div className="flex gap-10 border-t border-white/10 pt-8 max-w-md">
              {[
                { label: "SPHERES", value: formatNum(stats.topics) },
                { label: "TAKES", value: formatNum(stats.threads) },
                { label: "CITIZENS", value: formatNum(stats.citizens) },
              ].map((s) => (
                <div key={s.label} className="space-y-1">
                  <span className="text-[#888880] block text-[9px] font-black uppercase tracking-widest">
                    {s.label}
                  </span>
                  <span className="text-2xl font-black text-white font-serif">
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Decorative graphic panel */}
          <div className="relative h-96 lg:h-[500px] w-full bg-[#161616] border border-white/10 rounded-[32px] overflow-hidden flex flex-col justify-between p-10 animate-in fade-in duration-1000">
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#d42b2b]/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <span className="text-[10px] text-[#888880] font-mono tracking-widest uppercase">
                DISCOURSE SIMULATION // CONNECT_V2
              </span>
              <Activity size={16} className="text-[#d42b2b]" />
            </div>

            <div className="space-y-6 font-serif">
              <div className="space-y-2">
                <span className="text-[10px] text-[#d42b2b] uppercase font-mono tracking-widest font-black">
                  POLITICS & ETHICS SPHERE
                </span>
                <h3 className="text-xl md:text-2xl text-white font-black leading-tight">
                  "Does the proliferation of algorithmic regulation challenge
                  democratic sovereignty?"
                </h3>
              </div>
              <p className="text-sm text-[#888880] leading-relaxed font-mono">
                Active debates involving 180 verified citizens with real-time
                reputation stakes and consensus branches.
              </p>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-white/5">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-[#333] border-2 border-[#161616]"
                  />
                ))}
              </div>
              <span className="text-[10px] text-[#888880] font-mono">
                HEAT LEVEL: VERY HIGH
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="mt-auto border-t border-white/10 bg-[#080808] py-8 text-center text-[#888880] text-xs">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p>© {new Date().getFullYear()} CONNECT. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">
              Manifesto
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Terms of Use
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Privacy Policy
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
export default LandingPage;
