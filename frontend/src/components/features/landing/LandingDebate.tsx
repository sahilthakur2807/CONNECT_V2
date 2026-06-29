import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "motion/react";



export function LandingDebate() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [threads, setThreads] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/messages/trending')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setThreads(data.slice(0, 3));
        }
      })
      .catch(console.error);
  }, []);

  return (
    <section ref={ref} className="bg-[#0d0d0d] py-28 overflow-hidden">
      <div
        className="absolute left-0 right-0 h-px opacity-10"
        style={{ background: "linear-gradient(90deg, transparent, #f0ede6, transparent)" }}
      />
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          {/* Left */}
          <div className="lg:sticky top-24">
            <motion.h2
              initial={{ opacity: 0, y: 32 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
              className="text-[#f0ede6] leading-[0.95] mb-8"
              style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(44px, 7vw, 90px)", fontWeight: 900 }}
            >
              One question.<br />
              <span style={{ fontStyle: "italic", color: "#d42b2b" }}>Many minds.</span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="text-[#555550] mb-10 max-w-xl"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "16.25px", lineHeight: 1.7 }}
            >
              On Connect, debate doesn't compress into a single hot take.
              Every thread holds the full spectrum — for, against, and the
              uncomfortable middle — side by side.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.45 }}
              className="border border-white/10 p-6"
              style={{ borderRadius: "4px" }}
            >
              <div
                className="text-[#555550] mb-4"
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12.5px", letterSpacing: "0.12em" }}
              >
                TOP TRENDING DISCUSSION
              </div>
              <p
                className="text-[#f0ede6]"
                style={{ fontFamily: "'Playfair Display', serif", fontSize: "21.25px", fontStyle: "italic", lineHeight: 1.5 }}
              >
                {threads.length > 0 ? `"${threads[0].room?.title || threads[0].content}"` : "Join the conversation..."}
              </p>
            </motion.div>
          </div>

          {/* Right — thread cards */}
          <div className="space-y-6">
            {threads.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 32 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.2 + i * 0.14 }}
                className="bg-[#161616] border border-white/[0.08] p-6 group hover:border-white/20 transition-all duration-300"
                style={{ borderRadius: "4px" }}
              >
                <div className="flex items-center justify-between mb-5">
                  <span
                    className="px-2.5 py-1"
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "11.25px",
                      letterSpacing: "0.14em",
                      color: "#888880",
                      border: `1px solid #88888044`,
                      borderRadius: "2px",
                    }}
                  >
                    TAKE
                  </span>
                  <span
                    className="text-[#333330]"
                    style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12.5px" }}
                  >
                    {new Date(t.createdAt).toLocaleTimeString()}
                  </span>
                </div>

                <p
                  className="text-[#c8c4be] mb-6 group-hover:text-[#f0ede6] transition-colors duration-300"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "16.25px", lineHeight: 1.65 }}
                >
                  {t.content}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div
                      className="w-7 h-7 rounded-full border-2 border-[#161616] flex items-center justify-center text-[10px] text-white font-bold"
                      style={{ background: "#555550", fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {t.user?.name ? t.user.name[0].toUpperCase() : 'U'}
                    </div>
                    <span
                      className="ml-3 text-[#444440]"
                      style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12.5px" }}
                    >
                      +{t.reactions?.length || 0} reactions
                    </span>
                  </div>
                  <span
                    className="text-[#333330] group-hover:text-[#d42b2b] transition-colors duration-300"
                    style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12.5px" }}
                  >
                    Branch into this →
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
