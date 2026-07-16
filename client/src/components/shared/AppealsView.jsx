import { useState, useEffect } from "react";
import { useAppSelector, useAppDispatch } from "@/store";
import { useAuth } from "@/hooks/useAuth";
import { logout } from "@/store/slices/authSlice";
import { apiClient } from "@/services/apiClient";
import {
  ShieldExclamationIcon,
  ArrowRightOnRectangleIcon,
  ClockIcon,
  CheckCircleIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";

export default function AppealsView() {
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const { userRestriction } = useAppSelector((state) => state.auth);
  
  const [appealReason, setAppealReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appeals, setAppeals] = useState([]);
  const [loadingAppeals, setLoadingAppeals] = useState(true);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const restriction = userRestriction || {
    isBanned: user?.role === "BANNED",
    isSuspended: false,
    reason: "Platform restriction active. Contact support.",
    actionId: "",
  };

  const fetchAppeals = async () => {
    try {
      setLoadingAppeals(true);
      const res = await apiClient.get("/appeals");
      if (res.data && res.data.success) {
        setAppeals(res.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch appeals:", err);
    } finally {
      setLoadingAppeals(false);
    }
  };

  useEffect(() => {
    fetchAppeals();
  }, []);

  const handleLogout = () => {
    dispatch(logout());
    window.location.href = "/";
  };

  const handleSubmitAppeal = async (e) => {
    e.preventDefault();
    if (appealReason.length < 10) {
      setErrorMsg("Please write at least 10 characters for your appeal.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg("");
      setSuccessMsg("");

      const res = await apiClient.post("/appeals", {
        actionId: restriction.actionId || "platform-restriction",
        reason: appealReason,
      });

      if (res.data && res.data.success) {
        setSuccessMsg("Your appeal has been successfully submitted! Moderation team will review it.");
        setAppealReason("");
        fetchAppeals();
      }
    } catch (err) {
      setErrorMsg(err.message || "Failed to submit appeal. Try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingAppeal = appeals.find((a) => a.status === "pending" || a.status === "open" || a.status === "escalated");

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between p-6 font-sans relative overflow-hidden selection:bg-rose-500/30">
      {/* Background gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-rose-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="flex justify-between items-center max-w-4xl w-full mx-auto z-10 py-4 border-b border-slate-800/40">
        <div className="flex items-center gap-2">
          <span className="font-serif font-black text-xl tracking-tight bg-gradient-to-r from-rose-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
            CONNECT
          </span>
          <span className="text-[10px] uppercase font-mono font-black text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded">
            Restricted
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-100 bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 transition"
        >
          <ArrowRightOnRectangleIcon className="w-4 h-4" />
          Sign Out
        </button>
      </header>

      {/* Main Content */}
      <main className="max-w-xl w-full mx-auto z-10 py-12 flex-grow flex flex-col justify-center">
        <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-8">
          
          {/* Header Warning */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="h-14 w-14 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/25 animate-pulse">
              <ShieldExclamationIcon className="w-8 h-8" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-black tracking-tight text-slate-100">
              Access Restricted
            </h1>
            <p className="text-sm text-slate-400 max-w-sm">
              Your account has been {restriction.isSuspended ? "suspended" : "banned"} platform-wide due to a violation of our community policies.
            </p>
          </div>

          {/* Details Card */}
          <div className="bg-slate-950/60 border border-slate-800/50 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800/40 pb-3">
              <span className="text-[11px] uppercase font-mono font-bold text-slate-500">Enforcement Details</span>
              <span className="text-[11px] uppercase font-mono font-extrabold text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded">
                {restriction.isSuspended ? "Suspended" : "Permanent Ban"}
              </span>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-slate-500 block">Violation Reason:</span>
              <p className="text-sm text-slate-200 leading-relaxed font-medium">
                {restriction.reason}
              </p>
            </div>
          </div>

          {/* Appeal Section */}
          <div className="space-y-6">
            <div className="border-t border-slate-800/40 pt-6">
              <h2 className="text-lg font-serif font-bold text-slate-200 mb-2">
                Submit an Appeal
              </h2>
              <p className="text-xs text-slate-400">
                If you believe this action was taken in error or you have adjusted your behavior, explain your situation below. Submissions are reviewed by site administrators.
              </p>
            </div>

            {successMsg && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex gap-3 text-sm text-emerald-400">
                <CheckCircleIcon className="w-5 h-5 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/25 rounded-xl flex gap-3 text-sm text-rose-400">
                <ShieldExclamationIcon className="w-5 h-5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {pendingAppeal ? (
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex gap-4 items-start">
                <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
                  <ClockIcon className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-slate-400 block font-semibold">Appeal Status: Pending Review</span>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    You submitted an appeal on {new Date(pendingAppeal.createdAt).toLocaleDateString()}. Our administrative team is currently reviewing your case. We will notify you once a decision has been reached.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitAppeal} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="appeal-text" className="text-xs text-slate-400 font-semibold block">
                    Write your explanation
                  </label>
                  <textarea
                    id="appeal-text"
                    value={appealReason}
                    onChange={(e) => setAppealReason(e.target.value)}
                    placeholder="Provide context, explain why this violation occurred, and what steps you've taken to align with our guidelines..."
                    className="w-full h-32 bg-slate-950 border border-slate-800 focus:border-rose-500/50 rounded-xl p-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition resize-none"
                    disabled={isSubmitting}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || appealReason.length < 10}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-semibold text-sm transition shadow-lg shadow-rose-950/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <>
                      <PaperAirplaneIcon className="w-4 h-4" />
                      Submit Appeal
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl w-full mx-auto z-10 py-6 border-t border-slate-800/40 text-center text-[10px] font-mono text-slate-600">
        © {new Date().getFullYear()} CONNECT. All rights reserved. Platform security and verification active.
      </footer>
    </div>
  );
}
