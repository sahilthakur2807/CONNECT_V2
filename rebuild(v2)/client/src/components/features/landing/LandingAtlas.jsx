import { useEffect, useRef, useState } from "react";
import { motion, useInView, AnimatePresence } from "motion/react";

const SLOTS = [
  { angle: -0.2 * Math.PI, r: 240 },
  { angle: 0.1 * Math.PI, r: 200 },
  { angle: 0.35 * Math.PI, r: 260 },
  { angle: -0.45 * Math.PI, r: 190 },

  { angle: 1.2 * Math.PI, r: 240 },
  { angle: 0.9 * Math.PI, r: 200 },
  { angle: 0.65 * Math.PI, r: 260 },
  { angle: 1.45 * Math.PI, r: 190 },
];

const CARD_WIDTH = 220;
const CARD_HEIGHT = 130;

function isColliding(x, y, topics) {
  return topics.some((topic) => {
    return (
      Math.abs(topic.x - x) < CARD_WIDTH && Math.abs(topic.y - y) < CARD_HEIGHT
    );
  });
}

export function LandingAtlas() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, margin: "-100px" });

  const [trendingRooms, setTrendingRooms] = useState([]);
  const [activeTopics, setActiveTopics] = useState([]);

  const topicCounter = useRef(0);
  const usedSectors = useRef(new Set());

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const res = await fetch("/api/rooms/trending");
        const resData = await res.json();
        const data = resData.data || resData;

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

      let slotIndex = Math.floor(Math.random() * SLOTS.length);
      let attempts = 0;

      while (usedSectors.current.has(slotIndex) && attempts < 20) {
        slotIndex = (slotIndex + 1) % SLOTS.length;
        attempts++;
      }

      const slot = SLOTS[slotIndex];
      const jitterAngle = slot.angle + (Math.random() * 0.06 - 0.03);
      const jitterR = slot.r + (Math.random() * 12 - 6);

      const x = 500 + Math.cos(jitterAngle) * jitterR;
      const y = 500 + Math.sin(jitterAngle) * jitterR;

      const room =
        trendingRooms[Math.floor(Math.random() * trendingRooms.length)];

      const newTopic = {
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
          usedSectors.current.delete(removed.slotIndex);
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
              transition={{
                duration: 0.8,
                ease: [0.22, 1, 0.36, 1],
                delay: 0.1,
              }}
              className="text-[#0d0d0d] leading-[0.95] mb-8"
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(40px, 6vw, 80px)",
                fontWeight: 900,
              }}
            >
              An atlas of <span style={{ fontStyle: "italic" }}>human curiosity,</span>
              <br />
              drawn in real time.
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="text-[#555550] mb-12 max-w-xl"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "16px",
                lineHeight: 1.8,
              }}
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
                  title: "A persistent record",
                  body: "No feed algorithms prioritizing outrage. Connect preserves the structure of debate as a library, not a stream.",
                },
              ].map((item, i) => (
                <motion.div
                  key={item.n}
                  initial={{ opacity: 0, y: 24 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.6, delay: 0.4 + i * 0.12 }}
                  className="flex gap-6 items-start"
                >
                  <span
                    className="text-[#d42b2b]"
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "15px",
                      fontWeight: 700,
                    }}
                  >
                    {item.n}
                  </span>
                  <div>
                    <h4
                      className="text-[#0d0d0d] mb-2"
                      style={{
                        fontFamily: "'Playfair Display', serif",
                        fontSize: "20px",
                        fontWeight: 700,
                      }}
                    >
                      {item.title}
                    </h4>
                    <p
                      className="text-[#555550]"
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "13.75px",
                        lineHeight: 1.6,
                      }}
                    >
                      {item.body}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right Constellation Visualizer */}
          <div className="relative h-[600px] w-full flex items-center justify-center pointer-events-none select-none lg:-mr-32">
            <div className="absolute w-[1000px] h-[1000px] rounded-full border border-black/[0.03]" />
            <div className="absolute w-[800px] h-[800px] rounded-full border border-black/[0.03]" />
            <div className="absolute w-[600px] h-[600px] rounded-full border border-black/[0.04]" />
            <div className="absolute w-[400px] h-[400px] rounded-full border border-black/[0.03]" />
            <div className="absolute w-[200px] h-[200px] rounded-full border border-black/[0.02]" />

            <div className="absolute w-12 h-12 bg-[#d42b2b] rounded-full flex items-center justify-center shadow-[0_0_24px_rgba(212,43,43,0.3)] animate-pulse">
              <span className="w-1.5 h-1.5 bg-white rounded-full" />
            </div>

            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 1000 1000"
            >
              {activeTopics.map((topic) => (
                <motion.line
                  key={`line-${topic.key}`}
                  x1={500}
                  y1={500}
                  x2={topic.x}
                  y2={topic.y}
                  stroke="#d42b2b"
                  strokeWidth="0.8"
                  strokeDasharray="4 6"
                  initial={{ strokeDashoffset: 100, opacity: 0 }}
                  animate={{ strokeDashoffset: 0, opacity: 0.25 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                />
              ))}
            </svg>

            <AnimatePresence mode="popLayout">
              {activeTopics.map((topic) => (
                <motion.div
                  key={topic.key}
                  initial={{ opacity: 0, scale: 0.9, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -8 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute bg-white border border-[#0d0d0d]/[0.08] p-4 flex flex-col justify-between shadow-[0_12px_32px_rgba(13,13,13,0.06)]"
                  style={{
                    width: `${CARD_WIDTH}px`,
                    height: `${CARD_HEIGHT}px`,
                    left: `calc(50% + ${topic.x - 500}px - ${CARD_WIDTH / 2}px)`,
                    top: `calc(50% + ${topic.y - 500}px - ${CARD_HEIGHT / 2}px)`,
                    borderRadius: "4px",
                  }}
                >
                  <div className="flex justify-between items-start gap-3">
                    <span
                      className="text-[#d42b2b] truncate"
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "9px",
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                      }}
                    >
                      {topic.category.toUpperCase()}
                    </span>
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        background:
                          topic._count?.messages > 8
                            ? "#d42b2b"
                            : "rgba(13,13,13,0.15)",
                      }}
                    />
                  </div>
                  <h4
                    className="text-[#0d0d0d] font-bold line-clamp-2 leading-tight"
                    style={{
                      fontFamily: "'Hedvig Letters Serif', serif",
                      fontSize: "14px",
                    }}
                  >
                    {topic.title}
                  </h4>
                  <div className="flex justify-between items-center text-[10px] text-[#888880] font-mono">
                    <span>{topic._count?.members || 0} members</span>
                    <span>{topic._count?.messages || 0} takes</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
