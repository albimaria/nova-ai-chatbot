import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, PanelLeftOpen, Upload } from "lucide-react";

import { chatApi, conversationsApi } from "../../api/client";
import { useChat } from "../../hooks/useChat";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { usePreferences } from "../../state/preferences";
import { useToast } from "../../state/toast";
import ChatHeader from "../chat/ChatHeader";
import Composer from "../chat/Composer";
import MessageList from "../chat/MessageList";
import WelcomeScreen from "../chat/WelcomeScreen";
import SettingsDialog from "../settings/SettingsDialog";
import ShareDialog from "../share/ShareDialog";
import UsageDialog from "../usage/UsageDialog";
import { Spinner } from "../ui/primitives";
import Sidebar from "./Sidebar";

export const SIDEBAR_WIDTH = 288;

function readConversationFromHash() {
  const match = window.location.hash.match(/^#\/c\/([\w-]+)/);
  return match ? match[1] : null;
}

export default function ChatApp({ user, onUserChange, onLogout, onSceneChange }) {
  const { prefs, update } = usePreferences();
  const toast = useToast();
  const mobile = useMediaQuery("(max-width: 900px)");

  const [conversations, setConversations] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [activeId, setActiveId] = useState(readConversationFromHash);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [shareId, setShareId] = useState(null);
  const [webSearchAvailable, setWebSearchAvailable] = useState(false);
  const [dragging, setDragging] = useState(false);

  const composerRef = useRef(null);
  const sidebarOpen = mobile ? mobileSidebar : prefs.sidebarOpen;

  // ---------------- Data ----------------
  useEffect(() => {
    conversationsApi
      .list()
      .then(setConversations)
      .catch((error) => toast.show(error.message, "error"))
      .finally(() => setListLoading(false));

    chatApi
      .models()
      .then((data) => setWebSearchAvailable(Boolean(data.webSearch)))
      .catch(() => {});
  }, [toast]);

  // Keep the URL in sync so refresh / back button work.
  useEffect(() => {
    const target = activeId ? `#/c/${activeId}` : "#/";
    if (window.location.hash !== target) {
      window.history.replaceState(null, "", target);
    }
  }, [activeId]);

  useEffect(() => {
    const onHash = () => {
      if (window.location.hash.startsWith("#/c/") || window.location.hash === "#/") {
        setActiveId(readConversationFromHash());
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const chat = useChat(
    activeId,
    { model: prefs.model, temperature: prefs.temperature, webSearch: prefs.webSearch && webSearchAvailable },
    {
      onConversationStarted: (id) => {
        setActiveId(id);
        const now = new Date().toISOString();
        setConversations((current) => [
          { id, title: "New chat", pinned: false, shared: false, createdAt: now, updatedAt: now },
          ...current,
        ]);
      },
      onConversationTouched: (id, { title }) => {
        setConversations((current) => {
          const existing = current.find((c) => c.id === id);
          if (!existing) return current;
          const updated = {
            ...existing,
            title: title || existing.title,
            updatedAt: new Date().toISOString(),
          };
          return [updated, ...current.filter((c) => c.id !== id)];
        });
      },
      onNotice: (message) => toast.show(message, "info", 5000),
    }
  );

  const activeConversation = conversations.find((c) => c.id === activeId);
  const showWelcome = !activeId && chat.messages.length === 0;

  // Tell the 3D scene what is happening.
  useEffect(() => {
    onSceneChange({
      mode: showWelcome ? "welcome" : "chat",
      busy: chat.streaming,
      offsetPx: sidebarOpen && !mobile ? SIDEBAR_WIDTH / 2 : 0,
    });
  }, [showWelcome, chat.streaming, sidebarOpen, mobile, onSceneChange]);

  useEffect(() => {
    document.title = activeConversation?.title ? `${activeConversation.title} · Nova` : "Nova";
  }, [activeConversation?.title]);

  // ---------------- Actions ----------------
  const newChat = useCallback(() => {
    setActiveId(null);
    setMobileSidebar(false);
    window.setTimeout(() => composerRef.current?.focus(), 0);
  }, []);

  const selectConversation = (id) => {
    setActiveId(id);
    setMobileSidebar(false);
  };

  const patchConversation = (id, fields) =>
    setConversations((current) => current.map((c) => (c.id === id ? { ...c, ...fields } : c)));

  const renameConversation = async (id, title) => {
    const previous = conversations.find((c) => c.id === id)?.title;
    patchConversation(id, { title });
    try {
      await conversationsApi.update(id, { title });
    } catch (error) {
      patchConversation(id, { title: previous });
      toast.show(error.message, "error");
    }
  };

  const togglePin = async (conversation) => {
    const pinned = !conversation.pinned;
    patchConversation(conversation.id, { pinned });
    try {
      await conversationsApi.update(conversation.id, { pinned });
    } catch (error) {
      patchConversation(conversation.id, { pinned: !pinned });
      toast.show(error.message, "error");
    }
  };

  const deleteConversation = async (id) => {
    const snapshot = conversations;
    setConversations((current) => current.filter((c) => c.id !== id));
    if (id === activeId) setActiveId(null);

    try {
      await conversationsApi.remove(id);
      toast.show("Chat deleted.");
    } catch (error) {
      setConversations(snapshot);
      toast.show(error.message, "error");
    }
  };

  const handleFeedback = async (id, value) => {
    try {
      await chat.setFeedback(id, value);
      if (value) toast.show("Thanks for the feedback!");
    } catch (error) {
      toast.show(error.message, "error");
    }
  };

  // ---------------- Keyboard shortcuts ----------------
  useEffect(() => {
    const onKey = (event) => {
      const mod = event.ctrlKey || event.metaKey;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);

      if (mod && event.shiftKey && event.key.toLowerCase() === "o") {
        event.preventDefault();
        newChat();
      } else if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (mobile) setMobileSidebar(true);
        else update({ sidebarOpen: true });
        window.setTimeout(() => document.getElementById("chat-search")?.focus(), 50);
      } else if (event.key === "Escape" && chat.streaming && !document.querySelector("dialog[open]")) {
        chat.stop();
      } else if (event.key === "/" && !typing && !document.querySelector("dialog[open]")) {
        event.preventDefault();
        composerRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newChat, mobile, update, chat]);

  const shareConversation = useMemo(
    () => conversations.find((c) => c.id === shareId) || null,
    [conversations, shareId]
  );

  return (
    <div
      className={`app-shell ${sidebarOpen && !mobile ? "with-sidebar" : ""}`}
      style={{ "--sidebar-width": `${SIDEBAR_WIDTH}px` }}
      onDragEnter={(event) => {
        if (event.dataTransfer?.types?.includes("Files")) setDragging(true);
      }}
    >
      <Sidebar
        open={sidebarOpen}
        mobile={mobile}
        onClose={() => (mobile ? setMobileSidebar(false) : update({ sidebarOpen: false }))}
        conversations={conversations}
        loading={listLoading}
        activeId={activeId}
        user={user}
        onNewChat={newChat}
        onSelect={selectConversation}
        onRename={renameConversation}
        onTogglePin={togglePin}
        onShare={setShareId}
        onDelete={deleteConversation}
        onOpenSettings={() => {
          setMobileSidebar(false);
          setSettingsOpen(true);
        }}
        onOpenUsage={() => {
          setMobileSidebar(false);
          setUsageOpen(true);
        }}
        onLogout={onLogout}
      />

      <main className="chat-main">
        {!sidebarOpen && !mobile && (
          <button
            type="button"
            className="icon-btn floating-open glass"
            onClick={() => update({ sidebarOpen: true })}
            aria-label="Open sidebar"
          >
            <PanelLeftOpen size={19} />
          </button>
        )}

        <ChatHeader
          model={prefs.model}
          onModelChange={(model) => update({ model })}
          title={activeConversation?.title}
          showMenuButton={mobile}
          onOpenSidebar={() => setMobileSidebar(true)}
          onShare={activeId ? () => setShareId(activeId) : null}
        />

        {chat.loading ? (
          <div className="center-fill">
            <Spinner size={28} />
          </div>
        ) : chat.loadError ? (
          <div className="center-fill">
            <div className="load-error glass" role="alert">
              <AlertTriangle size={20} />
              <p>{chat.loadError}</p>
              <button type="button" className="btn btn-primary" onClick={newChat}>
                Start a new chat
              </button>
            </div>
          </div>
        ) : showWelcome ? (
          <WelcomeScreen name={user?.name} onPick={(prompt) => chat.send(prompt)} />
        ) : (
          <MessageList
            messages={chat.messages}
            busy={chat.streaming}
            onEdit={chat.edit}
            onRegenerate={chat.regenerate}
            onRetry={chat.retry}
            onFeedback={handleFeedback}
          />
        )}

        <Composer
          ref={composerRef}
          onSend={chat.send}
          onStop={chat.stop}
          streaming={chat.streaming}
          disabled={chat.loading}
          webSearchAvailable={webSearchAvailable}
          autoFocus={!mobile}
        />

        {dragging && (
          <div
            className="drop-overlay"
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (event.currentTarget === event.target) setDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              composerRef.current?.addFiles(event.dataTransfer.files);
            }}
          >
            <div className="drop-card glass">
              <Upload size={30} />
              <strong>Drop files to attach</strong>
              <span>PDF, images, Word, text and code</span>
            </div>
          </div>
        )}
      </main>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        user={user}
        onUserChange={onUserChange}
        onLogout={onLogout}
        onAllDeleted={() => {
          setConversations([]);
          setActiveId(null);
        }}
      />

      <UsageDialog open={usageOpen} onClose={() => setUsageOpen(false)} />

      <ShareDialog
        key={shareId || "closed"}
        conversation={shareConversation}
        onClose={() => setShareId(null)}
        onChange={patchConversation}
      />
    </div>
  );
}
