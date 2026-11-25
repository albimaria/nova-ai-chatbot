import { useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail, Sparkles, User } from "lucide-react";

import { authApi, tokenStore } from "../../api/client";
import { OrbBadge, Spinner } from "../ui/primitives";

export default function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  const isSignup = mode === "signup";

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (isSignup && password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }

    setLoading(true);

    try {
      const data = isSignup
        ? await authApi.signup(email, password, name.trim())
        : await authApi.login(email, password);

      tokenStore.set(data.access_token);
      onAuthenticated({ user_id: data.user_id, email: data.email, name: data.name });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const tryDemo = async () => {
    setError("");
    setGuestLoading(true);

    try {
      const data = await authApi.guest();
      tokenStore.set(data.access_token);
      onAuthenticated({ user_id: data.user_id, email: data.email, name: data.name, is_guest: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setGuestLoading(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setError("");
  };

  return (
    <main className="auth-page">
      <section className="auth-hero" aria-hidden="true">
        <div className="auth-hero-text">
          <span className="eyebrow">Your AI companion</span>
          <h2>
            Think deeper.
            <br />
            <span className="gradient-text">Create faster.</span>
          </h2>
          <p>Ask anything, analyse files, write code and plan ideas with Nova.</p>
        </div>
      </section>

      <section className="auth-card glass" aria-labelledby="auth-title">
        <div className="auth-brand">
          <OrbBadge size={44} />
          <div>
            <h1 id="auth-title">{isSignup ? "Create your account" : "Welcome back"}</h1>
            <p>{isSignup ? "Start chatting with Nova in seconds." : "Log in to continue to Nova."}</p>
          </div>
        </div>

        <button type="button" className="demo-btn" onClick={tryDemo} disabled={guestLoading || loading}>
          {guestLoading ? <Spinner /> : <Sparkles size={18} aria-hidden="true" />}
          <span>
            <strong>Try the demo</strong>
            <small>No sign-up needed · instant access</small>
          </span>
          <ArrowRight size={17} aria-hidden="true" />
        </button>

        <div className="auth-divider" role="separator">
          <span>or use your account</span>
        </div>

        <div className="auth-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={!isSignup} className={!isSignup ? "active" : ""} onClick={() => switchMode("login")}>
            Log in
          </button>
          <button type="button" role="tab" aria-selected={isSignup} className={isSignup ? "active" : ""} onClick={() => switchMode("signup")}>
            Sign up
          </button>
          <span className={`auth-tab-indicator ${isSignup ? "right" : ""}`} aria-hidden="true" />
        </div>

        <form onSubmit={submit} className="auth-form" noValidate={false}>
          {isSignup && (
            <div className="input-icon">
              <User size={17} aria-hidden="true" />
              <input
                type="text"
                autoComplete="name"
                placeholder="Your name (optional)"
                aria-label="Your name"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          <div className="input-icon">
            <Mail size={17} aria-hidden="true" />
            <input
              type="email"
              autoComplete="email"
              placeholder="Email address"
              aria-label="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-icon">
            <Lock size={17} aria-hidden="true" />
            <input
              type={showPassword ? "text" : "password"}
              autoComplete={isSignup ? "new-password" : "current-password"}
              placeholder={isSignup ? "Password (8+ characters)" : "Password"}
              aria-label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="input-suffix"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? <Spinner /> : null}
            {isSignup ? "Create account" : "Log in"}
            {!loading && <ArrowRight size={17} />}
          </button>
        </form>

        <p className="auth-foot">
          By continuing you agree to use Nova responsibly. Nova can make mistakes; check important information.
        </p>
      </section>
    </main>
  );
}
