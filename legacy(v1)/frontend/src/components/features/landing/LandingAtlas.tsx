import { useEffect, useRef, useState } from "react";
import { motion, useInView, AnimatePresence } from "motion/react";

interface TrendingRoom {
  id: string;
  title: string;
  category: string;
}

interface ActiveTopic extends TrendingRoom {
  x: number;
  y: number;
  angle: number;
  distance: number;
  slotIndex: number;
  key: number;
}

const SLOTS = [
  { angle: -0.20 * Math.PI, r: 340 },
  { angle: 0.10 * Math.PI, r: 420 },
  { angle: 0.35 * Math.PI, r: 360 },
  { angle: -0.45 * Math.PI, r: 390 },

  { angle: 1.20 * Math.PI, r: 340 },
  { angle: 0.90 * Math.PI, r: 420 },
  { angle: 0.65 * Math.PI, r: 360 },
  { angle: 1.45 * Math.PI, r: 390 },
];

const CARD_WIDTH = 220;
const CARD_HEIGHT = 90;

function isColliding(
  x: number,
  y: number,
  topics: ActiveTopic[]
) {
  return topics.some((topic) => {
    return (
      Math.abs(topic.x - x) < CARD_WIDTH &&
      Math.abs(topic.y - y) < CARD_HEIGHT
    );
  });
}

