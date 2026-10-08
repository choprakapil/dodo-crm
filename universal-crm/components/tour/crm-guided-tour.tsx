"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  Compass,
  CheckCircle2,
  ExternalLink,
  Kanban,
  UserPlus,
  Users,
  ShieldCheck,
  Package,
  Layers,
  Clock,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface GuidedTourStep {
  id: string;
  title: string;
  badge: string;
  description: string;
  roleScope: "ALL" | "ADMIN" | "AGENT";
  targetRoute: string;
  targetLabel: string;
  tips: string[];
}

const ADMIN_TOUR_STEPS: GuidedTourStep[] = [
  {
    id: "dashboard",
    title: "1. Command Dashboard & Metrics",
    badge: "Observability",
    description:
      "Monitor enterprise conversion rates, active lead velocity, overdue follow-up health, and team-level performance in real time.",
    roleScope: "ADMIN",
    targetRoute: "/app",
    targetLabel: "Open Dashboard",
    tips: [
      "Track SLA breach rates across all assigned sales reps.",
      "Use Ctrl+K / Cmd+K anytime to globally search leads, customers, and team members.",
    ],
  },
  {
    id: "pipeline",
    title: "2. Kanban Pipeline & Stage Gatekeeping",
    badge: "Sales Operations",
    description:
      "Visualize your sales funnel with drag-and-drop Kanban cards. Stage transitions enforce mandatory disposition rules and follow-up schedules.",
    roleScope: "ALL",
    targetRoute: "/app/pipeline",
    targetLabel: "View Pipeline",
    tips: [
      "Moving leads to Closed/Lost or Won prompts for required disposition reasoning.",
      "Mobile-friendly stage selector is available for field agents.",
    ],
  },
  {
    id: "lead_creation",
    title: "3. Governed Lead Entry & Customer 360",
    badge: "Identity",
    description:
      "Create enquiries with automatic E.164 phone deduplication. Existing customers are instantly recognized and matched to prevent split accounts.",
    roleScope: "ALL",
    targetRoute: "/app/leads/new",
    targetLabel: "Try Lead Creation",
    tips: [
      "Entering an existing customer's phone automatically links the new enquiry.",
      "Historical previous interactions are previewed under strict tenant scopes.",
    ],
  },
  {
    id: "offerings_pricing",
    title: "4. Offerings & Governed Pricing",
    badge: "Governance",
    description:
      "Standardize products, service packages, and price limits. Sales reps are prevented from arbitrary discounts unless explicitly authorized.",
    roleScope: "ADMIN",
    targetRoute: "/app/settings/offerings",
    targetLabel: "Configure Offerings",
    tips: [
      "Lock prices or require an audited override reason when discounts are given.",
      "Supports multi-currency configuration per tenant.",
    ],
  },
  {
    id: "dispositions",
    title: "5. Hierarchical Dispositions",
    badge: "Quality Gate",
    description:
      "Define 2-level hierarchical outcome codes (Parent Categories & Sub-dispositions) to categorize call results and qualify leads.",
    roleScope: "ADMIN",
    targetRoute: "/app/settings/dispositions",
    targetLabel: "Configure Dispositions",
    tips: [
      "Enforce mandatory follow-up timestamps on specific disposition outcomes.",
      "Deactivating parent codes gracefully reassigns or cascades to children.",
    ],
  },
  {
    id: "teams_hierarchy",
    title: "6. Team & Organizational Hierarchy",
    badge: "Structure",
    description:
      "Model your enterprise organization structure: Divisions → Departments → Teams → Sales Reps with role-based row-level permissions.",
    roleScope: "ADMIN",
    targetRoute: "/app/settings/teams",
    targetLabel: "Manage Hierarchy",
    tips: [
      "Assign team managers to govern lead distribution and team queues.",
      "Air-gapped isolation protects cross-tenant records.",
    ],
  },
  {
    id: "custom_fields",
    title: "7. Custom Field Engine",
    badge: "Flexibility",
    description:
      "Tailor lead records to your industry with Text, Number, Date, Select, Multi-Select, and Boolean fields without database schema alterations.",
    roleScope: "ADMIN",
    targetRoute: "/app/settings/custom-fields",
    targetLabel: "Custom Fields",
    tips: [
      "Custom fields dynamically appear on lead creation forms and CSV bulk imports.",
      "Bulk editing custom fields is supported directly from the Leads Table.",
    ],
  },
  {
    id: "audit_logs",
    title: "8. Enterprise Security & Audit Trail",
    badge: "Compliance",
    description:
      "Every mutation, role change, phone reassignment, and status transition is recorded with timestamped immutable audit logs.",
    roleScope: "ADMIN",
    targetRoute: "/app/settings/audit-logs",
    targetLabel: "Inspect Audit Trail",
    tips: [
      "Filter audit entries by Actor, Action Type, or Date Range.",
      "Sensitive tokens and credentials are automatically redacted.",
    ],
  },
];

