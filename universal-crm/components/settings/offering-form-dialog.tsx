"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Package } from "lucide-react";

export interface OfferingData {
  id?: string;
  name: string;
  type: "PRODUCT" | "SERVICE";
  code?: string | null;
  description?: string | null;
  defaultPrice: number | string;
  currency: string;
  isActive: boolean;
  allowSalesPriceOverride: boolean;
}

interface OfferingFormDialogProps {
  offering: OfferingData | null; // null = create mode
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  defaultCurrency?: string;
}

export function OfferingFormDialog({
  offering,
  open,
  onOpenChange,
  onSaved,
  defaultCurrency = "USD",
}: OfferingFormDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"PRODUCT" | "SERVICE">("PRODUCT");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [defaultPrice, setDefaultPrice] = useState("0");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [isActive, setIsActive] = useState(true);
  const [allowSalesPriceOverride, setAllowSalesPriceOverride] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (offering) {
        setName(offering.name);
        setType(offering.type);
        setCode(offering.code || "");
        setDescription(offering.description || "");
        setDefaultPrice(String(offering.defaultPrice ?? 0));
        setCurrency(offering.currency || defaultCurrency);
        setIsActive(offering.isActive ?? true);
        setAllowSalesPriceOverride(offering.allowSalesPriceOverride ?? true);
      } else {
        setName("");
        setType("PRODUCT");
        setCode("");
        setDescription("");
        setDefaultPrice("0");
        setCurrency(defaultCurrency);
        setIsActive(true);
        setAllowSalesPriceOverride(true);
      }
      setError(null);
    }
  }, [open, offering, defaultCurrency]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Offering name is required");
      return;
    }

    const priceNum = parseFloat(defaultPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setError("Please enter a valid non-negative base price");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = offering?.id
        ? `/api/v1/offerings/${offering.id}`
        : "/api/v1/offerings";
      const method = offering?.id ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          code: code.trim() || null,
          description: description.trim() || null,
          defaultPrice: priceNum,
          currency: currency.trim() || defaultCurrency,
          isActive,
          allowSalesPriceOverride,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to save offering");
      }

      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-slate-900 border-slate-800 text-slate-100">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <Package className="h-5 w-5 text-indigo-400" />
            <DialogTitle>
              {offering?.id ? "Edit Product / Service" : "Add Product or Service"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-slate-400">
            Configure offering catalog details, base pricing, and salesperson price override rules.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="p-3 text-xs bg-red-950/40 border border-red-800 text-red-300 rounded-md">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label className="text-xs text-slate-300">Offering Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setType("PRODUCT")}
                  className={`py-2 text-xs font-medium rounded-md border text-center transition-colors ${
                    type === "PRODUCT"
                      ? "bg-indigo-600 border-indigo-500 text-white shadow-sm"
                      : "bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Product
                </button>
                <button
                  type="button"
                  onClick={() => setType("SERVICE")}
                  className={`py-2 text-xs font-medium rounded-md border text-center transition-colors ${
                    type === "SERVICE"
                      ? "bg-indigo-600 border-indigo-500 text-white shadow-sm"
                      : "bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Service
                </button>
              </div>
            </div>

            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label htmlFor="code" className="text-xs text-slate-300">
                Code / SKU <span className="text-slate-500 font-normal">(optional)</span>
              </Label>
              <Input
                id="code"
                placeholder="e.g. LAP-001, AMC-1YR"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs text-slate-300">
              Name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g. Commercial Air Conditioner, Annual Maintenance"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-slate-800 border-slate-700 text-slate-100"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label htmlFor="defaultPrice" className="text-xs text-slate-300">
                Base / Default Price ({currency})
              </Label>
              <Input
                id="defaultPrice"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={defaultPrice}
                onChange={(e) => setDefaultPrice(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100"
                required
              />
            </div>

            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label htmlFor="currency" className="text-xs text-slate-300">
                Currency
              </Label>
              <Input
                id="currency"
                placeholder="USD, INR, EUR..."
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                className="bg-slate-800 border-slate-700 text-slate-100 font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs text-slate-300">
              Description <span className="text-slate-500 font-normal">(optional)</span>
            </Label>
            <textarea
              id="description"
              placeholder="Detailed offering notes, specifications, or terms..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md bg-slate-800 border border-slate-700 text-slate-100 p-2.5 min-h-[70px] text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-2 border-t border-slate-800 space-y-3">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={allowSalesPriceOverride}
                onChange={(e) => setAllowSalesPriceOverride(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="text-xs">
                <span className="font-medium text-slate-200">
                  Allow Sales Price Override
                </span>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  When enabled, sales reps can quote a customized price during enquiry creation.
                  If disabled, the base price is locked.
                </p>
              </div>
            </label>

            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="text-xs">
                <span className="font-medium text-slate-200">Active Offering</span>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Inactive offerings cannot be selected for new enquiries. Historical enquiries remain intact.
                </p>
              </div>
            </label>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {offering?.id ? "Save Changes" : "Create Offering"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
