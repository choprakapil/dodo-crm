import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Sliders, ExternalLink, Mail, Phone, Calendar, CheckCircle2, XCircle } from "lucide-react";

interface CustomFieldValueItem {
  id: string;
  value: unknown;
  customField: {
    id: string;
    key: string;
    label: string;
    fieldType: string;
    options?: unknown;
  };
}

interface LeadCustomFieldsCardProps {
  customFieldValues?: CustomFieldValueItem[];
}

export function LeadCustomFieldsCard({ customFieldValues = [] }: LeadCustomFieldsCardProps) {
  if (!customFieldValues || customFieldValues.length === 0) {
    return (
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Sliders className="h-4 w-4 text-violet-400" /> Custom Fields
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-slate-500 py-3 text-center">
          No custom field values recorded for this lead.
        </CardContent>
      </Card>
    );
  }

  const renderFormattedValue = (type: string, val: unknown) => {
    if (val === null || val === undefined || val === "") {
      return <span className="text-slate-500 italic">None</span>;
    }

    switch (type) {
      case "BOOLEAN":
        return Boolean(val) ? (
          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
            <CheckCircle2 className="h-3 w-3" /> Yes
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-slate-400">
            <XCircle className="h-3 w-3" /> No
          </span>
        );

      case "NUMBER":
        return <span className="font-mono text-slate-200">{Number(val).toLocaleString()}</span>;

      case "DATE":
      case "DATETIME":
        try {
          const d = new Date(val as string);
          return (
            <span className="inline-flex items-center gap-1 text-slate-200 font-mono text-[11px]">
              <Calendar className="h-3 w-3 text-slate-400" />
              {d.toLocaleDateString()}
            </span>
          );
        } catch {
          return String(val);
        }

      case "URL": {
        const urlStr = String(val);
        return (
          <a
            href={urlStr}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-indigo-400 hover:underline truncate max-w-[160px]"
          >
            <span>{urlStr.replace(/^https?:\/\//, "")}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        );
      }

      case "EMAIL": {
        const emailStr = String(val);
        return (
          <a
            href={`mailto:${emailStr}`}
            className="inline-flex items-center gap-1 text-indigo-400 hover:underline truncate max-w-[160px]"
          >
            <Mail className="h-3 w-3 shrink-0" />
            <span>{emailStr}</span>
          </a>
        );
      }

      case "PHONE": {
        const phoneStr = String(val);
        return (
          <a
            href={`tel:${phoneStr}`}
            className="inline-flex items-center gap-1 text-indigo-400 hover:underline"
          >
            <Phone className="h-3 w-3 shrink-0" />
            <span>{phoneStr}</span>
          </a>
        );
      }

      case "MULTI_SELECT": {
        const items = Array.isArray(val) ? val : [String(val)];
        return (
          <div className="flex flex-wrap gap-1 max-w-[180px] justify-end">
            {items.map((item, idx) => (
              <span
                key={idx}
                className="px-1.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-[10px] text-violet-300 font-medium"
              >
                {String(item)}
              </span>
            ))}
          </div>
        );
      }

      case "SELECT":
        return (
          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 font-medium text-[11px]">
            {String(val)}
          </span>
        );

      default:
        return <span className="text-slate-200 break-words max-w-[180px] text-right">{String(val)}</span>;
    }
  };

  return (
    <Card className="border-slate-800 bg-slate-900/60 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Sliders className="h-4 w-4 text-violet-400" /> Custom Fields
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {customFieldValues.map((cfv) => (
          <div
            key={cfv.id}
            className="flex items-start justify-between py-1 border-b border-slate-800/60 last:border-0 gap-2"
          >
            <span className="text-slate-400 shrink-0">{cfv.customField.label}:</span>
            <div className="text-right">
              {renderFormattedValue(cfv.customField.fieldType, cfv.value)}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
