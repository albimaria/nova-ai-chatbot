import { useState } from "react";
import ReactMarkdown from "react-markdown";

import {
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  MoreHorizontal,
  Pencil,
  X,
  Send,
  FileText,
  Image,
} from "lucide-react";

function Message({
  message,
  onRegenerate,
  onEdit,
}) {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editedContent, setEditedContent] =
    useState(message.content);

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(
        message.content
      );

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  const handleEditSave = () => {
    const trimmedContent =
      editedContent.trim();

    if (!trimmedContent) {
      return;
    }

    onEdit?.(message, trimmedContent);
    setEditing(false);
  };

  const handleEditCancel = () => {
    setEditedContent(message.content);
    setEditing(false);
  };

  if (message.role === "user") {
  return (
    <div className="message-row user-row">
      <div className="user-message-area">

        {message.attachments &&
          message.attachments.length > 0 && (
            <div className="sent-attachments">
              {message.attachments.map(
                (file, index) => (
                  <div
                    className="sent-attachment"
                    key={`${file.name}-${index}`}
                  >
                    <div className="sent-attachment-icon">
                      {file.type?.startsWith(
                        "image/"
                      ) ? (
                        <Image size={15} />
                      ) : (
                        <FileText size={15} />
                      )}
                    </div>

                    <div className="sent-attachment-info">
                      <span className="sent-attachment-name">
                        {file.name}
                      </span>

                      <span className="sent-attachment-size">
                        {file.size
                          ? `${(
                              file.size / 1024
                            ).toFixed(1)} KB`
                          : ""}
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

        <div className="user-message-line">

          <button
            className="user-edit-button"
            onClick={() =>
              setEditing(true)
            }
            title="Edit message"
            aria-label="Edit message"
          >
            <Pencil size={14} />
          </button>

          {editing ? (
            <div className="user-edit-container">
              <textarea
                className="user-edit-textarea"
                value={editedContent}
                onChange={(event) =>
                  setEditedContent(
                    event.target.value
                  )
                }
                autoFocus
              />

              <div className="user-edit-actions">
                <button
                  className="edit-cancel-button"
                  onClick={handleEditCancel}
                >
                  <X size={14} />
                  Cancel
                </button>

                <button
                  className="edit-save-button"
                  onClick={handleEditSave}
                  disabled={
                    !editedContent.trim()
                  }
                >
                  <Send size={14} />
                  Send
                </button>
              </div>
            </div>
          ) : (
            <div className="user-message">
              <span className="user-message-text">
                {message.content}
              </span>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

  if (message.role === "error") {
    return (
      <div className="message-row assistant-row">
        <div className="assistant-avatar">
          N
        </div>

        <div className="assistant-wrapper">
          <div className="assistant-message error-message">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="message-row assistant-row">
      <div className="assistant-avatar">
        N
      </div>

      <div className="assistant-wrapper">
        <div className="assistant-message">
          <ReactMarkdown
            components={{
              code({ inline, children }) {
                if (inline) {
                  return (
                    <code className="inline-code">
                      {children}
                    </code>
                  );
                }

                return (
                  <div className="code-block">
                    <div className="code-header">
                      <span>Code</span>

                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(
                            String(
                              children
                            ).replace(
                              /\n$/,
                              ""
                            )
                          )
                        }
                      >
                        <Copy size={14} />
                        Copy
                      </button>
                    </div>

                    <pre>
                      <code>
                        {children}
                      </code>
                    </pre>
                  </div>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        <div className="message-actions">
          <button
            onClick={copyMessage}
            title="Copy response"
          >
            {copied ? (
              <Check size={15} />
            ) : (
              <Copy size={15} />
            )}
          </button>

          <button
            className={
              liked ? "selected" : ""
            }
            onClick={() => {
              setLiked(!liked);
              setDisliked(false);
            }}
            title="Like"
          >
            <ThumbsUp size={15} />
          </button>

          <button
            className={
              disliked ? "selected" : ""
            }
            onClick={() => {
              setDisliked(!disliked);
              setLiked(false);
            }}
            title="Dislike"
          >
            <ThumbsDown size={15} />
          </button>

          <button
            onClick={() =>
              onRegenerate?.(message)
            }
            title="Regenerate"
          >
            <RotateCcw size={15} />
          </button>

          <button title="More">
            <MoreHorizontal size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default Message;