import { lazy, memo, Suspense, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  FileText,
  Globe,
  Image as ImageIcon,
  Pencil,
  RefreshCw,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  VolumeX,
} from "lucide-react";

import { OrbBadge } from "../ui/primitives";
import { isTemp } from "../../hooks/useChat";

// Markdown + KaTeX + syntax highlighting is heavy; load it only once a chat is shown.
const Markdown = lazy(() => import("./Markdown"));

function MarkdownOrText({ content }) {
  return (
    <Suspense fallback={<div className="markdown plain-fallback">{content}</div>}>
      <Markdown content={content} />
    </Suspense>
  );
}

function AttachmentChip({ attachment }) {
  const isImage = attachment.mimeType?.startsWith("image/");
  const Icon = isImage ? ImageIcon : FileText;

  return (
    <span
      className={`attachment-chip ${attachment.expired ? "expired" : ""}`}
      title={attachment.expired ? "This file expired after 48 hours and is no longer sent to Nova" : attachment.displayName}
    >
      <Icon size={14} aria-hidden="true" />
      <span className="attachment-name">{attachment.displayName || attachment.name}</span>
      {attachment.expired && <span className="attachment-flag">expired</span>}
    </span>
  );
}

function ActionButton({ label, onClick, active, children, disabled }) {
  return (
    <button
      type="button"
      className={`msg-action ${active ? "active" : ""}`}
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function stripMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, " code block. ")
    .replace(/[#*_`>|~-]/g, " ")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1");
}

function Message({ message, isLast, readOnly, busy, onEdit, onRegenerate, onRetry, onFeedback }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const editRef = useRef(null);

  const isUser = message.role === "user";
  const serverSaved = !isTemp(message.id);

  useEffect(() => {
    if (editing && editRef.current) {
      const element = editRef.current;
      element.focus();
      element.setSelectionRange(element.value.length, element.value.length);
      element.style.height = "auto";
      element.style.height = `${element.scrollHeight}px`;
    }
  }, [editing]);

  useEffect(() => () => speaking && window.speechSynthesis?.cancel(), [speaking]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked.
    }
  };

  const speak = () => {
    const synth = window.speechSynthesis;
    if (!synth) return;

    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(stripMarkdown(message.content));
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(utterance);
    setSpeaking(true);
  };

  const saveEdit = () => {
    const text = draft.trim();
    if (!text) return;
    setEditing(false);
    if (text !== message.content) onEdit(message.id, text);
  };

  if (isUser) {
    return (
      <article className="message message-user" aria-label="Your message">
        <div className="user-stack">
          {message.attachments?.length > 0 && (
            <div className="attachment-row">
              {message.attachments.map((attachment, index) => (
                <AttachmentChip key={attachment.id || index} attachment={attachment} />
              ))}
            </div>
          )}

          {editing ? (
            <div className="edit-box glass">
              <textarea
                ref={editRef}
                value={draft}
                aria-label="Edit your message"
                onChange={(event) => {
                  setDraft(event.target.value);
                  event.target.style.height = "auto";
                  event.target.style.height = `${event.target.scrollHeight}px`;
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    saveEdit();
                  }
                  if (event.key === "Escape") {
                    setEditing(false);
                    setDraft(message.content);
                  }
                }}
              />
              <div className="edit-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setEditing(false);
                    setDraft(message.content);
                  }}
                >
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={saveEdit} disabled={!draft.trim()}>
                  Save & send
                </button>
              </div>
            </div>
          ) : (
            message.content && <div className="bubble-user">{message.content}</div>
          )}

          {!readOnly && !editing && (
            <div className="msg-actions msg-actions-user">
              <ActionButton label="Copy message" onClick={copy}>
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </ActionButton>
              <ActionButton
                label="Edit message"
                onClick={() => {
                  setDraft(message.content);
                  setEditing(true);
                }}
                disabled={busy || !serverSaved}
              >
                <Pencil size={15} />
              </ActionButton>
            </div>
          )}
        </div>
      </article>
    );
  }

  const waiting = message.streaming && !message.content;

  return (
    <article className="message message-assistant" aria-label="Nova's reply" aria-busy={message.streaming}>
      <div className="assistant-avatar">
        <OrbBadge size={30} busy={message.streaming} />
      </div>

      <div className="assistant-body">
        {waiting ? (
          <div className="thinking" aria-label="Nova is thinking">
            <span />
            <span />
            <span />
            <em>Thinking…</em>
          </div>
        ) : (
          <div className={message.streaming ? "streaming" : ""}>
            <MarkdownOrText content={message.content} />
          </div>
        )}

        {message.stopped && <p className="msg-note">Stopped.</p>}

        {message.error && (
          <div className="msg-error" role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{message.error}</span>
            {!readOnly && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRetry(message.id)} disabled={busy}>
                <RotateCcw size={14} /> Retry
              </button>
            )}
          </div>
        )}

        {message.sources?.length > 0 && (
          <div className="sources">
            <span className="sources-label">
              <Globe size={13} /> Sources
            </span>
            {message.sources.map((source, index) => (
              <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="source-chip">
                <span>{index + 1}</span>
                {source.title}
              </a>
            ))}
          </div>
        )}

        {!message.streaming && !message.error && message.content && (
          <div className="msg-actions">
            <ActionButton label={copied ? "Copied" : "Copy reply"} onClick={copy}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </ActionButton>

            {"speechSynthesis" in window && (
              <ActionButton label={speaking ? "Stop reading" : "Read aloud"} onClick={speak}>
                {speaking ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </ActionButton>
            )}

            {!readOnly && serverSaved && (
              <>
                <ActionButton
                  label="Good response"
                  active={message.feedback === "up"}
                  onClick={() => onFeedback(message.id, message.feedback === "up" ? null : "up")}
                >
                  <ThumbsUp size={15} />
                </ActionButton>
                <ActionButton
                  label="Bad response"
                  active={message.feedback === "down"}
                  onClick={() => onFeedback(message.id, message.feedback === "down" ? null : "down")}
                >
                  <ThumbsDown size={15} />
                </ActionButton>
                {isLast && (
                  <ActionButton label="Regenerate" onClick={() => onRegenerate(message.id)} disabled={busy}>
                    <RefreshCw size={15} />
                  </ActionButton>
                )}
              </>
            )}

            {message.model && <span className="msg-model">{message.model}</span>}
          </div>
        )}
      </div>
    </article>
  );
}

export default memo(Message);
