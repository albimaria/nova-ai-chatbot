import { useEffect, useState } from "react";
import { Check, Copy, Link2, Link2Off } from "lucide-react";

import { conversationsApi } from "../../api/client";
import { useToast } from "../../state/toast";
import { Dialog, Spinner } from "../ui/primitives";

function shareUrl(token) {
  return `${window.location.origin}${import.meta.env.BASE_URL}#/share/${token}`;
}

export default function ShareDialog({ conversation, onClose, onChange }) {
  const toast = useToast();
  const [token, setToken] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const open = Boolean(conversation);

  // The parent remounts this dialog per chat (key), so state starts fresh each time.
  const conversationId = conversation?.id;
  const alreadyShared = conversation?.shared;

  useEffect(() => {
    if (!conversationId || !alreadyShared) return;

    // Fetch the existing token (sharing is idempotent).
    conversationsApi
      .share(conversationId)
      .then((data) => setToken(data.shareToken))
      .catch((error) => toast.show(error.message, "error"));
  }, [conversationId, alreadyShared, toast]);

  const create = async () => {
    setBusy(true);
    try {
      const data = await conversationsApi.share(conversation.id);
      setToken(data.shareToken);
      onChange(conversation.id, { shared: true });
    } catch (error) {
      toast.show(error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    setBusy(true);
    try {
      await conversationsApi.unshare(conversation.id);
      setToken(null);
      onChange(conversation.id, { shared: false });
      toast.show("Link deleted. The chat is private again.");
    } catch (error) {
      toast.show(error.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(token));
      setCopied(true);
      toast.show("Link copied");
    } catch {
      toast.show("Couldn't copy. Select the link and copy it manually.", "error");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Share chat" size="sm">
      <p className="dialog-text">
        Anyone with the link can read <strong>{conversation?.title}</strong>, including messages you
        add later. Your name and files are not shown.
      </p>

      {token ? (
        <>
          <div className="share-link">
            <Link2 size={16} aria-hidden="true" />
            <input readOnly value={shareUrl(token)} aria-label="Share link" onFocus={(e) => e.target.select()} />
            <button type="button" className="btn btn-primary btn-sm" onClick={copy}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button type="button" className="btn btn-ghost btn-danger-text" onClick={revoke} disabled={busy}>
            <Link2Off size={15} /> Delete link
          </button>
        </>
      ) : (
        <button type="button" className="btn btn-primary btn-block" onClick={create} disabled={busy}>
          {busy ? <Spinner /> : <Link2 size={16} />} Create public link
        </button>
      )}
    </Dialog>
  );
}
