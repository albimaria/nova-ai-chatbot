function TypingIndicator() {
  return (
    <div className="typing-container">
      <div className="assistant-avatar">
        N
      </div>

      <div className="typing-content">
        <span>Nova is thinking</span>

        <div className="typing-dots">
          <i></i>
          <i></i>
          <i></i>
        </div>
      </div>
    </div>
  );
}

export default TypingIndicator;