import {
  useState,
  useEffect,
  useRef,
} from "react";
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

  const [copied, setCopied] =
    useState(false);

  const [liked, setLiked] =
    useState(false);

  const [disliked, setDisliked] =
    useState(false);

  const [editing, setEditing] =
    useState(false);

  const [showMoreMenu, setShowMoreMenu] =
    useState(false);

  const moreMenuRef =
    useRef(null);

  const [editedContent, setEditedContent] =
    useState(
      message.content || ""
    );

  useEffect(() => {

    const handleOutsideClick = (event) => {

      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(
          event.target
        )
      ) {
        setShowMoreMenu(false);
      }
    };

    if (showMoreMenu) {
      document.addEventListener(
        "mousedown",
        handleOutsideClick
      );
    }

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };

  }, [showMoreMenu]);


  /*
   * COPY ASSISTANT MESSAGE
   */

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

      console.error(
        "Copy failed:",
        error
      );

    }
  };


  /*
   * SAVE EDIT
   */

  const handleEditSave = () => {

    const trimmedContent =
      editedContent.trim();

    if (!trimmedContent) {
      return;
    }

    onEdit?.(
      message,
      trimmedContent
    );

    setEditing(false);
  };


  /*
   * CANCEL EDIT
   */

  const handleEditCancel = () => {

    setEditedContent(
      message.content || ""
    );

    setEditing(false);
  };


  /*
   * FORMAT FILE SIZE
   */

  const formatFileSize = (
    size
  ) => {

    if (
      size === null ||
      size === undefined ||
      size === 0
    ) {
      return "";
    }

    if (size < 1024) {
      return `${size} B`;
    }

    if (
      size <
      1024 * 1024
    ) {
      return `${(
        size / 1024
      ).toFixed(1)} KB`;
    }

    return `${(
      size /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  };


  /*
   * GET ATTACHMENT DISPLAY NAME
   *
   * Supports both:
   *
   * New upload:
   * file.name
   *
   * Restored from backend:
   * file.displayName
   */

  const getAttachmentName = (
    file
  ) => {

    return (
      file.displayName ||
      file.name ||
      "Attached file"
    );
  };


  /*
   * GET ATTACHMENT MIME TYPE
   *
   * Supports both:
   *
   * New upload:
   * file.type
   *
   * Restored from backend:
   * file.mimeType
   */

  const getAttachmentType = (
    file
  ) => {

    return (
      file.mimeType ||
      file.type ||
      ""
    );
  };


  /*
   * GET ATTACHMENT SIZE
   *
   * Supports both:
   *
   * New upload:
   * file.size
   *
   * Restored from backend:
   * file.fileSize
   */

  const getAttachmentSize = (
    file
  ) => {

    return (
      file.fileSize ??
      file.size ??
      null
    );
  };


  /*
   * GET FILE ICON
   */

  const getAttachmentIcon = (
    file
  ) => {

    const mimeType =
      getAttachmentType(
        file
      );

    if (
      mimeType.startsWith(
        "image/"
      )
    ) {
      return (
        <Image size={15} />
      );
    }

    return (
      <FileText size={15} />
    );
  };


  /*
   * USER MESSAGE
   */

  if (
    message.role === "user"
  ) {

    return (
      <div className="message-row user-row">

        <div className="user-message-area">

          {/* ATTACHED FILES */}

          {Array.isArray(
            message.attachments
          ) &&
            message.attachments.length > 0 && (

              <div className="sent-attachments">

                {message.attachments.map(
                  (file, index) => {

                    const fileName =
                      getAttachmentName(
                        file
                      );

                    const fileSize =
                      getAttachmentSize(
                        file
                      );

                    return (
                      <div
                        className="sent-attachment"
                        key={
                          file.id ||
                          `${fileName}-${index}`
                        }
                      >

                        <div className="sent-attachment-icon">

                          {getAttachmentIcon(
                            file
                          )}

                        </div>


                        <div className="sent-attachment-info">

                          <span className="sent-attachment-name">

                            {fileName}

                          </span>


                          {formatFileSize(
                            fileSize
                          ) && (

                              <span className="sent-attachment-size">

                                {formatFileSize(
                                  fileSize
                                )}

                              </span>

                            )}

                        </div>

                      </div>
                    );
                  }
                )}

              </div>
            )}


          {/* MESSAGE */}

          <div className="user-message-line">

            {/* EDIT BUTTON */}

            <button
              className="user-edit-button"
              onClick={() =>
                setEditing(true)
              }
              title="Edit message"
              aria-label="Edit message"
              type="button"
            >

              <Pencil size={14} />

            </button>


            {/* EDIT MODE */}

            {editing ? (

              <div className="user-edit-container">

                <textarea
                  className="user-edit-textarea"
                  value={
                    editedContent
                  }
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
                    onClick={
                      handleEditCancel
                    }
                    type="button"
                  >

                    <X size={14} />

                    Cancel

                  </button>


                  <button
                    className="edit-save-button"
                    onClick={
                      handleEditSave
                    }
                    disabled={
                      !editedContent.trim()
                    }
                    type="button"
                  >

                    <Send size={14} />

                    Send

                  </button>

                </div>

              </div>

            ) : (

              /* NORMAL MESSAGE */

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


  /*
   * ERROR MESSAGE
   */

  if (
    message.role === "error"
  ) {

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


  /*
   * ASSISTANT MESSAGE
   */

  return (
    <div className="message-row assistant-row">

      <div className="assistant-avatar">
        N
      </div>


      <div className="assistant-wrapper">

        <div className="assistant-message">

          <ReactMarkdown
            components={{
              code({
                inline,
                children,
              }) {

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

                      <span>
                        Code
                      </span>


                      <button
                        type="button"
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

            {message.content || ""}

          </ReactMarkdown>


          {message.isStreaming &&
            !message.content && (

              <span className="streaming-dots">
                <span></span>
                <span></span>
                <span></span>
              </span>

            )}

        </div>


        {/* ASSISTANT ACTIONS */}

        <div className="message-actions">

          <button
            type="button"
            onClick={
              copyMessage
            }
            title="Copy response"
          >

            {copied ? (
              <Check size={15} />
            ) : (
              <Copy size={15} />
            )}

          </button>


          <button
            type="button"
            className={
              liked
                ? "selected"
                : ""
            }
            onClick={() => {

              setLiked(
                !liked
              );

              setDisliked(
                false
              );

            }}
            title="Like"
          >

            <ThumbsUp size={15} />

          </button>


          <button
            type="button"
            className={
              disliked
                ? "selected"
                : ""
            }
            onClick={() => {

              setDisliked(
                !disliked
              );

              setLiked(
                false
              );

            }}
            title="Dislike"
          >

            <ThumbsDown size={15} />

          </button>


          <button
            type="button"
            onClick={() =>
              onRegenerate?.(
                message
              )
            }
            title="Regenerate"
          >

            <RotateCcw size={15} />

          </button>


          <div
            className="message-more-wrapper"
            ref={moreMenuRef}
          >

            <button
              type="button"
              className="message-more-button"
              title="More"
              onClick={() =>
                setShowMoreMenu(
                  !showMoreMenu
                )
              }
            >

              <MoreHorizontal
                size={15}
              />

            </button>


            {showMoreMenu && (

              <div className="message-more-menu">

                <button
                  type="button"
                  onClick={() => {

                    copyMessage();

                    setShowMoreMenu(false);

                  }}
                >
                  <Copy size={14} />

                  Copy
                </button>


                <button
                  type="button"
                  onClick={() => {

                    setShowMoreMenu(false);

                    onRegenerate?.(
                      message
                    );

                  }}
                >
                  <RotateCcw size={14} />

                  Regenerate
                </button>

              </div>

            )}

          </div>

        </div>

      </div>

    </div>
  );
}


export default Message;