import {
  useEffect,
  useRef,
} from "react";

import Message from "./Message";
import TypingIndicator from "./TypingIndicator";


function MessageList({
  messages,
  isLoading,
  onRegenerate,
  onEdit,
}) {

  const bottomRef =
    useRef(null);


  const hasStreamingAssistant =
    messages.some(
      (message) =>
        message.role ===
        "assistant" &&
        message.isStreaming === true
    );


  useEffect(() => {

    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });

  }, [
    messages,
    isLoading,
  ]);


  return (
    <div className="message-list">

      {messages.map(
        (message) => (
          <Message
            key={message.id}
            message={message}
            onRegenerate={
              onRegenerate
            }
            onEdit={
              onEdit
            }
          />
        )
      )}


      {isLoading &&
        !hasStreamingAssistant && (
          <TypingIndicator />
        )}


      <div
        ref={bottomRef}
      />

    </div>
  );
}


export default MessageList;