const AGENT_TOUR_STEPS: GuidedTourStep[] = [
  {
    id: "agent_dashboard",
    title: "1. Your Personal Command Center",
    badge: "My Daily Tasks",
    description:
      "View your active leads, today's scheduled follow-up calls, and recently assigned opportunities.",
    roleScope: "AGENT",
    targetRoute: "/app",
    targetLabel: "Go to Dashboard",
    tips: [
      "Review high-priority leads flagged for immediate contact.",
      "Quick stats show your personal conversion velocity.",
    ],
  },
  {
    id: "agent_pipeline",
    title: "2. Your Sales Funnel & Pipeline",
    badge: "Pipeline",
    description:
      "Easily drag leads across deal stages as conversations progress. Each stage shift keeps management aligned automatically.",
    roleScope: "AGENT",
    targetRoute: "/app/pipeline",
    targetLabel: "Open Pipeline",
    tips: [
      "Click any card to open the complete Lead 360 timeline.",
      "Use quick filters to focus on your assigned accounts.",
    ],
  },
  {
    id: "agent_lead_create",
    title: "3. Creating a New Lead / Enquiry",
    badge: "Data Entry",
    description:
      "Enter new prospects quickly. When you type a customer's phone number, the CRM automatically verifies if they are already in the system.",
    roleScope: "AGENT",
    targetRoute: "/app/leads/new",
    targetLabel: "New Enquiry Form",
    tips: [
      "Select standardized products or services with pre-configured pricing.",
      "Add notes and set initial follow-up reminders in one step.",
    ],
  },
  {
    id: "agent_followups",
    title: "4. Follow-ups & Smart Reminders",
    badge: "Task Queue",
    description:
      "Never miss a prospect call. The follow-up queue highlights upcoming, due, and overdue call reminders with direct 1-click contact actions.",
    roleScope: "AGENT",
    targetRoute: "/app/follow-ups",
    targetLabel: "Follow-up Queue",
    tips: [
      "Direct Click-to-Call (tel:) and WhatsApp links let you reach prospects fast.",
      "Logging call notes immediately clears the task and updates the timeline.",
    ],
  },
  {
    id: "agent_customers",
    title: "5. Customer 360 Profiles",
    badge: "Relationships",
    description:
      "Access complete customer histories, linked enquiries, contact details, and historical quotes in one unified view.",
    roleScope: "AGENT",
    targetRoute: "/app/customers",
    targetLabel: "View Customers",
    tips: [
      "Multiple phone numbers and email addresses are unified per customer.",
      "Activity histories provide full context before placing calls.",
    ],
  },
];

interface CrmGuidedTourProps {
  userRole?: string;
  userId?: string;
}

export function CrmGuidedTour({ userRole = "Sales Rep", userId = "default" }: CrmGuidedTourProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin =
    userRole.toLowerCase().includes("admin") || userRole.toLowerCase().includes("manager");

  const steps = isAdmin ? ADMIN_TOUR_STEPS : AGENT_TOUR_STEPS;
  const storageKey = `dodo_crm_tour_completed_${userId}_v2`;

  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Check if tour should auto-show on first visit (only on main /app page)
  useEffect(() => {
    try {
      const hasCompleted = localStorage.getItem(storageKey);
      if (!hasCompleted && pathname === "/app") {
        const timer = setTimeout(() => setIsOpen(true), 800);
        return () => clearTimeout(timer);
      }
    } catch {
      // localStorage best-effort
    }
  }, [storageKey, pathname]);

  // Global listener for opening tour via Help/Settings
  useEffect(() => {
    function handleOpenTourEvent() {
      setCurrentStepIndex(0);
      setIsOpen(true);
    }
    window.addEventListener("dodo:open-tour", handleOpenTourEvent);
    return () => window.removeEventListener("dodo:open-tour", handleOpenTourEvent);
  }, []);

  if (!isOpen) return null;

  const currentStep = steps[currentStepIndex] || steps[0];
  const progressPercent = Math.round(((currentStepIndex + 1) / steps.length) * 100);

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    try {
      localStorage.setItem(storageKey, "true");
    } catch {
      // safe fallback
    }
    setIsOpen(false);
  };

  const handleTryIt = () => {
    if (currentStep.targetRoute && pathname !== currentStep.targetRoute) {
      router.push(currentStep.targetRoute);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="bg-white border border-indigo-200 rounded-2xl shadow-2xl p-5 space-y-4 text-slate-900 ring-1 ring-black/5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Compass className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-900 tracking-tight">
                  {isAdmin ? "Admin Enterprise Tour" : "Agent Interactive Guide"}
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 bg-indigo-50 text-indigo-700 border-indigo-200"
                >
                  {currentStep.badge}
                </Badge>
              </div>
              <span className="text-[11px] text-slate-500">
                Step {currentStepIndex + 1} of {steps.length} ({progressPercent}%)
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleComplete}
            aria-label="Close tour"
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-indigo-600 h-full rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Step Content */}
        <div className="space-y-2.5">
          <h4 className="text-sm font-semibold text-slate-900">{currentStep.title}</h4>
          <p className="text-xs text-slate-600 leading-relaxed">{currentStep.description}</p>

          {/* Tips Box */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-1.5">
            <span className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wider block">
              💡 Pro Tips
            </span>
            <ul className="space-y-1">
              {currentStep.tips.map((tip, idx) => (
                <li key={idx} className="text-[11px] text-slate-600 flex items-start space-x-1.5">
                  <span className="text-indigo-500 font-bold leading-none">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex items-center space-x-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={currentStepIndex === 0}
              onClick={handlePrev}
              className="h-7 text-xs text-slate-600 hover:text-slate-900 px-2"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-0.5" /> Back
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTryIt}
              className="h-7 text-[11px] bg-slate-50 border-slate-200 text-slate-700 hover:bg-white hover:text-indigo-600 px-2.5"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              {currentStep.targetLabel}
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleComplete}
              className="text-[11px] text-slate-500 hover:text-slate-800 underline underline-offset-2"
            >
              Skip
            </button>
            <Button
              type="button"
              size="sm"
              onClick={handleNext}
              className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-3 shadow-xs"
            >
              {currentStepIndex === steps.length - 1 ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Finish Tour
                </>
              ) : (
                <>
                  Next <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
