import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import toast from "react-hot-toast";
import logo from "@/assets/samsons-logo.png";

const friendly = (msg: string) => {
  if (/invalid login credentials/i.test(msg)) return "Email or password is incorrect";
  if (/email not confirmed/i.test(msg)) return "Please ask your administrator to verify your account";
  return msg;
};

export default function LoginPage() {
  const { signIn, profile, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Once profile loads after sign-in, redirect by role.
  useEffect(() => {
    if (user && profile) {
      navigate(profile.role === "client" ? "/client" : "/dashboard", { replace: true });
    }
  }, [user, profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: err } = await signIn(email, password);
    setBusy(false);
    if (err) setError(friendly(err));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-xl shadow-xl p-8">
          <div className="text-center mb-6">
            <img src={logo} alt="Samsons Farms" className="h-24 w-24 mx-auto object-contain mb-2" />
            <h1 className="text-2xl font-bold">SamsonAgri</h1>
            <p className="text-sm text-muted-foreground mt-1">Land Deal Management</p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-sm flex gap-2 items-start">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Toggle password visibility"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in…</> : "Sign In"}
            </Button>
            <button
              type="button"
              onClick={() => toast("Contact your administrator", { icon: "ℹ️" })}
              className="block w-full text-center text-xs text-muted-foreground hover:text-foreground mt-2"
            >
              Forgot password?
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-4">© SamsonAgri</p>
      </div>
    </div>
  );
}
