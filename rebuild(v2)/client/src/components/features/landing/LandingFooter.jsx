export function LandingFooter() {
  return (
    <footer className="bg-[#0a0a0a] border-t border-white/[0.06] py-12">
      <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-8">
        <span
          className="text-[#f0ede6]"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "15px",
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          Connect
        </span>
        <div className="flex items-center gap-8">
          {["Manifesto", "Communities", "Press", "Privacy"].map((item) => (
            <button
              key={item}
              className="text-[#444440] hover:text-[#888880] transition-colors duration-200"
              style={{
                fontFamily: "'Hedvig Letters Serif', serif",
                fontSize: "12.5px",
                letterSpacing: "0.08em",
              }}
            >
              {item}
            </button>
          ))}
        </div>
        <span
          className="text-[#333330]"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "12.5px",
          }}
        >
          the conversation is the product
        </span>
      </div>
    </footer>
  );
}
