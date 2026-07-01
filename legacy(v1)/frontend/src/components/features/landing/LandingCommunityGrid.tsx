import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "motion/react";



export function LandingCommunityGrid() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [cards, setCards] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/rooms/trending')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setCards(data.slice(0, 6));
        }
      })
      .catch(console.error);
  }, []);

  return (
    <section ref={ref} className="bg-[#f5f4ef] py-32">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8">
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            className="text-[#0d0d0d] max-w-2xl"
            style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(40px, 6vw, 76px)", fontWeight: 900, lineHeight: 1.05 }}
          >
            A network that{" "}
            <span style={{ fontStyle: "italic" }}>breathes.</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.4 }}
            className="text-[#555550] max-w-sm"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "14px", lineHeight: 1.7 }}
          >
            Communities rise and fall on the heartbeat of attention. Watch ideas form, fork, and find their audience — in real time.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card, i) => (
            <motion.div
              key={card.id || i}
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 + i * 0.08 }}
              className="bg-white border border-black/[0.04] p-8 group hover:border-black/[0.15] hover:shadow-sm transition-all duration-300 cursor-pointer flex flex-col h-full"
              style={{ borderRadius: "2px" }}
            >
              <div className="flex items-center justify-between mb-6">
                <span
                  className="tracking-widest"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "10px",
                    fontWeight: 700,
                    color: card.messages && card.messages.length > 5 ? "#d42b2b" : "#888880",
                  }}
                >
                  {card.category || "TOPIC"}
                </span>
                {(card.messages && card.messages.length > 5) && (
                  <span
                    className="flex items-center gap-1.5 text-[#d42b2b]"
                    style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em" }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#d42b2b] animate-pulse" />
                    ACTIVE
                  </span>
                )}
              </div>

              <h3
                className="text-[#0d0d0d] mb-12 group-hover:text-[#1a1a1a] transition-colors duration-200 leading-[1.2] flex-1"
                style={{ fontFamily: "'Playfair Display', serif", fontSize: "24px", fontWeight: 800 }}
              >
                {card.title}
              </h3>

              <div className="flex items-center justify-between pt-6 border-t border-black/[0.05]">
                <div 
                  className="text-[#888880] flex items-center gap-2"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}
                >
                  <span className="font-bold text-[#0d0d0d]">{card._count?.messages || 0}</span>
                  <span>REPLIES</span>
                </div>
                <div 
                  className="text-[#888880]"
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}
                >
                  {new Date(card.updatedAt || card.createdAt || Date.now()).toLocaleDateString()}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
