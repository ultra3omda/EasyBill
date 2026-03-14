import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}) {
  return (
    <div
      className={cn("animate-pulse rounded-xl bg-slate-200/70", className)}
      {...props} />
  );
}

function CardSkeleton({ className, lines = 3 }) {
  return (
    <div className={cn("rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)] md:p-6", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-24" />
        </div>
        <Skeleton className="h-11 w-11 rounded-2xl" />
      </div>
      <div className="mt-5 space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton
            key={index}
            className={cn("h-3", index === lines - 1 ? "w-1/2" : "w-full")}
          />
        ))}
      </div>
    </div>
  );
}

function TableSkeleton({ className, rows = 6, columns = 5, showToolbar = true }) {
  return (
    <div className={cn("table-surface", className)}>
      {showToolbar && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-10" />
          </div>
        </div>
      )}
      <div className="overflow-hidden">
        <div className="grid grid-cols-1 gap-0">
          <div className="grid gap-3 border-b border-slate-200/80 bg-slate-50/90 px-5 py-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: columns }).map((_, index) => (
              <Skeleton key={index} className="h-3 w-16" />
            ))}
          </div>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              className="grid gap-3 border-b border-slate-200/70 px-5 py-4 last:border-b-0"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: columns }).map((__, columnIndex) => (
                <Skeleton
                  key={columnIndex}
                  className={cn("h-4", columnIndex === 0 ? "w-4/5" : "w-3/5")}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FormSkeleton({ className, sections = 2 }) {
  return (
    <div className={cn("page-shell", className)}>
      <div className="page-header">
        <div className="space-y-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="page-actions">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-36" />
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <div className="space-y-4">
          {Array.from({ length: sections }).map((_, index) => (
            <div key={index} className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)] md:p-6">
              <Skeleton className="h-5 w-40" />
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
              </div>
              <div className="mt-4 space-y-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={5} />
        </div>
      </div>
    </div>
  );
}

function DetailPanelSkeleton({ className }) {
  return (
    <div className={cn("rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)] md:p-6", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="mt-5 space-y-3">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}

function WorkflowProgressSkeleton({ className, steps = 4 }) {
  return (
    <div className={cn("rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)] md:p-6", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-24" />
      </div>
      <div className="mt-6 space-y-4">
        {Array.from({ length: steps }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-2 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PageSkeleton({ className, cards = 4, withTable = true, withSidePanel = false }) {
  return (
    <div className={cn("page-shell", className)}>
      <div className="page-header">
        <div className="space-y-2">
          <Skeleton className="h-9 w-52" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="page-actions">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: cards }).map((_, index) => (
          <CardSkeleton key={index} lines={2} />
        ))}
      </div>
      <div className={cn("grid gap-4", withSidePanel ? "xl:grid-cols-[minmax(0,1.5fr)_360px]" : "grid-cols-1")}>
        {withTable ? <TableSkeleton /> : <CardSkeleton lines={6} />}
        {withSidePanel ? <DetailPanelSkeleton /> : null}
      </div>
    </div>
  );
}

export {
  Skeleton,
  PageSkeleton,
  TableSkeleton,
  CardSkeleton,
  FormSkeleton,
  DetailPanelSkeleton,
  WorkflowProgressSkeleton,
}