export function LandingAtlas() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, margin: "-100px" });

  const [trendingRooms, setTrendingRooms] = useState<TrendingRoom[]>([]);
  const [activeTopics, setActiveTopics] = useState<ActiveTopic[]>([]);

  const topicCounter = useRef(0);
  const usedSectors = useRef<Set<number>>(new Set());

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const res = await fetch(
          "/api/rooms/trending"
        );

        const data = await res.json();

        if (Array.isArray(data) && data.length > 0) {
          setTrendingRooms(data);
        } else {
          throw new Error("No data");
        }
      } catch (error) {
        console.error("Failed to fetch trending rooms:", error);
      }
    };

    fetchTrending();
  }, []);

  useEffect(() => {
    if (!inView || trendingRooms.length === 0) return;

    const interval = setInterval(() => {
      if (usedSectors.current.size >= SLOTS.length) return;

      let slotIndex = Math.floor(
        Math.random() * SLOTS.length
      );

      let attempts = 0;

      while (
        usedSectors.current.has(slotIndex) &&
        attempts < 20
      ) {
        slotIndex = (slotIndex + 1) % SLOTS.length;
        attempts++;
      }

      const slot = SLOTS[slotIndex];

      const jitterAngle =
        slot.angle + (Math.random() * 0.06 - 0.03);

      const jitterR =
        slot.r + (Math.random() * 12 - 6);

      const x =
        500 + Math.cos(jitterAngle) * jitterR;

      const y =
        500 + Math.sin(jitterAngle) * jitterR;

      const room =
        trendingRooms[
        Math.floor(
          Math.random() * trendingRooms.length
        )
        ];

      const newTopic: ActiveTopic = {
        ...room,
        x,
        y,
        angle: jitterAngle,
        distance: jitterR,
        slotIndex,
        key: ++topicCounter.current,
      };

      setActiveTopics((prev) => {
        if (isColliding(x, y, prev)) {
          return prev;
        }

        usedSectors.current.add(slotIndex);

        const next = [...prev, newTopic];

        if (next.length > 4) {
          const removed = next[0];

          usedSectors.current.delete(
            removed.slotIndex
          );

          return next.slice(1);
        }

        return next;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [inView, trendingRooms]);

  return (
    <section ref={ref} className="bg-[#f5f4ef] py-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          {/* Left Content */}
          <div className="z-20">
            <motion.h2
              initial={{ opacity: 0, y: 32 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
              className="text-[#0d0d0d] leading-[0.95] mb-8"
              style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(40px, 6vw, 80px)", fontWeight: 900 }}
            >
              An atlas of{" "}
              <span style={{ fontStyle: "italic" }}>human curiosity,</span>
              <br />
              drawn in real time.
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="text-[#555550] mb-12 max-w-xl"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "16px", lineHeight: 1.8 }}
            >
              Every topic is a constellation. Every thread, a new star. Drift
              through clusters, follow the tension lines, and find the corner of
              the network where your question already has a hundred answers.
            </motion.p>

            <div className="space-y-12">
              {[
                {
                  n: "01",
                  title: "Follow the tension",
                  body: "Topics with active disagreement grow brighter. The most alive corners of the network become impossible to miss.",
                },
                {
                  n: "02",
                  title: "Branch, don't reply",
                  body: "Every counter-point becomes a new node. Conversations grow as trees, not as walls of text.",
                },
                {
                  n: "03",
                  title: "Bring your context",
                  body: "Bookmarks, sources and lived experience travel with you across every community you join.",
                },
              ].map((item, i) => (
                <motion.div
                  key={item.n}
                  initial={{ opacity: 0, x: -20 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.6, delay: 0.5 + i * 0.12 }}
                  className="flex gap-8"
                >
                  <span
                    className="text-[#d42b2b] flex-shrink-0 mt-0.5"
                    style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em" }}
                  >
                    {item.n}
                  </span>
                  <div>
                    <div
                      className="text-[#0d0d0d] mb-2"
                      style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "14px", fontWeight: 700, letterSpacing: "0.04em" }}
                    >
                      {item.title}
                    </div>
                    <p
                      className="text-[#888880]"
                      style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "14px", lineHeight: 1.6 }}
                    >
                      {item.body}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right — Radar Atlas */}
          <div className="relative aspect-square w-full max-w-[600px] mx-auto flex items-center justify-center overflow-visible">

            {/* Center Discussion Node (HTML overlay for perfect centering & text clarity) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <motion.div
                initial={{ scale: 0 }}
                animate={inView ? { scale: 1 } : {}}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
                className="w-48 h-48 bg-[#d42b2b] rounded-full flex items-center justify-center shadow-2xl relative"
              >
                <motion.div
                  className="absolute inset-0 border border-[#d42b2b] rounded-full"
                  animate={{
                    scale: [1, 1.6],
                    opacity: [0.15, 0],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
                <span
                  className="text-white text-[11px] font-bold tracking-[0.15em] uppercase"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Discussion
                </span>
              </motion.div>
            </div>

            {/* Central Glow */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
              <div className="w-[30%] h-[30%] bg-[#d42b2b]/10 rounded-full blur-3xl" />
            </div>

            {/* Background Rings & Connecting Lines (SVG layer) */}
            <svg viewBox="0 0 1000 1000" className="absolute inset-0 w-full h-full pointer-events-none z-10" style={{ overflow: "visible" }}>
              <circle cx="500" cy="500" r="450" fill="none" stroke="#d42b2b" strokeWidth="1" opacity="0.05" />
              <motion.circle
                cx="500" cy="500" r="350" fill="none" stroke="#d42b2b" strokeWidth="1" strokeDasharray="10 10" opacity="0.28"
                animate={{ rotate: 360 }}
                transition={{ duration: 100, repeat: Infinity, ease: "linear" }}
                style={{ transformOrigin: "500px 500px" }}
              />
              <motion.circle
                cx="500" cy="500" r="250" fill="none" stroke="#d42b2b" strokeWidth="1" strokeDasharray="4 8" opacity="0.3"
                animate={{ rotate: -360 }}
                transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
                style={{ transformOrigin: "500px 500px" }}
              />
              <circle cx="500" cy="500" r="150" fill="none" stroke="#d42b2b" strokeWidth="1" opacity="0.25" />

              {/* Connecting Lines to Topics */}
              <AnimatePresence>
                {activeTopics.map((topic) => (
                  <motion.g
                    key={`line-${topic.key}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1 }}
                  >
                    <motion.path
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      d={`M 500 500 L ${topic.x} ${topic.y}`}
                      stroke="#d42b2b"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                      fill="none"
                      opacity={0.3}
                    />
                    <circle
                      cx={topic.x}
                      cy={topic.y}
                      fill="#d42b2b"
                      opacity={0.25}
                    />
                  </motion.g>
                ))}
              </AnimatePresence>
            </svg>

            {/* Dynamic Topics Labels (HTML overlay for perfect crisp rendering & layout) */}
            {activeTopics.map((topic) => (
              <motion.div
                key={`label-${topic.key}`}
                initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="absolute z-30 pointer-events-auto"
                style={{
                  left: `${(topic.x / 1000) * 100}%`,
                  top: `${(topic.y / 1000) * 100}%`,
                  transform: `translate(${topic.x > 500 ? '16px' : 'calc(-100% - 16px)'}, -50%)`,
                }}
              >
                <div className="bg-white/95 backdrop-blur-xl border border-[#d42b2b]/15 rounded-xl p-4 w-[220px] shadow-[0_8px_30px_rgb(0,0,0,0.06)] relative group cursor-pointer hover:border-[#d42b2b]/40 transition-colors duration-300">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#d42b2b] animate-pulse" />
                    <span className="text-[#d42b2b] text-[9px] font-bold uppercase tracking-[0.2em]">
                      {topic.category}
                    </span>
                  </div>
                  <h3 className="text-[#0d0d0d] text-[13px] font-semibold leading-[1.4] line-clamp-2" style={{ fontFamily: "'Inter', sans-serif" }}>
                    {topic.title}
                  </h3>
                </div>
              </motion.div>
            ))}

          </div>
        </div>
      </div>
    </section>
  );
}

