import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import UploadZone from "../components/UploadZone";
import DocumentCard from "../components/DocumentCard";
import { listDocuments, deleteDocument } from "../api/documents";
import { LogOut, RefreshCw, FolderOpen, AlertCircle, Search as SearchIcon } from "lucide-react";

const PAGE_SIZE = 12;

export default function Dashboard() {
  const { user, loading: authLoading, logout } = useAuth();

  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [actionError, setActionError] = useState("");

  /**
   * Fetch documents list starting from skip=0.
   */
  const fetchInitialDocuments = useCallback(async () => {
    setLoadingDocs(true);
    setFetchError("");
    setActionError("");

    try {
      const data = await listDocuments(0, PAGE_SIZE);
      setDocuments(data || []);
      setHasMore((data || []).length === PAGE_SIZE);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
      setFetchError("Unable to load document library. Please try refreshing.");
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  /**
   * Wait for auth session restore to finish before fetching documents.
   */
  useEffect(() => {
    if (!authLoading && user) {
      fetchInitialDocuments();
    }
  }, [authLoading, user, fetchInitialDocuments]);

  /**
   * Load more documents for pagination.
   */
  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setActionError("");

    try {
      const nextBatch = await listDocuments(documents.length, PAGE_SIZE);
      if (nextBatch && nextBatch.length > 0) {
        setDocuments((prev) => [...prev, ...nextBatch]);
        setHasMore(nextBatch.length === PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Failed to load more documents:", err);
      setActionError("Failed to load more documents. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  };

  /**
   * Called when UploadZone successfully finishes uploading a document.
   */
  const handleUploadSuccess = (uploadedDoc) => {
    if (uploadedDoc && uploadedDoc.id) {
      setDocuments((prev) => [uploadedDoc, ...prev.filter((d) => d.id !== uploadedDoc.id)]);
    } else {
      fetchInitialDocuments();
    }
  };

  /**
   * Delete a document.
   */
  const handleDeleteDocument = async (id) => {
    setActionError("");
    try {
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    } catch (err) {
      console.error("Failed to delete document:", err);
      setActionError("Failed to delete document. Please try again.");
      throw err;
    }
  };

  /**
   * Called when AI processing completes (success or failure) on a card.
   * Replaces the document in the list with fresh data so the card updates in place.
   */
  const handleDocumentProcessed = useCallback((docId, freshDoc) => {
    if (freshDoc && freshDoc.id) {
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, ...freshDoc } : d))
      );
    }
  }, []);

  return (
    <div className="min-h-screen bg-canvas text-text-main flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur-md border-b border-border shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-base shadow-xs">
              D
            </div>
            <div>
              <span className="font-semibold text-text-main text-base tracking-tight">
                DocuMind AI
              </span>
              <span className="hidden sm:inline-block ml-2 px-2 py-0.5 text-[11px] font-medium bg-primary-light text-primary border border-primary-border rounded-full">
                Document Studio
              </span>
            </div>
          </div>

          {/* User Profile, Search Nav & Logout */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            <Link
              to="/search"
              id="search-nav-link"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-text-secondary hover:text-text-main hover:bg-surface-subtle text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              title="Global document search across your library"
            >
              <SearchIcon className="w-3.5 h-3.5 text-primary" />
              <span>Search</span>
            </Link>

            <div className="h-4 w-px bg-border hidden sm:block" />

            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-text-main leading-tight">
                {user?.full_name || "User"}
              </p>
              <p className="text-xs text-text-tertiary">{user?.email}</p>
            </div>

            <div className="w-8 h-8 rounded-full bg-surface-subtle border border-border flex items-center justify-center text-xs font-semibold text-text-secondary">
              {(user?.full_name || user?.email || "U").charAt(0).toUpperCase()}
            </div>

            <button
              id="logout-button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-text-secondary hover:text-text-main hover:bg-surface-subtle text-xs font-medium transition-colors cursor-pointer shadow-xs"
              title="Sign out of your account"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Log Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Upload Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-main">
                Upload New Document
              </h2>
              <p className="text-xs text-text-tertiary">
                Upload PDFs, Word docs, images, or text files for instant text extraction.
              </p>
            </div>
          </div>

          <UploadZone onUploadSuccess={handleUploadSuccess} />
        </section>

        {/* Global Action Error */}
        {actionError && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-danger-light border border-danger-border text-danger text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p className="flex-1 text-xs font-medium">{actionError}</p>
            <button
              onClick={() => setActionError("")}
              className="text-xs font-semibold hover:opacity-75"
            >
              &times;
            </button>
          </div>
        )}

        {/* Document Library Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-semibold text-text-main">
                Your Document Library
              </h2>
              {!loadingDocs && documents.length > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-surface-subtle border border-border text-text-secondary">
                  {documents.length} {documents.length === 1 ? "document" : "documents"}
                </span>
              )}
            </div>

            <button
              onClick={fetchInitialDocuments}
              disabled={loadingDocs}
              className="inline-flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-main px-2.5 py-1 rounded-md hover:bg-surface border border-transparent hover:border-border transition-colors disabled:opacity-50 cursor-pointer"
              title="Refresh document library"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDocs ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Library State Handling */}
          {fetchError ? (
            <div className="p-8 text-center bg-surface border border-danger-border rounded-2xl space-y-3">
              <AlertCircle className="w-8 h-8 text-danger mx-auto" />
              <p className="text-sm font-medium text-danger">{fetchError}</p>
              <button
                onClick={fetchInitialDocuments}
                className="px-4 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors cursor-pointer"
              >
                Try Again
              </button>
            </div>
          ) : loadingDocs ? (
            /* Loading Skeleton Grid */
            <div
              id="library-loading-skeleton"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="bg-surface border border-border rounded-xl p-5 shadow-xs space-y-4 animate-pulse"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-16 h-5 bg-surface-subtle rounded" />
                    <div className="w-5 h-5 bg-surface-subtle rounded-full" />
                  </div>
                  <div className="space-y-2">
                    <div className="w-3/4 h-4 bg-surface-subtle rounded" />
                    <div className="w-1/2 h-4 bg-surface-subtle rounded" />
                  </div>
                  <div className="pt-3 border-t border-border flex items-center justify-between">
                    <div className="w-16 h-3 bg-surface-subtle rounded" />
                    <div className="w-16 h-3 bg-surface-subtle rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : documents.length === 0 ? (
            /* Empty State: Only shown when fetch completed and count is 0 */
            <div
              id="library-empty-state"
              className="p-12 text-center bg-surface border border-border rounded-2xl shadow-xs space-y-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-surface-subtle border border-border flex items-center justify-center text-text-subtle mx-auto">
                <FolderOpen className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-text-main">
                  No documents yet
                </h3>
                <p className="text-xs text-text-tertiary max-w-sm mx-auto">
                  Upload your first document above. We support PDF, Word documents, images, and plain text.
                </p>
              </div>
            </div>
          ) : (
            /* Document Cards Grid */
            <div className="space-y-6">
              <div
                id="document-library-grid"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
              >
                {documents.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    doc={doc}
                    onDelete={handleDeleteDocument}
                    onProcessed={handleDocumentProcessed}
                  />
                ))}
              </div>

              {/* Load More Button */}
              {hasMore && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="px-5 py-2.5 rounded-xl border border-border bg-surface hover:bg-surface-subtle text-text-main text-xs font-semibold shadow-xs transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {loadingMore ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        Loading more documents…
                      </>
                    ) : (
                      "Load More Documents"
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface py-6 text-center text-xs text-text-subtle mt-12">
        DocuMind AI &copy; 2026 &bull; Secure Document Processing Platform
      </footer>
    </div>
  );
}
