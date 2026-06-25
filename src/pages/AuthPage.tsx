import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Eye, EyeOff, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/hooks/use-auth';

type AuthMode = 'login' | 'register' | 'forgot';

const PANEL_CONTENT: Record<AuthMode, { quote: string; sub: string }> = {
  login: {
    quote: '"The story you\'re reading right now — someone else is too."',
    sub: 'Join the live discussion on any article from across the web.',
  },
  register: {
    quote: '"One conversation per news story."',
    sub: 'Paste any article URL and join everyone else reading the same story.',
  },
  forgot: {
    quote: '"Stay informed. Stay connected."',
    sub: 'We\'ll get you back into the conversation in seconds.',
  },
};

export function AuthPage() {
  const [params] = useSearchParams();
  const initialMode = (params.get('mode') as AuthMode) || 'login';
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', username: '', email: '', password: '' });

  const [justRegistered, setJustRegistered] = useState(false);

  const { user, login, register } = useAuth();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  useEffect(() => {
    if (user && !loading && !justRegistered) {
      navigate('/home');
    }
  }, [user, loading, justRegistered, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    await new Promise((r) => setTimeout(r, 700));

    if (mode === 'login') {
      if (!form.email || !form.password) {
        setError('Please enter your email and password.');
      } else {
        try {
          await login(form.email, form.password);
          if (justRegistered) {
            navigate('/onboarding');
          } else {
            navigate('/home');
          }
        } catch (err: any) {
          setError(err.message || 'Login failed.');
        }
      }
    } else if (mode === 'register') {
      if (!form.username || !form.email || !form.password) {
        setError('Please fill in all required fields.');
      } else if (form.password.length < 6) {
        setError('Password must be at least 6 characters.');
      } else {
        try {
          await register(form.username, form.email, form.password);
          setJustRegistered(true);
          navigate('/onboarding');
        } catch (err: any) {
          setError(err.message || 'Registration failed.');
        }
      }
    } else {
      if (!form.email) {
        setError('Please enter your email address.');
      } else {
        setForgotSent(true);
      }
    }
    setLoading(false);
  };

  const panel = PANEL_CONTENT[mode];

  return (
    <div className="flex min-h-screen bg-background overflow-hidden font-sans">
      {/* ── Left dark panel ── */}
      <div
        className="hidden lg:flex flex-col w-1/2 shrink-0 p-10 relative overflow-hidden bg-[#0D1117]"
        aria-hidden="true"
      >
        <div className="relative z-10 flex flex-col h-full">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 w-fit hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-serif text-sm">C</span>
            </div>
            <span className="text-white font-['Hedvig_Letters_Serif',_serif] text-base">Connect</span>
          </Link>

          {/* Quote — centered vertically */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="max-w-[320px]">
              <blockquote 
                className="text-white font-bold italic mb-4 text-[28px] leading-[1.25] tracking-tight"
                style={{ fontFamily: 'Georgia, serif' }}
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

      {/* ── Right panel ── */}
      <div className="flex-1 flex items-center justify-center p-8 sm:p-12 lg:p-16 overflow-y-auto bg-background">
        <div className="w-full max-w-[384px]">
          <div className="mb-6">
            <Link to="/" className="lg:hidden inline-flex items-center gap-2 mb-8 text-primary">
               <div className="w-8 h-8 bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-serif text-sm">C</span>
              </div>
              <span className="text-foreground font-['Hedvig_Letters_Serif',_serif] text-base">Connect</span>
            </Link>
            
            <h1 className="text-[26px] font-bold text-foreground mb-1 tracking-tight">
              {mode === 'login' && 'Welcome back'}
              {mode === 'register' && 'Create an account'}
              {mode === 'forgot' && 'Reset password'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {mode === 'login' && 'Sign in to join discussions.'}
              {mode === 'register' && 'Join the conversation today.'}
              {mode === 'forgot' && "We'll send a reset link to your email."}
            </p>
          </div>

          {forgotSent ? (
            <Card className="border-green-100 bg-green-50/50 dark:bg-green-950/10 dark:border-green-900/30 overflow-hidden rounded-xl">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="text-green-600 dark:text-green-400" size={32} />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Check your inbox</h2>
                <p className="text-muted-foreground font-medium mb-8">
                  We've sent a password reset link to <br/>
                  <span className="text-foreground font-bold">{form.email}</span>
                </p>
                <Button 
                  variant="outline" 
                  className="w-full h-10 rounded-[10px] font-semibold"
                  onClick={() => { setMode('login'); setForgotSent(false); }}
                >
                  <ArrowLeft size={16} className="mr-2" /> Back to Sign In
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-5">
              {error && error !== 'registration-success' && (
                <Alert variant="destructive" className="rounded-[10px] border">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle className="font-bold">Error</AlertTitle>
                  <AlertDescription className="font-medium">{error}</AlertDescription>
                </Alert>
              )}

              {error === 'registration-success' && (
                <Alert className="rounded-[10px] border border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle className="font-bold text-green-800">Account created!</AlertTitle>
                  <AlertDescription className="font-medium text-green-700">
                    Your account has been created successfully. Please sign in now to start your onboarding.
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="username" className="font-medium text-sm text-foreground">Username</Label>
                    <Input
                      id="username"
                      name="username"
                      placeholder="johndoe"
                      required
                      value={form.username}
                      onChange={handleChange}
                      className="h-[42px] px-3 rounded-[10px] focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="font-medium text-sm text-foreground">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="name@example.com"
                    required
                    value={form.email}
                    onChange={handleChange}
                    className="h-[42px] px-3 rounded-[10px] focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
                  />
                </div>

                {mode !== 'forgot' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="font-medium text-sm text-foreground">Password</Label>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={form.password}
                        onChange={handleChange}
                        className="h-[42px] pl-3 pr-10 rounded-[10px] focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <Button 
                    type="submit" 
                    className="w-full h-10 rounded-[10px] font-semibold text-sm" 
                    disabled={loading}
                  >
                    {loading ? 'Processing...' : (
                      mode === 'login' ? 'Sign in' : mode === 'register' ? 'Join now' : 'Send Reset Link'
                    )}
                  </Button>
                </div>
              </form>

              <div className="space-y-2 pt-2">
                <p className="text-sm font-normal text-muted-foreground">
                  {mode === 'login' ? (
                    <>
                      New here?{' '}
                      <button
                        onClick={() => setMode('register')}
                        className="text-primary text-base font-medium hover:underline"
                      >
                        Create one
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{' '}
                      <button
                        onClick={() => setMode('login')}
                        className="text-primary text-base font-medium hover:underline"
                      >
                        Sign in
                      </button>
                    </>
                  )}
                </p>

                <Link 
                  to="/" 
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft size={14} />
                  <span>Back home</span>
                </Link>
          </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
