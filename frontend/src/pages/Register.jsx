import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { register, user } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
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
      await register(email, password, fullName);
      navigate("/", { replace: true });
    } catch (err) {
      if (err.response?.status === 400) {
        const detail = err.response.data?.detail;
        setError(
          typeof detail === "string"
            ? detail
            : "This email is already registered."
        );
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
              Create Account
            </h1>
            <p className="text-xs text-text-tertiary">
              Get started with DocuMind AI
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div className="space-y-1.5">
            <label htmlFor="register-name" className="block text-sm font-medium text-text-secondary">
              Full Name
            </label>
            <input
              id="register-name"
              type="text"
              required
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border text-text-main placeholder-text-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="register-email" className="block text-sm font-medium text-text-secondary">
              Email
            </label>
            <input
              id="register-email"
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
            <label htmlFor="register-password" className="block text-sm font-medium text-text-secondary">
              Password
            </label>
            <input
              id="register-password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border text-text-main placeholder-text-subtle text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
            />
          </div>

          {/* Error message */}
          {error && (
            <p id="register-error" className="text-danger text-sm bg-danger-light border border-danger-border rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            id="register-submit"
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-primary text-white font-medium text-sm shadow-sm hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Creating account…
              </>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-sm text-text-tertiary">
          Already have an account?{" "}
          <Link
            to="/login"
            className="text-primary hover:text-primary-hover font-medium transition-colors duration-200"
          >
            Sign in
          </Link>
        </p>
      </main>

      <footer className="relative z-10 mt-8 text-xs text-text-subtle">
        DocuMind AI &copy; 2026
      </footer>
    </div>
  );
}
