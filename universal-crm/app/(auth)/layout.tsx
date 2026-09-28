import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-slate-950 p-4 selection:bg-indigo-500 selection:text-white overflow-hidden">
      {/* Background ambient lighting effects */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="relative z-10 mb-8 flex items-center space-x-3 text-center">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
          <span className="text-white font-bold text-xl tracking-wider">U</span>
        </div>
        <div className="text-left">
          <span className="text-xl font-bold text-white tracking-tight">Universal CRM</span>
          <span className="block text-xs font-medium text-slate-400">Enterprise Multi-Tenant SaaS</span>
        </div>
      </div>

      {/* Form Content */}
      <div className="relative z-10 w-full max-w-md">
        {children}
      </div>

      {/* Footer */}
      <div className="relative z-10 mt-8 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} Universal CRM. All rights reserved.
      </div>
    </div>
  );
}
