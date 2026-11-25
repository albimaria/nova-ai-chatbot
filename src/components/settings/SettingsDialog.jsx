import { useState } from "react";
import { Database, Monitor, Moon, SlidersHorizontal, Sparkles, Sun, User } from "lucide-react";

import { authApi, conversationsApi } from "../../api/client";
import { usePreferences } from "../../state/preferences";
import { useToast } from "../../state/toast";
import { Dialog, Spinner } from "../ui/primitives";

const TABS = [
  { id: "general", label: "General", icon: Monitor },
  { id: "personal", label: "Personalization", icon: Sparkles },
  { id: "model", label: "Model", icon: SlidersHorizontal },
  { id: "data", label: "Data", icon: Database },
  { id: "account", label: "Account", icon: User },
];

function Switch({ checked, onChange, label, description, id }) {
  return (
    <div className="setting-row">
      <div>
        <label htmlFor={id}>{label}</label>
        {description && <small>{description}</small>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        className={`switch ${checked ? "on" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  );
}

function GeneralTab() {
  const { prefs, update } = usePreferences();
  const themes = [
    { id: "dark", label: "Dark", icon: Moon },
    { id: "light", label: "Light", icon: Sun },
    { id: "system", label: "System", icon: Monitor },
  ];

  return (
    <>
      <div className="setting-block">
        <span className="setting-label">Theme</span>
        <div className="theme-cards" role="radiogroup" aria-label="Theme">
          {themes.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={prefs.theme === id}
              className={`theme-card ${id} ${prefs.theme === id ? "selected" : ""}`}
              onClick={() => update({ theme: id })}
            >
              <span className="theme-preview" aria-hidden="true">
                <i />
                <i />
              </span>
              <span>
                <Icon size={14} /> {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <Switch
        id="pref-motion"
        label="3D motion"
        description="Animate the 3D background and effects. Turn off to save battery."
        checked={prefs.motion}
        onChange={(motion) => update({ motion })}
      />
      <Switch
        id="pref-enter"
        label="Enter to send"
        description={prefs.enterToSend ? "Shift + Enter adds a new line." : "Use Ctrl + Enter to send."}
        checked={prefs.enterToSend}
        onChange={(enterToSend) => update({ enterToSend })}
      />

      <div className="setting-block">
        <span className="setting-label">Keyboard shortcuts</span>
        <dl className="shortcuts">
          <dt>New chat</dt>
          <dd>
            <kbd>Ctrl</kbd> <kbd>Shift</kbd> <kbd>O</kbd>
          </dd>
          <dt>Search chats</dt>
          <dd>
            <kbd>Ctrl</kbd> <kbd>K</kbd>
          </dd>
          <dt>Focus message box</dt>
          <dd>
            <kbd>/</kbd>
          </dd>
          <dt>Stop generating</dt>
          <dd>
            <kbd>Esc</kbd>
          </dd>
        </dl>
      </div>
    </>
  );
}

function PersonalTab({ user, onUserChange }) {
  const toast = useToast();
  const [name, setName] = useState(user?.name || "");
  const [instructions, setInstructions] = useState(user?.custom_instructions || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await authApi.updateProfile({ name, custom_instructions: instructions });
      onUserChange(updated);
      toast.show("Saved. Nova will use this in new replies.");
    } catch (error) {
      toast.show(error.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="field">
        <label htmlFor="pref-name">What should Nova call you?</label>
        <input id="pref-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
      </div>
      <div className="field">
        <label htmlFor="pref-instructions">Custom instructions</label>
        <small>
          Tell Nova about yourself and how you'd like it to respond, e.g. "I'm a student learning React. Keep
          answers short and use examples."
        </small>
        <textarea
          id="pref-instructions"
          rows={6}
          maxLength={4000}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
        <small className="field-count">{instructions.length} / 4000</small>
      </div>
      <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
        {saving && <Spinner />} Save
      </button>
    </>
  );
}

function ModelTab() {
  const { prefs, update } = usePreferences();
  const label = prefs.temperature < 0.4 ? "Precise" : prefs.temperature > 1.1 ? "Creative" : "Balanced";

  return (
    <>
      <div className="field">
        <label htmlFor="pref-temperature">
          Creativity <span className="badge">{label}</span>
        </label>
        <small>Lower is more focused and predictable; higher is more varied and imaginative.</small>
        <input
          id="pref-temperature"
          type="range"
          min="0"
          max="1.5"
          step="0.1"
          value={prefs.temperature}
          onChange={(e) => update({ temperature: Number(e.target.value) })}
          aria-valuetext={`${prefs.temperature} (${label})`}
        />
        <div className="range-labels" aria-hidden="true">
          <span>Precise</span>
          <span>Balanced</span>
          <span>Creative</span>
        </div>
      </div>
      <p className="dialog-text">
        Choose between <strong>Nova Fast</strong>, <strong>Standard</strong> and <strong>Reasoning</strong> from the
        menu at the top of the chat.
      </p>
    </>
  );
}

function DataTab({ onAllDeleted }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const exportData = async () => {
    setBusy(true);
    try {
      const data = await authApi.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `nova-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.show(error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const deleteAll = async () => {
    setBusy(true);
    try {
      const result = await conversationsApi.removeAll();
      onAllDeleted();
      toast.show(`Deleted ${result.deleted} chats.`);
      setConfirming(false);
    } catch (error) {
      toast.show(error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="setting-row">
        <div>
          <span className="setting-title">Export data</span>
          <small>Download your profile and all chats as a JSON file.</small>
        </div>
        <button type="button" className="btn btn-ghost" onClick={exportData} disabled={busy}>
          Export
        </button>
      </div>
      <div className="setting-row">
        <div>
          <span className="setting-title">Delete all chats</span>
          <small>This can't be undone.</small>
        </div>
        {confirming ? (
          <div className="row-gap">
            <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" onClick={deleteAll} disabled={busy}>
              Delete all
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-ghost btn-danger-text" onClick={() => setConfirming(true)}>
            Delete all
          </button>
        )}
      </div>
    </>
  );
}

function AccountTab({ user, onLogout }) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const changePassword = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await authApi.changePassword(current, next);
      setCurrent("");
      setNext("");
      toast.show("Password updated.");
    } catch (error) {
      toast.show(error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await authApi.deleteAccount(deletePassword);
      toast.show("Your account was deleted.");
      onLogout();
    } catch (error) {
      toast.show(error.message, "error");
      setBusy(false);
    }
  };

  return (
    <>
      <div className="setting-row">
        <div>
          <span className="setting-title">Email</span>
          <small>{user?.email}</small>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onLogout}>
          Log out
        </button>
      </div>

      <form className="setting-block" onSubmit={changePassword}>
        <span className="setting-label">Change password</span>
        <div className="field-row">
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Current password"
            aria-label="Current password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="New password (8+ characters)"
            aria-label="New password"
            minLength={8}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Update
          </button>
        </div>
      </form>

      <div className="setting-block danger-zone">
        <span className="setting-label">Delete account</span>
        <small>Permanently deletes your account and all chats.</small>
        {showDelete ? (
          <form className="field-row" onSubmit={deleteAccount}>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Confirm with your password"
              aria-label="Password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-danger" disabled={busy}>
              Delete forever
            </button>
          </form>
        ) : (
          <button type="button" className="btn btn-ghost btn-danger-text" onClick={() => setShowDelete(true)}>
            Delete my account
          </button>
        )}
      </div>
    </>
  );
}

export default function SettingsDialog({ open, onClose, user, onUserChange, onLogout, onAllDeleted }) {
  const [tab, setTab] = useState("general");

  return (
    <Dialog open={open} onClose={onClose} title="Settings" size="lg">
      <div className="settings">
        <div className="settings-tabs" role="tablist" aria-orientation="vertical">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`panel-${id}`}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              <Icon size={16} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="settings-panel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === "general" && <GeneralTab />}
          {tab === "personal" && <PersonalTab user={user} onUserChange={onUserChange} />}
          {tab === "model" && <ModelTab />}
          {tab === "data" && <DataTab onAllDeleted={onAllDeleted} />}
          {tab === "account" && <AccountTab user={user} onLogout={onLogout} />}
        </div>
      </div>
    </Dialog>
  );
}
