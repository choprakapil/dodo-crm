import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] text-slate-900 p-4 selection:bg-indigo-100 selection:text-indigo-900 relative">
      {/* Subtle modern ambient gradient backdrop */}
      <div className="fixed inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-60" />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-indigo-100/40 via-violet-50/20 to-transparent blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="relative z-10 mb-6 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-600/20">
          <span className="font-bold text-lg tracking-tight text-white font-mono">D</span>
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-slate-900 tracking-tight">Dodo CRM</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-semibold">
              V2
            </span>
          </div>
          <span className="text-xs text-slate-500 font-medium">Enterprise Sales & Pipeline Platform</span>
        </div>
      </div>

      {/* Form Card Container */}
      <div className="relative z-10 w-full max-w-[440px]">
        {children}
      </div>

      {/* Subtle Footer */}
      <div className="relative z-10 mt-8 text-center text-xs text-slate-500">
        Dodo CRM &bull; Multi-Tenant Business SaaS
      </div>
    </div>
  );
}
