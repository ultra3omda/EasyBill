import React from 'react';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusClasses = {
  complete: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  active: 'border-blue-200 bg-blue-50 text-blue-700',
  pending: 'border-slate-200 bg-white text-slate-500',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  error: 'border-red-200 bg-red-50 text-red-700',
};

function StageIcon({ status, index }) {
  if (status === 'complete') return <CheckCircle2 className="h-4 w-4" />;
  if (status === 'active') return <Loader2 className="h-4 w-4 animate-spin" />;
  if (status === 'warning' || status === 'error') return <AlertTriangle className="h-4 w-4" />;
  return <span className="text-[11px] font-semibold">{index + 1}</span>;
}

export function WorkflowStageProgress({
  title,
  description,
  stages = [],
  metrics = [],
  className,
}) {
  return (
    <div className={cn("app-shell-surface p-5 md:p-6", className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          {title ? <h2 className="text-base font-semibold text-slate-950">{title}</h2> : null}
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {metrics.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{metric.label}</p>
                <p className="text-sm font-semibold text-slate-900">{metric.value}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-6">
        {stages.map((stage, index) => (
          <div key={stage.id || stage.label} className="relative">
            {index < stages.length - 1 ? (
              <div className="absolute left-[calc(100%-0.25rem)] top-5 hidden h-px w-full bg-slate-200 lg:block" />
            ) : null}
            <div
              className={cn(
                "relative rounded-[20px] border p-4 transition-colors",
                statusClasses[stage.status] || statusClasses.pending
              )}
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-current/15 bg-white/70">
                  <StageIcon status={stage.status} index={index} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{stage.label}</p>
                  {stage.caption ? <p className="text-xs opacity-80">{stage.caption}</p> : null}
                </div>
              </div>
              {stage.meta ? <p className="mt-3 text-xs leading-5 opacity-85">{stage.meta}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
