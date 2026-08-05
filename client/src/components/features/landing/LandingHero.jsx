import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getSocket } from "@/services/socketService";

export function LandingHero() {
  const [count, setCount] = useState({ topics: 0, threads: 0, community: 0 });
  const [tickerItems, setTickerItems] = useState([]);
  const [liveQuestion, setLiveQuestion] = useState("");
  const [liveReplies, setLiveReplies] = useState([]);
  const [liveRoomId, setLiveRoomId] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    const fetchStats = () => {
      fetch("/api/stats")
        .then((res) => res.json())
        .then((data) => {
          setCount({
            topics: data.totalRooms || 0,
            threads: data.totalMessages || 0,
            community: data.totalCommunities || 0,
          });
        })
        .catch(console.error);
    };

    fetchStats();
    const statsInterval = setInterval(fetchStats, 10000);

    const fetchTrending = () => {
      fetch("/api/messages/trending")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setTickerItems(
              data.map(
                (msg) => `"${msg.content}" · ${msg.reactions?.length || 0} voices`
              )
            );
            if (data.length > 0) {
              setLiveQuestion(data[0].room?.title || data[0].content);
              setLiveRoomId(data[0].room?.id || "");
              const replies = data[0].replies || [];
              setLiveReplies(replies.slice(0, 4));
            }
          }
        })
        .catch(console.error);
    };

    fetchTrending();
    const trendingInterval = setInterval(fetchTrending, 15000);

    // If authenticated, also bind socket listener for stats_update
    const socket = getSocket();
    const handleStatsUpdate = (data) => {
      setCount({
        topics: data.totalRooms || 0,
        threads: data.totalMessages || 0,
        community: data.totalCommunities || 0,
      });
    };

    if (socket && socket.connected) {
      socket.on("stats_update", handleStatsUpdate);
    }

    return () => {
      clearInterval(statsInterval);
      clearInterval(trendingInterval);
      if (socket) {
        socket.off("stats_update", handleStatsUpdate);
      }
    };
  }, []);

  const fmt = (n) =>
    n >= 1000000
      ? (n / 1000000).toFixed(1) + "M"
      : n >= 1000
      ? (n / 1000).toFixed(1) + "k"
      : String(n);

  return (
    <section className="relative min-h-screen bg-[#0d0d0d] flex flex-col overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(#f0ede6 1px, transparent 1px), linear-gradient(90deg, #f0ede6 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Live indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="absolute top-20 left-6 flex items-center gap-2"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "10px",
          color: "#888880",
          letterSpacing: "0.12em",
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#d42b2b] animate-pulse" />
        CONVERSATIONS · LIVE NOW
      </motion.div>

      {/* Main content */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 pt-32 pb-24 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          >
            <h1
              className="text-[#f0ede6] leading-[0.95] mb-8"
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(64px, 10vw, 137.5px)",
                fontWeight: 900,
              }}
            >
              Talk.
              <br />
              <span style={{ fontStyle: "italic", color: "#d42b2b" }}>Debate.</span>
              <br />
              Discover.
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="text-[#888880] mb-10 max-w-lg"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "16.25px",
              lineHeight: 1.7,
            }}
          >
            Join communities, challenge perspectives, and become part of
            meaningful conversations spanning across thousands of topics — a
            living network where ideas connect, branch, and evolve.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.65 }}
            className="flex items-center gap-4 mb-16"
          >
            <Link
              to={user ? "/home" : "/auth?mode=login"}
              className="bg-[#d42b2b] hover:bg-[#b82020] text-[#f0ede6] px-6 py-3 transition-all duration-200 hover:scale-[0.98] active:scale-95"
              style={{
                fontFamily: "'Hedvig Letters Serif', serif",
                fontSize: "15px",
                letterSpacing: "0.06em",
                borderRadius: "2px",
              }}
            >
              Join the conversation →
            </Link>
            <Link
              to={user ? "/discover" : "/auth?mode=login"}
              className="text-[#888880] hover:text-[#f0ede6] transition-colors duration-200 flex items-center gap-2"
              style={{
                fontFamily: "'Hedvig Letters Serif', serif",
                fontSize: "15px",
                letterSpacing: "0.06em",
              }}
            >
              <span className="w-7 h-7 rounded-full border border-white/20 flex items-center justify-center">
                ▶
              </span>
              View the network
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="flex items-start gap-10 border-t border-white/10 pt-8"
          >
            {[
              { label: "TOPICS", value: fmt(count.topics) },
              { label: "THREADS", value: fmt(count.threads) },
              { label: "COMMUNITY", value: fmt(count.community) },
            ].map((s) => (
              <div key={s.label}>
                <div
                  className="text-[#f0ede6] tabular-nums"
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: "40px",
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  {s.value}
                </div>
                <div
                  className="text-[#555550] mt-1"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "12.5px",
                    letterSpacing: "0.14em",
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Right — Live debate card */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
          className="relative"
        >
          {/* Background blur blob */}
          <div
            className="absolute -inset-20 opacity-20 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at center, #d42b2b 0%, transparent 70%)",
              filter: "blur(60px)",
            }}
          />

          <div
            className="relative bg-[#161616] border border-white/10 p-6"
            style={{ borderRadius: "4px" }}
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className="flex items-center gap-2 text-[#d42b2b]"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "12.5px",
                  letterSpacing: "0.12em",
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#d42b2b] animate-pulse" />
                LIVE QUESTION
              </div>
              <span
                className="text-[#555550]"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "12.5px",
                  letterSpacing: "0.1em",
                }}
              >
                OUR QUESTION
              </span>
            </div>

            <p
              className="text-[#f0ede6] mb-6 leading-snug"
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "22.5px",
                fontStyle: "italic",
                fontWeight: 400,
              }}
            >
              "{liveQuestion || "Should AI assistants be allowed to mediate human disagreements?"}"
            </p>

            <div className="space-y-2.5 mb-6">
              {liveReplies.map((r, i) => {
                const total = liveReplies.length || 1;
                const pct = Math.round((1 / total) * 100);
                return (
                  <motion.div
                    key={r.id || i}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.9 + i * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <div
                      className="flex-1 relative h-8 bg-[#0d0d0d] border border-white/[0.07] overflow-hidden"
                      style={{ borderRadius: "2px" }}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{
                          delay: 1.1 + i * 0.1,
                          duration: 0.8,
                          ease: "easeOut",
                        }}
                        className="absolute inset-y-0 left-0"
                        style={{
                          background: i === 0 ? "#d42b2b22" : "#ffffff08",
                        }}
                      />
                      <span
                        className="absolute inset-0 flex items-center px-3 truncate"
                        style={{
                          fontFamily: "'Hedvig Letters Serif', serif",
                          fontSize: "15px",
                          color: i === 0 ? "#f0ede6" : "#FFFFFF",
                        }}
                      >
                        {r.content}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              {["#E06C75", "#61AFEF", "#98C379", "#E5C07B"].map((c, i) => (
                <div
                  key={i}
                  className="w-7 h-7 rounded-full border-2 border-[#161616] -ml-2 first:ml-0 flex items-center justify-center text-[11.25px] text-white font-bold"
                  style={{
                    background: c,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {["K", "A", "J", "M"][i]}
                </div>
              ))}
              <span
                className="ml-2 text-[#FFFFFF]"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "12.5px",
                }}
              >
                +657 voices
              </span>
            </div>

            <Link
              to={user ? (liveRoomId ? `/room/${liveRoomId}` : "/home") : "/auth?mode=login"}
              className="mt-4 pt-4 border-t border-white/[0.07] text-[#FFFFFF] block hover:text-[#d42b2b] transition-colors duration-200"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "12.5px",
              }}
            >
              Branch into this one →
            </Link>
          </div>

          {/* Floating mini-card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.3, duration: 0.6 }}
            className="absolute -bottom-10 -right-4 bg-[#1e1e1e] border border-white/10 p-4 w-56"
            style={{ borderRadius: "4px" }}
          >
            <div
              className="text-[#d42b2b] mb-2"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "11px",
                letterSpacing: "0.12em",
              }}
            >
              BRANCHING NOW
            </div>
            <p
              className="text-[#f0ede6]"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "11px",
                lineHeight: 1.5,
              }}
            >
              "JWST sees a galaxy that shouldn't exist yet."
            </p>
          </motion.div>
        </motion.div>
      </div>

      {/* Ticker */}
      <div className="border-t border-white/10 bg-[#0a0a0a] py-3 overflow-hidden">
        <motion.div
          className="flex gap-12 whitespace-nowrap"
          animate={{ x: [0, -2400] }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        >
          {[
            ...(tickerItems.length ? tickerItems : ["Join the conversation"]),
            ...(tickerItems.length ? tickerItems : ["Join the conversation"]),
          ].map((item, i) => (
            <span
              key={i}
              className="text-[#444440] flex-shrink-0"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "13.75px",
                letterSpacing: "0.04em",
              }}
            >
              <span className="text-[#d42b2b] mr-2">◆</span>
              {item}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
