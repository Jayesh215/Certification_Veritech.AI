import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonPulse({ className = "" }) {
  return <Skeleton className={`bg-slate-200/80 ${className}`} />;
}

export function TableSkeleton({ rows = 6, cols = 6 }) {
  const gridStyle = {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid="table-skeleton">
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3" style={gridStyle}>
            {Array.from({ length: cols }).map((_, i) => (
              <SkeletonPulse key={`h-${i}`} className="h-3 w-full max-w-[5.5rem]" />
            ))}
          </div>
          <div className="divide-y divide-slate-100">
            {Array.from({ length: rows }).map((_, r) => (
              <div key={r} className="grid items-center gap-3 px-4 py-3.5" style={gridStyle}>
                {Array.from({ length: cols }).map((_, c) => (
                  <SkeletonPulse key={c} className="h-3.5 w-full max-w-[90%]" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlansSkeleton({ count = 5 }) {
  return (
    <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-5" data-testid="plans-skeleton">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col rounded-[24px] border border-slate-200 bg-white p-6">
          <SkeletonPulse className="h-5 w-24" />
          <SkeletonPulse className="mt-2 h-3 w-40" />
          <SkeletonPulse className="mt-2 h-3 w-32" />
          <SkeletonPulse className="mt-5 h-9 w-28" />
          <div className="mt-5 space-y-2.5">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex items-center gap-2">
                <SkeletonPulse className="h-3.5 w-3.5 rounded-full" />
                <SkeletonPulse className="h-3 flex-1" />
              </div>
            ))}
          </div>
          <SkeletonPulse className="mt-6 h-10 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4" data-testid="dashboard-skeleton">
      <div className="rounded-[28px] bg-white p-5 shadow-sm">
        <SkeletonPulse className="h-7 w-64" />
        <SkeletonPulse className="mt-2 h-3 w-40" />
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-[#f6f7fb] p-4">
              <SkeletonPulse className="h-3 w-16" />
              <SkeletonPulse className="mt-3 h-7 w-20" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[28px] bg-white p-5 shadow-sm">
          <SkeletonPulse className="h-5 w-40" />
          <SkeletonPulse className="mt-4 h-48 w-full rounded-2xl" />
        </div>
        <div className="rounded-[28px] bg-white p-5 shadow-sm">
          <SkeletonPulse className="h-5 w-36" />
          <SkeletonPulse className="mt-4 h-48 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function CardSkeleton({ lines = 4 }) {
  return (
    <div className="rounded-[28px] bg-white p-6 shadow-sm sm:p-8" data-testid="card-skeleton">
      <SkeletonPulse className="h-7 w-48" />
      <SkeletonPulse className="mt-2 h-3.5 w-72 max-w-full" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonPulse key={i} className={`h-4 ${i % 2 === 0 ? "w-full" : "w-4/5"}`} />
        ))}
      </div>
    </div>
  );
}

export function StatusResultSkeleton() {
  return (
    <section className="mt-4 rounded-[28px] bg-white p-6 shadow-sm sm:p-8" data-testid="status-skeleton">
      <div className="flex justify-between gap-4">
        <div>
          <SkeletonPulse className="h-3 w-24" />
          <SkeletonPulse className="mt-2 h-6 w-40" />
        </div>
        <SkeletonPulse className="h-7 w-20 rounded-full" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-[#f6f7fb] p-3">
            <SkeletonPulse className="h-3 w-16" />
            <SkeletonPulse className="mt-2 h-4 w-28" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function VerifySkeleton() {
  return (
    <div className="p-8 sm:p-10" data-testid="verify-skeleton">
      <div className="flex items-center gap-3">
        <SkeletonPulse className="h-12 w-12 rounded-full" />
        <div>
          <SkeletonPulse className="h-5 w-40" />
          <SkeletonPulse className="mt-2 h-3 w-28" />
        </div>
      </div>
      <div className="mt-8 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex justify-between gap-4 border-b border-slate-100 py-2">
            <SkeletonPulse className="h-3.5 w-24" />
            <SkeletonPulse className="h-3.5 w-36" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BrandingSkeleton() {
  return (
    <div className="space-y-4" data-testid="branding-skeleton">
      <SkeletonPulse className="h-8 w-40" />
      <SkeletonPulse className="h-4 w-72" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-[24px] bg-white p-5 shadow-sm">
            <SkeletonPulse className="h-4 w-20" />
            <SkeletonPulse className="mt-4 h-28 w-full rounded-2xl" />
            <SkeletonPulse className="mt-4 h-9 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
