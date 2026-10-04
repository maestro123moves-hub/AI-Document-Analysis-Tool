import React, { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // If already logged in, redirect to dashboard
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(email, password);
      // Navigation happens via the user state change -> Navigate above
    } catch (err) {
      if (err.response?.status === 401) {
        setError("Incorrect email or password.");
      } else if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-text-main flex flex-col items-center justify-center p-6">
      <main className="relative z-10 max-w-md w-full bg-surface border border-border shadow-sm hover:shadow-md transition-shadow rounded-2xl p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-3 pb-2 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-lg shadow-sm">
            D
          </div>
          <div>
            <h1 className="text-xl font-semibold text-text-main">
              Welcome Back
            </h1>
            <p className="text-xs text-text-tertiary">
              Sign in to DocuMind AI
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="block text-sm font-medium text-text-secondary">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border text-text-main placeholder-text-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label htmlFor="login-password" className="block text-sm font-medium text-text-secondary">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border text-text-main placeholder-text-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
            />
          </div>

          {/* Error message */}
          {error && (
            <p id="login-error" className="text-danger text-sm bg-danger-light border border-danger-border rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            id="login-submit"
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-primary text-white font-medium text-sm shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Signing in…
              </>
            ) : (
              "Log In"
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-sm text-text-tertiary">
          Don&apos;t have an account?{" "}
          <Link
            to="/register"
            className="text-primary hover:text-primary-hover font-medium transition-colors duration-200"
          >
            Create one
          </Link>
        </p>
      </main>

      <footer className="relative z-10 mt-8 text-xs text-text-subtle">
        DocuMind AI &copy; 2026
      </footer>
    </div>
  );
}
