import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Search as SearchIcon,
  Send,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle,
  RotateCcw,
  ExternalLink,
  Layers,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { listDocuments, askGlobal } from "../api/documents";

/**
 * Individual source chunk card on Global Search with document filename link.
 */
function GlobalSourceChunkItem({ chunk }) {
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Filename link to DocumentDetail */}
        <Link
          to={`/documents/${chunk.document_id}`}
          className="inline-flex items-center gap-1.5 font-semibold text-primary hover:text-primary-hover hover:underline transition-colors max-w-full truncate"
          title={`View ${chunk.filename}`}
        >
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{chunk.filename || "Document"}</span>
          <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-text-subtle font-mono text-[11px]">
            Chunk #{chunk.chunk_index + 1}
          </span>
          {/* Similarity score bar */}
          <div className="w-14 h-1.5 bg-surface-subtle border border-border rounded-full overflow-hidden hidden sm:block">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${matchPercent}%` }}
            />
          </div>
          <span
            data-testid="global-source-match-score"
            className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary-light text-primary border border-primary-border"
          >
            {matchPercent}% match
          </span>
        </div>
      </div>

      <p className="text-text-secondary leading-relaxed font-mono text-[11px] whitespace-pre-wrap break-words bg-surface-subtle/60 p-2.5 rounded-lg border border-border/50">
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
        data-testid="global-toggle-sources-btn"
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
            <GlobalSourceChunkItem
              key={`${chunk.document_id}-${chunk.chunk_index}-${idx}`}
              chunk={chunk}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Search() {
  const { user } = useAuth();

  // Document checklist state (independent from chat state)
  const [completedDocs, setCompletedDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [docsError, setDocsError] = useState("");
  const [selectedDocIds, setSelectedDocIds] = useState([]);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Synchronous lock ref to prevent rapid double-dispatch
  const isSubmittingRef = useRef(false);
  const messagesEndRef = useRef(null);

  const fetchCompletedDocs = useCallback(async () => {
    setLoadingDocs(true);
    setDocsError("");
    try {
      // Fetch up to 100 documents to populate checklist
      const allDocs = await listDocuments(0, 100);
      // FILTER strictly to documents where processing_status === "completed"
      const completed = (allDocs || []).filter(
        (doc) => doc.processing_status === "completed"
      );
      setCompletedDocs(completed);
    } catch (err) {
      console.error("Failed to fetch documents for scoping:", err);
      setDocsError(
        "Could not load document list for filtering. You can still search across all documents."
      );
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    fetchCompletedDocs();
  }, [fetchCompletedDocs]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const toggleSelectDoc = (id) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const handleClearSelection = () => {
    setSelectedDocIds([]);
  };

  const handleSelectAll = () => {
    setSelectedDocIds(completedDocs.map((d) => d.id));
  };

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

    // Crucial requirement: when checklist selection is empty, explicitly set document_ids to null
    // (do NOT send an empty array [])
    const documentIdsPayload =
      selectedDocIds.length > 0 ? selectedDocIds : null;

    try {
      const response = await askGlobal(trimmedQuestion, 5, documentIdsPayload);
      // Normal neutral assistant bubble for all 200 responses (even "nothing to search yet")
      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.answer,
        sources: response.source_chunks || [],
        processingTimeMs: response.processing_time_ms,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("Ask global error:", err);
      setError({
        type: "network",
        message:
          "Unable to complete global search right now. Please check your connection and try again.",
        lastQuestion: trimmedQuestion,
      });
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
    <div className="min-h-screen bg-canvas text-text-main flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur-md border-b border-border shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link
              to="/"
              id="back-to-library-btn"
              className="inline-flex items-center gap-2 text-xs font-semibold text-text-secondary hover:text-text-main px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-subtle transition-colors shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Library</span>
            </Link>
            <div className="h-4 w-px bg-border hidden sm:block" />
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-text-main text-base tracking-tight hidden sm:inline">
                DocuMind AI
              </span>
              <span className="px-2 py-0.5 text-[11px] font-medium bg-primary-light text-primary border border-primary-border rounded-full">
                Global Search
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium text-text-main leading-tight">
                {user?.full_name || "User"}
              </p>
              <p className="text-[11px] text-text-tertiary">{user?.email}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-surface-subtle border border-border flex items-center justify-center text-xs font-semibold text-text-secondary">
              {(user?.full_name || user?.email || "U").charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 flex flex-col">
        {/* Banner */}
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold text-text-main flex items-center gap-2.5">
            <SearchIcon className="w-6 h-6 text-primary" />
            Global Document Search
          </h1>
          <p className="text-xs sm:text-sm text-text-tertiary">
            Search across all your documents or narrow your query to specific files
          </p>
        </div>

        {/* Two-column layout for Scoping Checklist + Chat */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
          {/* Left Column: Scope by Document (lg:col-span-4) */}
          <aside className="lg:col-span-4 bg-surface border border-border rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="text-sm font-semibold text-text-main flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-primary" />
                  Scope Search
                </h2>
                <p className="text-[11px] text-text-tertiary">
                  {selectedDocIds.length === 0
                    ? "Searching across all documents"
                    : `${selectedDocIds.length} document${
                        selectedDocIds.length > 1 ? "s" : ""
                      } selected`}
                </p>
              </div>

              {selectedDocIds.length > 0 && (
                <button
                  type="button"
                  id="clear-scope-btn"
                  onClick={handleClearSelection}
                  className="text-xs font-medium text-primary hover:text-primary-hover hover:underline cursor-pointer"
                >
                  Clear filter
                </button>
              )}
            </div>

            {/* Scoping Checklist states */}
            {loadingDocs ? (
              <div className="py-8 text-center space-y-2 text-xs text-text-tertiary">
                <Loader2 className="w-5 h-5 text-primary animate-spin mx-auto" />
                <p>Loading processed documents…</p>
              </div>
            ) : docsError ? (
              <div className="p-3 rounded-xl bg-danger-light/60 border border-danger-border text-danger text-xs space-y-2">
                <div className="flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{docsError}</p>
                </div>
                <button
                  type="button"
                  onClick={fetchCompletedDocs}
                  className="px-2.5 py-1 rounded bg-surface border border-danger-border text-danger font-medium hover:bg-danger-light cursor-pointer text-[11px]"
                >
                  Retry
                </button>
              </div>
            ) : completedDocs.length === 0 ? (
              <div className="py-8 text-center space-y-2 bg-surface-subtle/40 rounded-xl p-4 border border-border/50 text-xs text-text-tertiary">
                <p className="font-medium text-text-secondary">
                  No processed documents yet
                </p>
                <p>
                  Documents must be processed before they can be searched or scoped.
                </p>
                <Link
                  to="/"
                  className="inline-block mt-2 text-primary hover:underline font-semibold"
                >
                  Go to library to upload & process
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-text-tertiary px-1">
                  <span>Processed documents ({completedDocs.length})</span>
                  {selectedDocIds.length < completedDocs.length ? (
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-primary hover:underline cursor-pointer font-medium"
                    >
                      Select all
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="text-primary hover:underline cursor-pointer font-medium"
                    >
                      Deselect all
                    </button>
                  )}
                </div>

                <div
                  id="scope-document-list"
                  className="max-h-[360px] overflow-y-auto space-y-1.5 pr-1"
                >
                  {completedDocs.map((doc) => {
                    const isSelected = selectedDocIds.includes(doc.id);
                    const name = doc.original_filename || doc.filename;
                    return (
                      <label
                        key={doc.id}
                        id={`scope-doc-item-${doc.id}`}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? "bg-primary-light/50 border-primary-border"
                            : "bg-surface hover:bg-surface-subtle border-border"
                        }`}
                      >
                        <input
                          type="checkbox"
                          id={`scope-checkbox-${doc.id}`}
                          checked={isSelected}
                          onChange={() => toggleSelectDoc(doc.id)}
                          className="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className="font-medium text-text-main truncate"
                            title={name}
                          >
                            {name}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-text-subtle mt-0.5">
                            {doc.document_type && (
                              <span className="capitalize">
                                {doc.document_type}
                              </span>
                            )}
                            {doc.document_type && <span>&bull;</span>}
                            <span>
                              {doc.chunk_count || 0}{" "}
                              {doc.chunk_count === 1 ? "chunk" : "chunks"}
                            </span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </aside>

          {/* Right Column: Global Q&A Chat Panel (lg:col-span-8) */}
          <div className="lg:col-span-8 bg-surface border border-border rounded-2xl shadow-xs overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-surface-subtle/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary-light border border-primary-border flex items-center justify-center text-primary">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-text-main">
                    Global Library Q&A
                  </h2>
                  <p className="text-xs text-text-tertiary">
                    {selectedDocIds.length === 0
                      ? "Searching across all your documents"
                      : `Scoped to ${selectedDocIds.length} selected document${
                          selectedDocIds.length > 1 ? "s" : ""
                        }`}
                  </p>
                </div>
              </div>

              <div className="hidden sm:flex items-center">
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-surface border border-border text-text-secondary">
                  {selectedDocIds.length === 0
                    ? "All documents"
                    : `${selectedDocIds.length} scoped`}
                </span>
              </div>
            </div>

            {/* Scrollable message history */}
            <div
              id="global-chat-history"
              className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[500px] min-h-[320px] bg-canvas/30"
            >
              {messages.length === 0 && !isLoading && !error && (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary-light border border-primary-border flex items-center justify-center mx-auto text-primary shadow-xs">
                    <SearchIcon className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-text-main">
                      Search across all your documents
                    </p>
                    <p className="text-xs text-text-tertiary max-w-md mx-auto">
                      Ask any question. The AI retrieves semantic matches from across
                      your library, cites the source files, and synthesizes an answer.
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
                    <span className="font-medium">
                      Searching and synthesizing answers…
                    </span>
                  </div>
                </div>
              )}

              {/* Network / 500 Error */}
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
                id="global-search-input"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={isLoading}
                placeholder={
                  selectedDocIds.length > 0
                    ? `Ask a question across ${selectedDocIds.length} selected document(s)…`
                    : "Ask a question across all your documents…"
                }
                maxLength={1000}
                className="flex-1 px-4 py-2.5 text-sm bg-surface border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-surface-subtle disabled:text-text-subtle disabled:cursor-not-allowed transition-all"
              />
              <button
                type="submit"
                id="global-search-send-btn"
                // Layer (a): disabled={isLoading} as visible UI state
                disabled={isLoading || !question.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Search</span>
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface py-5 text-center text-xs text-text-subtle mt-auto">
        DocuMind AI &copy; 2026 &bull; Secure Document Processing Platform
      </footer>
    </div>
  );
}
