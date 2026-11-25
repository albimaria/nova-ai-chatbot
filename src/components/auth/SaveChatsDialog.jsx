import { useState } from "react";
import { Lock, Mail, User } from "lucide-react";

import { authApi, tokenStore } from "../../api/client";
import { useToast } from "../../state/toast";
import { Dialog, Spinner } from "../ui/primitives";

/** Turns the current demo account into a real account, keeping its chats. */
export default function SaveChatsDialog({ open, onClose, onSaved }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }

    setBusy(true);

    try {
      const data = await authApi.claim(email, password, name.trim());
      tokenStore.set(data.access_token);
      onSaved({ user_id: data.user_id, email: data.email, name: data.name, is_guest: false });
      toast.show("Account created. Your chats are saved.");
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Save your chats" size="sm">
      <p className="dialog-text">
        Create an account to keep this demo's conversations. Sign in later with this email to pick up
        where you left off.
      </p>

      <form className="auth-form" onSubmit={submit}>
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
            type="password"
            autoComplete="new-password"
            placeholder="Password (8+ characters)"
            aria-label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy && <Spinner />} Create account &amp; keep chats
        </button>
      </form>
    </Dialog>
  );
}
