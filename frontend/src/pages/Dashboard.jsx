import React from "react";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 selection:bg-indigo-500 selection:text-white">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/3 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl" />
      </div>

      <main className="relative z-10 max-w-xl w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800 shadow-2xl rounded-2xl p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-500/30">
              D
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                DocuMind AI
              </h1>
              <p className="text-xs text-slate-400">
                Intelligent Document Processing Platform
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Online
          </span>
        </div>

        {/* Welcome */}
        <div className="bg-slate-950/60 rounded-xl p-6 border border-slate-800/60 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/30">
              {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-100">
                Welcome, {user?.full_name || "User"}
              </p>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">
            Your authentication is working. The document dashboard will replace
            this placeholder in a later phase.
          </p>
        </div>

        {/* Logout */}
        <button
          id="logout-button"
          onClick={logout}
          className="w-full py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 font-medium text-sm hover:bg-slate-700 hover:text-white transition-all duration-200 cursor-pointer"
        >
          Log Out
        </button>
      </main>

      <footer className="relative z-10 mt-8 text-xs text-slate-500">
        DocuMind AI &copy; 2026
      </footer>
    </div>
  );
}
