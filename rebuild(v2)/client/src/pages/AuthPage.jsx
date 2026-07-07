import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  EyeIcon,
  EyeSlashIcon,
  ArrowLeftIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";

const PANEL_CONTENT = {
  login: {
    quote: '"The story you\'re reading right now — someone else is too."',
    sub: "Join the live discussion on any article from across the web.",
  },
  register: {
    quote: '"One conversation per news story."',
    sub: "Paste any article URL and join everyone else reading the same story.",
  },
  forgot: {
    quote: '"Stay informed. Stay connected."',
    sub: "We'll get you back into the conversation in seconds.",
  },
};

export function AuthPage() {
  const [params] = useSearchParams();
  const initialMode = params.get("mode") || "login";
  const [mode, setMode] = useState(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const navigate = useNavigate();

  const [form, setForm] = useState({ username: "", email: "", password: "" });

  const [justRegistered, setJustRegistered] = useState(false);

  const { user, login, register } = useAuth();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  useEffect(() => {
    if (user && !loading && !justRegistered) {
      navigate("/home");
    }
  }, [user, loading, justRegistered, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Wait a brief moment to emulate connection/security delays
    await new Promise((r) => setTimeout(r, 400));

    if (mode === "login") {
      const loginIdentifier = form.email || form.username;
      if (!loginIdentifier || !form.password) {
        setError("Please enter your credentials.");
      } else {
        try {
          // Rebuilt login endpoint handles either username or email in 'identifier' parameter
          await login(loginIdentifier, form.password);
          toast.success("Successfully logged in!");
          if (justRegistered) {
            navigate("/onboarding");
          } else {
            navigate("/home");
          }
        } catch (err) {
          setError(err.message || "Login failed.");
        }
      }
    } else if (mode === "register") {
      if (!form.username || !form.email || !form.password) {
        setError("Please fill in all required fields.");
      } else if (form.username.length < 3) {
        setError("Username must be at least 3 characters long.");
      } else if (form.username.length > 30) {
        setError("Username must be at most 30 characters.");
      } else if (!/^[a-zA-Z0-9_]+$/.test(form.username)) {
        setError(
          "Username can only contain alphanumeric characters and underscores (no spaces).",
        );
      } else if (form.password.length < 8) {
        setError("Password must be at least 8 characters long.");
      } else {
        try {
          await register(form.username, form.email, form.password);
          toast.success("Registration successful!");
          setJustRegistered(true);
          navigate("/onboarding");
        } catch (err) {
          setError(err.message || "Registration failed.");
        }
      }
    } else {
      if (!form.email) {
        setError("Please enter your email address.");
      } else {
        try {
          await apiClient.post("/auth/forgot-password", { email: form.email });
          setForgotSent(true);
          toast.success("Password reset email sent!");
        } catch (err) {
          setError(err.response?.data?.error || err.message || "Failed to send reset email.");
        }
      }
    }
    setLoading(false);
  };

  const panel = PANEL_CONTENT[mode];

  return (
    <div className="flex min-h-screen bg-background overflow-hidden font-sans">
      {/* Left dark panel */}
      <div
        className="hidden lg:flex flex-col w-1/2 shrink-0 p-10 relative overflow-hidden bg-[#0D1117]"
        aria-hidden="true"
      >
        <div className="relative z-10 flex flex-col h-full">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 w-fit hover:opacity-80 transition-opacity cursor-pointer"
          >
            <div className="w-8 h-8 bg-primary flex items-center justify-center rounded-lg">
              <span className="text-primary-foreground font-serif text-sm">
                C
              </span>
            </div>
            <span className="text-white font-['Hedvig_Letters_Serif',_serif] text-base">
              Connect
            </span>
          </Link>

          {/* Quote */}
          <div className="flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-bottom duration-500">
            <div className="max-w-[320px]">
              <blockquote
                className="text-white font-bold italic mb-4 text-[28px] leading-[1.25] tracking-tight"
                style={{ fontFamily: "Georgia, serif" }}
              >
                {panel.quote}
              </blockquote>
              <p className="text-sm text-[#8B949E] font-normal leading-tight">
                {panel.sub}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="text-[12px] text-[#484F58]">
            <p>© Connect</p>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 sm:p-12 lg:p-16 overflow-y-auto bg-background">
        <div className="w-full max-w-[384px] animate-in fade-in duration-300">
          <div className="mb-6">
            <Link
              to="/"
              className="lg:hidden inline-flex items-center gap-2 mb-8 text-primary cursor-pointer"
            >
              <div className="w-8 h-8 bg-primary flex items-center justify-center rounded-lg">
                <span className="text-primary-foreground font-serif text-sm">
                  C
                </span>
              </div>
              <span className="text-foreground font-['Hedvig_Letters_Serif',_serif] text-base">
                Connect
              </span>
            </Link>

            <h1 className="text-[26px] font-bold text-foreground mb-1 tracking-tight">
              {mode === "login" && "Welcome back"}
              {mode === "register" && "Create an account"}
              {mode === "forgot" && "Reset password"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {mode === "login" && "Sign in to join discussions."}
              {mode === "register" && "Join the conversation today."}
              {mode === "forgot" && "We'll send a reset link to your email."}
            </p>
          </div>

          {forgotSent ? (
            <Card className="border-green-100 bg-green-50/50 dark:bg-green-950/10 dark:border-green-900/30 overflow-hidden rounded-xl">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircleIcon
                    className="w-8 h-8 text-green-600 dark:text-green-400"
                  />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">
                  Check your inbox
                </h2>
                <p className="text-muted-foreground font-medium mb-8">
                  We've sent a password reset link to <br />
                  <span className="text-foreground font-bold">
                    {form.email}
                  </span>
                </p>
                <Button
                  variant="outline"
                  className="w-full h-10 rounded-[10px] font-semibold cursor-pointer"
                  onClick={() => {
                    setMode("login");
                    setForgotSent(false);
                  }}
                >
                  <ArrowLeftIcon className="w-4 h-4 mr-2" /> Back to Sign In
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-5">
              {error && (
                <div className="flex gap-2 items-start p-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl text-sm font-medium animate-in fade-in">
                  <ExclamationCircleIcon className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold">Error</p>
                    <p className="opacity-90">{error}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "register" && (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="username"
                      className="font-medium text-sm text-foreground"
                    >
                      Username
                    </label>
                    <Input
                      id="username"
                      name="username"
                      placeholder="johndoe"
                      required
                      minLength={3}
                      maxLength={30}
                      pattern="^[a-zA-Z0-9_]+$"
                      value={form.username}
                      onChange={handleChange}
                      className="h-[42px] px-3 rounded-[10px]"
                    />

                    <p className="text-[10px] text-muted-foreground leading-tight px-0.5">
                      Only letters, numbers, and underscores are allowed. No
                      spaces. Min 3 characters.
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className="font-medium text-sm text-foreground"
                  >
                    {mode === "login" ? "Username or Email" : "Email"}
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type={mode === "login" ? "text" : "email"}
                    placeholder={
                      mode === "login"
                        ? "johndoe or name@example.com"
                        : "name@example.com"
                    }
                    required
                    value={form.email}
                    onChange={handleChange}
                    className="h-[42px] px-3 rounded-[10px]"
                  />
                </div>

                {mode !== "forgot" && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="password"
                        className="font-medium text-sm text-foreground"
                      >
                        Password
                      </label>
                      {mode === "login" && (
                        <button
                          type="button"
                          onClick={() => {
                            setMode("forgot");
                            setError("");
                          }}
                          className="text-xs text-primary font-semibold hover:underline cursor-pointer"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={mode === "register" ? 8 : undefined}
                        value={form.password}
                        onChange={handleChange}
                        className="h-[42px] pl-3 pr-10 rounded-[10px]"
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        {showPassword ? (
                          <EyeSlashIcon className="w-4 h-4" />
                        ) : (
                          <EyeIcon className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {mode === "register" && (
                      <p className="text-[10px] text-muted-foreground leading-tight px-0.5 mt-1">
                        Minimum 8 characters.
                      </p>
                    )}
                  </div>
                )}

                <div className="pt-2">
                  <Button
                    type="submit"
                    className="w-full h-10 rounded-[10px] font-semibold text-sm cursor-pointer"
                    disabled={loading}
                  >
                    {loading
                      ? "Processing..."
                      : mode === "login"
                        ? "Sign in"
                        : mode === "register"
                          ? "Join now"
                          : "Send Reset Link"}
                  </Button>
                </div>
              </form>

              <div className="space-y-2 pt-2">
                <p className="text-sm font-normal text-muted-foreground">
                  {mode === "login" ? (
                    <>
                      New here?{" "}
                      <button
                        onClick={() => setMode("register")}
                        className="text-primary text-sm font-bold hover:underline cursor-pointer"
                      >
                        Create one
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{" "}
                      <button
                        onClick={() => setMode("login")}
                        className="text-primary text-sm font-bold hover:underline cursor-pointer"
                      >
                        Sign in
                      </button>
                    </>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default AuthPage;
