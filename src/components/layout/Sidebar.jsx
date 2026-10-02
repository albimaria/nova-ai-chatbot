import { useEffect, useRef, useState } from "react";

import {
  MessageSquarePlus,
  MessageSquare,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  User,
  LogOut,
  MoreHorizontal,
} from "lucide-react";

function Sidebar({
  collapsed,
  setCollapsed,
  conversations,
  activeConversation,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onOpenSettings,
  onLogout,
}) {

  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(null);
  const [menuPlacement, setMenuPlacement] = useState("above");
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const sidebarRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target)
      ) {
        setMenuOpen(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  /* ========================================
     TIME FORMAT
  ======================================== */

  const formatRelativeTime = (dateString) => {
    if (!dateString) {
      return "";
    }

    const date = new Date(dateString);
    const now = new Date();

    const difference =
      now.getTime() - date.getTime();

    const seconds = Math.floor(
      difference / 1000
    );

    const minutes = Math.floor(
      seconds / 60
    );

    const hours = Math.floor(
      minutes / 60
    );

    const days = Math.floor(
      hours / 24
    );

    if (seconds < 60) {
      return "Just now";
    }

    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    if (hours < 24) {
      return `${hours}h ago`;
    }

    if (days === 1) {
      return "Yesterday";
    }

    if (days < 7) {
      return `${days}d ago`;
    }

    return date.toLocaleDateString(
      "en-IN",
      {
        day: "numeric",
        month: "short",
      }
    );
  };

  /* ========================================
     GROUP NAME
  ======================================== */

  const getGroupName = (dateString) => {
    if (!dateString) {
      return "OLDER";
    }

    const date = new Date(dateString);
    const now = new Date();

    const startOfToday =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );

    const startOfYesterday =
      new Date(
        startOfToday.getTime() -
        24 * 60 * 60 * 1000
      );

    const sevenDaysAgo =
      new Date(
        startOfToday.getTime() -
        7 * 24 * 60 * 60 * 1000
      );

    if (date >= startOfToday) {
      return "TODAY";
    }

    if (date >= startOfYesterday) {
      return "YESTERDAY";
    }

    if (date >= sevenDaysAgo) {
      return "PREVIOUS 7 DAYS";
    }

    return "OLDER";
  };

  /* ========================================
     FILTER + SORT
  ======================================== */

  const filteredConversations =
    [...conversations]
      .filter((conversation) =>
        conversation.title
          .toLowerCase()
          .includes(
            search.toLowerCase()
          )
      )
      .sort((a, b) => {
        const dateA = new Date(
          a.updatedAt ||
          a.createdAt ||
          0
        ).getTime();

        const dateB = new Date(
          b.updatedAt ||
          b.createdAt ||
          0
        ).getTime();

        return dateB - dateA;
      });

  /* ========================================
     GROUP CONVERSATIONS
  ======================================== */

  const groupedConversations = {
    TODAY: [],
    YESTERDAY: [],
    "PREVIOUS 7 DAYS": [],
    OLDER: [],
  };

  filteredConversations.forEach(
    (conversation) => {
      const date =
        conversation.updatedAt ||
        conversation.createdAt;

      const group =
        getGroupName(date);

      groupedConversations[
        group
      ].push(conversation);
    }
  );

  const groupOrder = [
    "TODAY",
    "YESTERDAY",
    "PREVIOUS 7 DAYS",
    "OLDER",
  ];

  /* ========================================
     RENAME
  ======================================== */

  const saveRename = (
    conversation
  ) => {
    const title =
      editingTitle.trim();

    if (title) {
      onRenameConversation(
        conversation.id,
        title
      );
    }

    setEditingId(null);
    setEditingTitle("");
  };

  /* ========================================
     RENDER CONVERSATION
  ======================================== */

  const renderConversation = (
    conversation
  ) => {
    const isEditing =
      editingId ===
      conversation.id;

    const isActive =
      activeConversation ===
      conversation.id;

    return (
      <div
        className={`conversation-wrapper nova-conversation-wrapper ${isActive
          ? "active nova-active"
          : ""
          }`}
        key={conversation.id}
      >
        {isEditing ? (
          <input
            className="conversation-edit-input nova-edit-input"
            value={editingTitle}
            autoFocus
            onChange={(event) =>
              setEditingTitle(
                event.target.value
              )
            }
            onKeyDown={(event) => {
              if (
                event.key === "Enter"
              ) {
                event.preventDefault();

                saveRename(
                  conversation
                );
              }

              if (
                event.key === "Escape"
              ) {
                setEditingId(null);
                setEditingTitle("");
              }
            }}
            onBlur={() =>
              saveRename(
                conversation
              )
            }
          />
        ) : (
          <>
            {isActive && (
              <span
                className="nova-active-glow"
                aria-hidden="true"
              />
            )}

            <button
              type="button"
              className="conversation-item nova-conversation-item"
              onClick={() =>
                onSelectConversation(
                  conversation.id
                )
              }
            >
              <MessageSquare
                size={15}
              />

              <div className="conversation-content">
                <span className="conversation-title">
                  {
                    conversation.title
                  }
                </span>

                <span className="conversation-time">
                  {formatRelativeTime(
                    conversation.updatedAt ||
                    conversation.createdAt
                  )}
                </span>
              </div>
            </button>

            <button
              type="button"
              className="conversation-menu-button nova-menu-trigger"
              onClick={(event) => {
                event.stopPropagation();

                if (menuOpen === conversation.id) {
                  setMenuOpen(null);
                  return;
                }

                const buttonRect =
                  event.currentTarget.getBoundingClientRect();

                const menuHeight = 85;
                const spaceAbove = buttonRect.top;
                const spaceBelow =
                  window.innerHeight - buttonRect.bottom;

                if (
                  spaceBelow >= menuHeight + 12 ||
                  spaceBelow > spaceAbove
                ) {
                  setMenuPlacement("below");
                } else {
                  setMenuPlacement("above");
                }

                setMenuOpen(conversation.id);
              }}
              title="Conversation options"
            >
              <MoreHorizontal
                size={15}
              />
            </button>

            {menuOpen ===
              conversation.id && (
                <div
                  className={`conversation-menu nova-menu ${menuPlacement === "below"
                    ? "nova-menu-below"
                    : "nova-menu-above"
                    }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(
                        conversation.id
                      );

                      setEditingTitle(
                        conversation.title
                      );

                      setMenuOpen(null);
                    }}
                  >
                    Rename
                  </button>

                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      onDeleteConversation(
                        conversation.id
                      );

                      setMenuOpen(null);
                    }}
                  >
                    Delete
                  </button>
                </div>
              )}
          </>
        )}
      </div>
    );
  };

  return (
    <aside
      ref={sidebarRef}
      className={`sidebar nova-sidebar ${collapsed ? "collapsed" : ""}`}
    >
      {/*
        Scoped, component-local styles only. index.css is left untouched.
        Every rule reads color from the existing theme variables
        (--app-bg, --surface, --surface-soft, --surface-hover, --text,
        --text-primary, --text-secondary, --text-muted, --border,
        --accent, --accent-bright, --accent-soft) so light and dark
        theming keep working with no second color system.
      */}
      <style>{`
        .nova-sidebar {
          animation: novaSidebarIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .nova-sidebar,
          .nova-new-chat,
          .nova-conversation-wrapper,
          .nova-menu,
          .nova-active-glow {
            animation: none !important;
          }
        }

        /* ---------- brand ---------- */

        .nova-brand-icon {
          position: relative;
          display: grid;
          place-items: center;
        }

        .nova-brand-dot {
          position: absolute;
          bottom: -1px;
          right: -1px;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--accent-bright, var(--accent));
          border: 1.5px solid var(--sidebar, var(--app-bg));
          box-shadow: 0 0 6px 1px var(--accent-soft);
        }

        .nova-brand-name {
          position: relative;
        }

        /* ---------- new chat ---------- */

        .nova-new-chat {
          position: relative;
          overflow: hidden;
          transition:
            transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
            box-shadow 0.25s ease,
            border-color 0.25s ease;
        }

        .nova-new-chat::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, transparent, var(--accent-soft), transparent);
          opacity: 0;
          transform: translateX(-60%);
          transition: opacity 0.3s ease, transform 0.6s ease;
          pointer-events: none;
        }

        .nova-new-chat:hover {
          transform: translateY(-1px);
        }

        .nova-new-chat:hover::before {
          opacity: 1;
          transform: translateX(60%);
        }

        .nova-new-chat:active {
          transform: translateY(0) scale(0.98);
        }

        /* ---------- search ---------- */

        .nova-search {
          transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease,
            background 0.2s ease;
        }

        .nova-search:focus-within {
          box-shadow: 0 0 0 3px var(--accent-soft);
        }

        /* ---------- conversation rows ---------- */

        .nova-conversation-wrapper {
          position: relative;
          animation: novaRowIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
          transition: background 0.18s ease;
        }

        .nova-active-glow {
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 60%;
          border-radius: 3px;
          background: var(--accent-bright, var(--accent));
          box-shadow: 0 0 8px 1px var(--accent-soft);
          pointer-events: none;
        }

        .nova-conversation-item {
          transition:
            background 0.18s ease,
            color 0.18s ease,
            padding-left 0.18s ease;
        }

        .nova-conversation-wrapper:hover .nova-conversation-item {
          padding-left: 12px;
        }

        .nova-menu-trigger {
          transition: opacity 0.15s ease, background 0.15s ease, color 0.15s ease;
        }

        /* ---------- menu ---------- */

        /* ---------- conversation menu ---------- */

.nova-menu {
  position: absolute !important;

  right: 8px !important;

  top: auto !important;
  bottom: auto !important;

  width: 145px !important;
  padding: 5px !important;

  box-sizing: border-box;

  z-index: 99999 !important;

  background: var(--surface) !important;
  color: var(--text-primary);

  border: 1px solid var(--border);
  border-radius: 12px;

  box-shadow:
    0 16px 35px rgba(0, 0, 0, 0.28),
    0 4px 12px rgba(0, 0, 0, 0.16);

  backdrop-filter: blur(16px);

  animation:
    novaMenuIn 0.16s
    cubic-bezier(0.16, 1, 0.3, 1)
    both;
}

/* Open downward when there is not enough room above */

.nova-menu.nova-menu-below {
  top: calc(100% + 6px) !important;
}

/* Open upward when there is enough room */

.nova-menu.nova-menu-above {
  bottom: calc(100% + 6px) !important;
}

.nova-menu button {
  position: relative;
  z-index: 2;

  width: 100%;
  min-height: 34px;

  display: flex;
  align-items: center;

  padding: 8px 10px;

  border-radius: 8px;

  background: transparent;
  color: var(--text-primary);

  text-align: left;

  cursor: pointer;

  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.nova-menu button:hover {
  background: var(--surface-hover);
}

.nova-menu button.danger {
  color: #e06b78;
}

.nova-menu button.danger:hover {
  background: rgba(224, 107, 120, 0.1);
}

        /* ---------- edit input ---------- */

        .nova-edit-input {
          box-shadow: 0 0 0 3px var(--accent-soft);
        }

        /* ---------- bottom / profile ---------- */

        .nova-sidebar .sidebar-bottom {
          position: relative;
        }

        .nova-sidebar .sidebar-item {
          transition:
            background 0.18s ease,
            color 0.18s ease,
            transform 0.15s ease;
        }

        .nova-sidebar .sidebar-item:active {
          transform: scale(0.98);
        }

        .nova-avatar-ring {
          box-shadow: 0 0 0 1px var(--border), 0 0 0 3px transparent;
          transition: box-shadow 0.2s ease;
        }

        .nova-sidebar .profile:hover .nova-avatar-ring {
          box-shadow: 0 0 0 1px var(--border), 0 0 0 3px var(--accent-soft);
        }

        /* ---------- keyframes ---------- */

        @keyframes novaSidebarIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }

        @keyframes novaRowIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes novaMenuIn {
          from { opacity: 0; transform: translateY(-4px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* ========================================
          BRAND
      ======================================== */}

      <div className="sidebar-top">
        <div className="brand">
          <div className="brand-icon nova-brand-icon">
            N
            <span className="nova-brand-dot" aria-hidden="true" />
          </div>

          {!collapsed && (
            <span className="brand-name nova-brand-name">
              Nova
            </span>
          )}
        </div>

        {!collapsed && (
          <button
            type="button"
            className="icon-button"
            onClick={() =>
              setCollapsed(
                !collapsed
              )
            }
            title="Collapse sidebar"
          >
            <PanelLeftClose
              size={19}
            />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          type="button"
          className="icon-button"
          onClick={() =>
            setCollapsed(
              !collapsed
            )
          }
          title="Open sidebar"
          style={{
            margin: "-10px auto 14px",
          }}
        >
          <PanelLeftOpen
            size={19}
          />
        </button>
      )}

      {/* ========================================
          NEW CHAT
      ======================================== */}

      <button
        type="button"
        className="new-chat-button nova-new-chat"
        onClick={onNewChat}
        title="New chat"
      >
        <MessageSquarePlus
          size={17}
        />

        {!collapsed && (
          <span>New chat</span>
        )}
      </button>

      {/* ========================================
          SEARCH
      ======================================== */}

      {!collapsed && (
        <div className="sidebar-search nova-search">
          <Search size={15} />

          <input
            type="text"
            placeholder="Search chats"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
          />

          {search && (
            <button
              type="button"
              className="search-clear"
              onClick={() =>
                setSearch("")
              }
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* ========================================
          HISTORY
      ======================================== */}

      {!collapsed && (
        <div className="history-section">

          {conversations.length >
            0 && (
              <div className="history-total">
                {conversations.length}{" "}
                conversation
                {conversations.length === 1
                  ? ""
                  : "s"}
              </div>
            )}

          {filteredConversations.length ===
            0 ? (
            <div className="empty-history">
              <MessageSquare
                size={18}
              />

              <span>
                {search
                  ? "No chats found"
                  : "No conversations yet"}
              </span>

              <small>
                {search
                  ? "Try a different search"
                  : "Start a new chat to see it here"}
              </small>
            </div>
          ) : (
            groupOrder.map(
              (group) => {
                const groupItems =
                  groupedConversations[
                  group
                  ];

                if (
                  groupItems.length ===
                  0
                ) {
                  return null;
                }

                return (
                  <div
                    className="history-group"
                    key={group}
                  >
                    <div className="history-group-title">
                      {group}
                    </div>

                    {groupItems.map(
                      (
                        conversation
                      ) =>
                        renderConversation(
                          conversation
                        )
                    )}
                  </div>
                );
              }
            )
          )}
        </div>
      )}

      {collapsed && <div className="history-section" />}

      {/* ========================================
          BOTTOM
      ======================================== */}

      <div className="sidebar-bottom">

        <button
          type="button"
          className="sidebar-item"
          onClick={
            onOpenSettings
          }
          title="Settings"
        >

          <Settings size={17} />

          {!collapsed && (
            <span>Settings</span>
          )}

        </button>


        <button
          type="button"
          className="sidebar-item nova-logout-button"
          onClick={
            onLogout
          }
          title="Log out"
        >

          <LogOut size={17} />

          {!collapsed && (
            <span>Log out</span>
          )}

        </button>


        <div className="profile">

          <div className="avatar nova-avatar-ring">

            <User size={16} />

          </div>


          {!collapsed && (

            <div className="profile-info">

              <strong>
                Albi Maria
              </strong>

              <span>
                Free plan
              </span>

            </div>

          )}

        </div>

      </div>
    </aside>
  );
}

export default Sidebar;