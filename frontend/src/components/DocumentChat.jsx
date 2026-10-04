import React, { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { askDocument } from "../api/documents";

/**
 * Individual source chunk card with expandable text.
 */
function SourceChunkItem({ chunk }) {
  const [expanded, setExpanded] = useState(false);
  const matchPercent = Math.round(
    Math.max(0, Math.min(1, chunk.similarity_score)) * 100
  );

  const isLong = chunk.chunk_text && chunk.chunk_text.length > 180;
  const displayText =
    !expanded && isLong
      ? chunk.chunk_text.slice(0, 180) + "…"
      : chunk.chunk_text;

  return (
    <div className="bg-surface border border-border rounded-xl p-3 text-xs space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-text-secondary flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-primary" />
          Chunk #{chunk.chunk_index + 1}
        </span>
        <div className="flex items-center gap-2">
          {/* Similarity score bar */}
          <div className="w-16 h-1.5 bg-surface-subtle border border-border rounded-full overflow-hidden hidden sm:block">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${matchPercent}%` }}
            />
          </div>
          <span
            data-testid="source-match-score"
            className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary-light text-primary border border-primary-border"
          >
            {matchPercent}% match
          </span>
        </div>
      </div>

      <p className="text-text-secondary leading-relaxed font-mono text-[11px] whitespace-pre-wrap break-words bg-surface-subtle/60 p-2 rounded-lg border border-border/50">
        {displayText}
      </p>

      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-primary hover:text-primary-hover font-semibold text-[11px] hover:underline cursor-pointer"
        >
          {expanded ? "Show less" : "Show full chunk text"}
        </button>
      )}
    </div>
  );
}

/**
 * Collapsible Sources container for assistant answer.
 */
function CollapsibleSources({ sources }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="pt-2 border-t border-border/60">
      <button
        type="button"
        data-testid="toggle-sources-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-main py-1 cursor-pointer transition-colors"
      >
        <span>Sources ({sources.length})</span>
        {isOpen ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
      </button>

      {isOpen && (
        <div className="mt-2 space-y-2 animate-in fade-in duration-150">
          {sources.map((chunk, idx) => (
            <SourceChunkItem
              key={`${chunk.chunk_index}-${idx}`}
              chunk={chunk}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DocumentChat({ processingStatus, documentId }) {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Synchronous lock ref to prevent rapid double-dispatch before React state updates
  const isSubmittingRef = useRef(false);
  const messagesEndRef = useRef(null);

  const isEnabled = processingStatus === "completed";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (questionText) => {
    // TWO-LAYER GUARD: Layer (b) - early-return guard as FIRST line inside submit handler
    if (isLoading || isSubmittingRef.current || !questionText.trim()) return;

    const trimmedQuestion = questionText.trim();
    isSubmittingRef.current = true;
    setIsLoading(true);
    setError(null);
    setQuestion("");

    // Add user question to local state
    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmedQuestion,
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await askDocument(documentId, trimmedQuestion, 5);
      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.answer,
        sources: response.source_chunks || [],
        processingTimeMs: response.processing_time_ms,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("Ask document error:", err);
      const statusCode = err.response?.status;
      if (statusCode === 422) {
        // Handle 422 gracefully with the same inline message
        setError({
          type: "422",
          message: "Process this document to enable Q&A",
          lastQuestion: trimmedQuestion,
        });
      } else {
        setError({
          type: "network",
          message:
            "Unable to generate an answer right now. Please check your connection and try again.",
          lastQuestion: trimmedQuestion,
        });
      }
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    handleSend(question);
  };

  return (
    <section className="bg-surface border border-border rounded-2xl shadow-xs overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-surface-subtle/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary-light border border-primary-border flex items-center justify-center text-primary">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-main flex items-center gap-2">
              Document Q&A
              {isEnabled && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-success-light text-success border border-success-border">
                  Ready
                </span>
              )}
            </h2>
            <p className="text-xs text-text-tertiary">
              Ask questions grounded directly in this document's content
            </p>
          </div>
        </div>
      </div>

      {/* Body: If not completed, show brief inline note */}
      {!isEnabled ? (
        <div className="p-8 text-center space-y-2 bg-surface-subtle/20">
          <div className="w-10 h-10 rounded-xl bg-surface-subtle border border-border flex items-center justify-center mx-auto text-text-subtle">
            <Sparkles className="w-5 h-5" />
          </div>
          <p
            id="chat-disabled-note"
            className="text-sm font-medium text-text-secondary"
          >
            Process this document to enable Q&A
          </p>
          <p className="text-xs text-text-tertiary max-w-sm mx-auto">
            Once processed, embeddings are indexed so you can ask detailed questions about this document.
          </p>
        </div>
      ) : (
        <>
          {/* Scrollable message history */}
          <div
            id="document-chat-history"
            className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[460px] min-h-[240px] bg-canvas/30"
          >
            {messages.length === 0 && !isLoading && !error && (
              <div className="py-10 text-center space-y-3">
                <div className="w-10 h-10 rounded-xl bg-primary-light border border-primary-border flex items-center justify-center mx-auto text-primary">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-text-main">
                    What would you like to know?
                  </p>
                  <p className="text-xs text-text-tertiary max-w-md mx-auto">
                    Type a question below. The AI will extract relevant excerpts and provide a grounded answer.
                  </p>
                </div>
              </div>
            )}

            {messages.map((msg) =>
              msg.role === "user" ? (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[85%] sm:max-w-[75%] bg-primary text-white p-3.5 rounded-2xl rounded-tr-xs shadow-xs text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="flex justify-start">
                  <div className="max-w-[95%] sm:max-w-[88%] bg-surface border border-border p-4 rounded-2xl rounded-tl-xs shadow-xs space-y-3">
                    {/* Header info */}
                    <div className="flex items-center justify-between text-[11px] text-text-tertiary">
                      <span className="font-semibold text-text-secondary flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        DocuMind Assistant
                      </span>
                      {msg.processingTimeMs != null && (
                        <span className="font-mono text-text-subtle">
                          {(msg.processingTimeMs / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>

                    {/* Prose Answer in readable style */}
                    <div
                      className="text-sm leading-relaxed text-text-secondary whitespace-pre-wrap break-words"
                      style={{
                        fontFamily: "'Georgia', 'Times New Roman', serif",
                      }}
                    >
                      {msg.content}
                    </div>

                    {/* Collapsible sources */}
                    <CollapsibleSources sources={msg.sources} />
                  </div>
                </div>
              )
            )}

            {/* In-flight Thinking Indicator */}
            {isLoading && (
              <div className="flex justify-start animate-in fade-in duration-200">
                <div className="bg-surface border border-border p-3.5 rounded-2xl rounded-tl-xs shadow-xs flex items-center gap-2.5 text-xs text-text-secondary">
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  <span className="font-medium">Thinking…</span>
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="flex justify-start">
                <div className="max-w-[95%] bg-danger-light/70 border border-danger-border p-3.5 rounded-2xl rounded-tl-xs shadow-xs space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-danger font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error.message}</span>
                  </div>
                  {error.lastQuestion && (
                    <button
                      type="button"
                      onClick={() => handleSend(error.lastQuestion)}
                      disabled={isLoading}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-danger-border text-danger hover:bg-danger-light font-medium cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Retry question
                    </button>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Bottom pinned input */}
          <form
            onSubmit={handleSubmit}
            className="p-3 sm:p-4 border-t border-border bg-surface flex items-center gap-2"
          >
            <input
              type="text"
              id="document-chat-input"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={isLoading}
              placeholder="Ask a question about this document…"
              maxLength={1000}
              className="flex-1 px-4 py-2.5 text-sm bg-surface border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-surface-subtle disabled:text-text-subtle disabled:cursor-not-allowed transition-all"
            />
            <button
              type="submit"
              id="document-chat-send-btn"
              // Layer (a): disabled={isLoading} as visible UI state
              disabled={isLoading || !question.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs shrink-0"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </>
      )}
    </section>
  );
}
