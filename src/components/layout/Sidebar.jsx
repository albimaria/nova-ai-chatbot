import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  LogOut,
  MoreHorizontal,
  PanelLeftClose,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Settings,
  Share2,
  Trash2,
  X,
} from "lucide-react";

import { OrbBadge } from "../ui/primitives";

function groupConversations(conversations) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86400000;

  const groups = { Pinned: [], Today: [], Yesterday: [], "Previous 7 days": [], "Previous 30 days": [], Older: [] };

  for (const conversation of conversations) {
    if (conversation.pinned) {
      groups.Pinned.push(conversation);
      continue;
    }

    const time = new Date(conversation.updatedAt || conversation.createdAt || 0).getTime();

    if (time >= startOfToday) groups.Today.push(conversation);
    else if (time >= startOfToday - day) groups.Yesterday.push(conversation);
    else if (time >= startOfToday - 7 * day) groups["Previous 7 days"].push(conversation);
    else if (time >= startOfToday - 30 * day) groups["Previous 30 days"].push(conversation);
    else groups.Older.push(conversation);
  }

  return Object.entries(groups).filter(([, items]) => items.length > 0);
}

function ConversationItem({ conversation, active, onSelect, onRename, onTogglePin, onShare, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(conversation.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setMenuOpen(false);
        setConfirmDelete(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  const commitRename = () => {
    setRenaming(false);
    const value = title.trim();
    if (value && value !== conversation.title) onRename(conversation.id, value);
    else setTitle(conversation.title);
  };

  return (
    <li ref={rootRef} className={`conv-item ${active ? "active" : ""} ${menuOpen ? "menu-open" : ""}`}>
      {renaming ? (
        <input
          className="conv-rename"
          value={title}
          autoFocus
          maxLength={120}
          aria-label="Chat title"
          onChange={(event) => setTitle(event.target.value)}
          onBlur={commitRename}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitRename();
            if (event.key === "Escape") {
              setTitle(conversation.title);
              setRenaming(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="conv-link"
          onClick={() => onSelect(conversation.id)}
          aria-current={active ? "page" : undefined}
          title={conversation.title}
        >
          {conversation.pinned && <Pin size={12} className="conv-pin" aria-label="Pinned" />}
          <span>{conversation.title}</span>
        </button>
      )}

      {!renaming && (
        <button
          type="button"
          className="conv-more"
          aria-label={`Options for ${conversation.title}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MoreHorizontal size={16} />
        </button>
      )}

      {menuOpen && (
        <div className="conv-menu glass" role="menu">
          {confirmDelete ? (
            <>
              <p className="conv-menu-confirm">Delete this chat?</p>
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(conversation.id);
                }}
              >
                <Trash2 size={15} /> Yes, delete
              </button>
              <button type="button" role="menuitem" onClick={() => setConfirmDelete(false)}>
                <X size={15} /> Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setRenaming(true);
                }}
              >
                <Pencil size={15} /> Rename
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onTogglePin(conversation);
                }}
              >
                {conversation.pinned ? <PinOff size={15} /> : <Pin size={15} />}
                {conversation.pinned ? "Unpin" : "Pin"}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onShare(conversation.id);
                }}
              >
                <Share2 size={15} /> Share
              </button>
              <button type="button" role="menuitem" className="danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={15} /> Delete
              </button>
            </>
          )}
        </div>
      )}
    </li>
  );
}

export default function Sidebar({
  open,
  mobile,
  onClose,
  conversations,
  loading,
  activeId,
  user,
  onNewChat,
  onSelect,
  onRename,
  onTogglePin,
  onShare,
  onDelete,
  onOpenSettings,
  onOpenUsage,
  onLogout,
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? conversations.filter((c) => c.title.toLowerCase().includes(q)) : conversations;
  }, [conversations, query]);

  const groups = useMemo(() => groupConversations(filtered), [filtered]);
  const initials = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <>
      {mobile && open && <div className="sidebar-scrim" onClick={onClose} aria-hidden="true" />}

      <aside
        className={`sidebar glass ${open ? "open" : "closed"} ${mobile ? "mobile" : ""}`}
        aria-label="Chats"
        aria-hidden={!open}
        inert={!open ? true : undefined}
      >
        <div className="sidebar-top">
          <div className="brand">
            <OrbBadge size={30} />
            <span className="brand-name">Nova</span>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close sidebar">
            {mobile ? <X size={19} /> : <PanelLeftClose size={19} />}
          </button>
        </div>

        <button type="button" className="new-chat-btn" onClick={onNewChat}>
          <Plus size={18} aria-hidden="true" />
          New chat
          <kbd className="hide-sm">Ctrl Shift O</kbd>
        </button>

        <div className="sidebar-search">
          <Search size={15} aria-hidden="true" />
          <input
            id="chat-search"
            type="search"
            placeholder="Search chats"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search chats"
          />
        </div>

        <nav className="conv-scroll" aria-label="Chat history">
          {loading && conversations.length === 0 && (
            <div className="conv-skeletons" aria-label="Loading chats">
              {Array.from({ length: 6 }, (_, index) => (
                <span key={index} className="skeleton" style={{ width: `${55 + ((index * 17) % 40)}%` }} />
              ))}
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <p className="conv-empty">{query ? "No chats match your search." : "Your chats will appear here."}</p>
          )}

          {groups.map(([label, items]) => (
            <section key={label} className="conv-group">
              <h3>{label}</h3>
              <ul>
                {items.map((conversation) => (
                  <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    active={conversation.id === activeId}
                    onSelect={onSelect}
                    onRename={onRename}
                    onTogglePin={onTogglePin}
                    onShare={onShare}
                    onDelete={onDelete}
                  />
                ))}
              </ul>
            </section>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <span className="avatar" aria-hidden="true">
              {initials}
            </span>
            <span className="user-meta">
              <strong>{user?.name || "Nova user"}</strong>
              <small>{user?.is_guest ? "Demo account" : user?.email}</small>
            </span>
          </div>
          <button type="button" className="icon-btn" onClick={onOpenUsage} aria-label="Usage and limits" title="Usage & limits">
            <BarChart3 size={18} />
          </button>
          <button type="button" className="icon-btn" onClick={onOpenSettings} aria-label="Settings" title="Settings">
            <Settings size={18} />
          </button>
          <button type="button" className="icon-btn" onClick={onLogout} aria-label="Log out" title="Log out">
            <LogOut size={18} />
          </button>
        </div>
      </aside>
    </>
  );
}
