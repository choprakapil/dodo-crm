"use client";

import React, { useState } from "react";
import { LeadTrendPoint } from "@/lib/services/analytics/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

interface LeadTrendChartProps {
  trends: LeadTrendPoint[];
  loading?: boolean;
}

export function LeadTrendChart({ trends, loading }: LeadTrendChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (loading) {
    return (
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur animate-pulse">
        <CardHeader className="pb-2">
          <div className="h-5 w-40 bg-slate-800 rounded mb-1" />
          <div className="h-3 w-60 bg-slate-800/80 rounded" />
        </CardHeader>
        <CardContent className="h-56 flex items-center justify-center">
          <div className="h-40 w-full bg-slate-800/40 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const totalLeadsInTrend = trends.reduce((acc, t) => acc + t.leads, 0);

  if (trends.length === 0) {
    return (
      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-400" />
            <span>Lead Creation Trend</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="h-56 flex items-center justify-center text-xs text-slate-500">
          No lead creation activity recorded in this period.
        </CardContent>
      </Card>
    );
  }

  // SVG Chart Geometry
  const width = 800;
  const height = 220;
  const paddingX = 40;
  const paddingY = 30;

  const maxVal = Math.max(...trends.map((t) => t.leads), 5);

  const points = trends.map((t, index) => {
    const x =
      trends.length > 1
        ? paddingX + (index / (trends.length - 1)) * (width - 2 * paddingX)
        : width / 2;
    const y = height - paddingY - (t.leads / maxVal) * (height - 2 * paddingY);
    return { x, y, ...t };
  });

  // Construct SVG path string
  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, "");

  // Construct Area closed path for gradient fill
  const areaD =
    points.length > 0
      ? `${pathD} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`
      : "";

  return (
    <Card className="border-slate-800 bg-slate-900/60 backdrop-blur shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-indigo-400" />
            <span>Lead Creation Trend</span>
          </CardTitle>
          <p className="text-xs text-slate-400 mt-0.5">
            {totalLeadsInTrend} leads created over this timeframe
          </p>
        </div>

        {hoveredIndex !== null && (
          <div className="bg-slate-800/90 border border-slate-700 px-2.5 py-1 rounded-lg text-xs shadow">
            <span className="text-slate-400 mr-1.5">{trends[hoveredIndex].label}:</span>
            <span className="font-bold text-white">{trends[hoveredIndex].leads} leads</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-2">
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-48 sm:h-56 overflow-visible"
          >
            <defs>
              <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = height - paddingY - ratio * (height - 2 * paddingY);
              const val = Math.round(ratio * maxVal);
              return (
                <g key={ratio}>
                  <line
                    x1={paddingX}
                    y1={y}
                    x2={width - paddingX}
                    y2={y}
                    stroke="#334155"
                    strokeDasharray="3 3"
                    strokeWidth="0.8"
                  />
                  <text
                    x={paddingX - 8}
                    y={y + 3}
                    fill="#64748b"
                    fontSize="10"
                    textAnchor="end"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Area Fill */}
            {areaD && <path d={areaD} fill="url(#trendGradient)" />}

            {/* Line Path */}
            {pathD && (
              <path
                d={pathD}
                fill="none"
                stroke="#6366f1"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Interactive Data Points */}
            {points.map((p, i) => (
              <g
                key={i}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={hoveredIndex === i ? 6 : 3.5}
                  fill={hoveredIndex === i ? "#ffffff" : "#6366f1"}
                  stroke="#4338ca"
                  strokeWidth="2"
                  className="transition-all"
                />
              </g>
            ))}

            {/* X-axis Date Labels (sparsely labeled for readability) */}
            {points
              .filter((_, i) => {
                if (points.length <= 8) return true;
                const step = Math.ceil(points.length / 8);
                return i % step === 0 || i === points.length - 1;
              })
              .map((p, i) => (
                <text
                  key={i}
                  x={p.x}
                  y={height - 8}
                  fill="#94a3b8"
                  fontSize="10"
                  textAnchor="middle"
                >
                  {p.label}
                </text>
              ))}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}
