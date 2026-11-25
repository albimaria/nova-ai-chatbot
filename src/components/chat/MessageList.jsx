import { useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";

import Message from "./Message";

export default function MessageList({ messages, busy, readOnly, onEdit, onRegenerate, onRetry, onFeedback }) {
  const scrollRef = useRef(null);
  const stickRef = useRef(true);
  const lastTopRef = useRef(0);
  const [showJump, setShowJump] = useState(false);

  const lastAssistantIndex = messages.findLastIndex((m) => m.role === "assistant");

  const onScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;

    // Only a real upward scroll by the user stops auto-follow; content growing doesn't.
    if (element.scrollTop < lastTopRef.current - 4) stickRef.current = false;
    if (distance < 120) stickRef.current = true;

    lastTopRef.current = element.scrollTop;
    setShowJump(distance > 400);
  };

  // Follow the reply as it streams, unless the user scrolled up to read.
  useEffect(() => {
    const element = scrollRef.current;
    if (element && stickRef.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages]);

  const lastMessage = messages[messages.length - 1];

  // Always jump down when the user sends a new message.
  useEffect(() => {
    if (lastMessage?.role === "assistant" && lastMessage.streaming && !lastMessage.content) {
      stickRef.current = true;
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lastMessage?.id, lastMessage?.role, lastMessage?.streaming, lastMessage?.content]);

  return (
    <div className="message-scroll" ref={scrollRef} onScroll={onScroll}>
      <div className="message-list" role="log" aria-live="polite" aria-relevant="additions">
        {messages.map((message, index) => (
          <Message
            key={message.id}
            message={message}
            isLast={index === lastAssistantIndex && index === messages.length - 1}
            readOnly={readOnly}
            busy={busy}
            onEdit={onEdit}
            onRegenerate={onRegenerate}
            onRetry={onRetry}
            onFeedback={onFeedback}
          />
        ))}
      </div>

      {showJump && (
        <button
          type="button"
          className="jump-bottom glass"
          aria-label="Scroll to latest message"
          onClick={() => {
            stickRef.current = true;
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
          }}
        >
          <ArrowDown size={18} />
        </button>
      )}
    </div>
  );
}
