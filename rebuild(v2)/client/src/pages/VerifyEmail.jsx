import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  ArrowRight,
  MailCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";

export function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [status, setStatus] = useState("verifying"); // verifying, success, error
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setStatus("error");
        setErrorMessage("Verification token is missing from the link.");
        return;
      }

      try {
        // Debounce slightly for a premium, non-jittery transition
        await new Promise((resolve) => setTimeout(resolve, 1500));
        
        await apiClient.post("/auth/verify-email", { token });
        setStatus("success");
        toast.success("Email verified successfully!");
      } catch (err) {
        setStatus("error");
        setErrorMessage(
          err.message || "Invalid or expired verification token."
        );
        toast.error(err.message || "Email verification failed.");
      }
    };

    verifyToken();
  }, [token]);

  return (
    <div className="min-h-screen bg-background bg-gradient-to-br from-background via-indigo-950/5 to-background flex items-center justify-center p-4">
      {/* Abstract premium mesh background details */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
        <div className="absolute -top-[30%] -left-[20%] w-[70%] h-[70%] rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute -bottom-[30%] -right-[20%] w-[70%] h-[70%] rounded-full bg-purple-500/10 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md z-10"
      >
        <Card className="border-border/50 rounded-[32px] bg-card/70 backdrop-blur-md shadow-2xl overflow-hidden relative border">
          <CardContent className="p-8 sm:p-10 flex flex-col items-center text-center space-y-6">
            
            {/* Header / Brand */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                <span className="text-primary-foreground text-sm font-bold font-serif select-none">N</span>
              </div>
              <span className="text-lg font-serif font-black tracking-tight text-foreground">Connect</span>
            </div>

            {status === "verifying" && (
              <motion.div
                key="verifying"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6 w-full"
              >
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center relative mx-auto">
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-0 rounded-full border border-primary/25 pointer-events-none"
                  />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-serif font-black text-foreground">Citizen Attestation</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Verifying your credentials on the consensus network. Please hold on a moment...
                  </p>
                </div>
              </motion.div>
            )}

            {status === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6 w-full"
              >
                <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto text-emerald-500">
                  <ShieldCheck className="h-10 w-10" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-serif font-black text-foreground">Verification Successful</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Your email address has been verified. Welcome as an authorized member of our network.
                  </p>
                </div>
                
                <div className="pt-4">
                  <Button
                    onClick={() => navigate("/home")}
                    className="w-full rounded-2xl h-12 font-bold uppercase text-xs tracking-wider gap-2 shadow-lg shadow-primary/20 cursor-pointer"
                  >
                    Enter Platform <ArrowRight size={14} />
                  </Button>
                </div>
              </motion.div>
            )}

            {status === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6 w-full"
              >
                <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto text-destructive">
                  <ShieldAlert className="h-10 w-10" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-serif font-black text-foreground">Attestation Failed</h3>
                  <p className="text-sm text-destructive font-medium bg-destructive/5 border border-destructive/10 p-3 rounded-2xl leading-normal">
                    {errorMessage}
                  </p>
                </div>
                
                <div className="pt-4 flex flex-col gap-2">
                  <Button
                    onClick={() => navigate("/auth?mode=login")}
                    className="w-full rounded-2xl h-12 font-bold uppercase text-xs tracking-wider cursor-pointer"
                  >
                    Back to Login
                  </Button>
                  <Link
                    to="/"
                    className="text-[10px] uppercase font-black tracking-widest text-muted-foreground hover:text-foreground transition-all pt-2"
                  >
                    Go to Homepage
                  </Link>
                </div>
              </motion.div>
            )}

          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
export default VerifyEmail;
