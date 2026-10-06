import { Suspense } from "react";
import Link from "next/link";
import { DailyClosingForm } from "../daily-closing-form";

export default function AdminPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10 font-sans sm:px-6 sm:py-16">
      <main className="flex w-full max-w-lg flex-col gap-6">
        <div className="flex flex-col gap-2 px-1 text-center sm:text-left">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Denná uzávierka – admin
          </h1>
          <p className="text-sm text-muted">
            Rovnaký prehľad ako na úvodnej obrazovke, s označením skontrolovaných dní.
          </p>
          <Link href="/mesacny-prehlad" className="btn-ghost self-center sm:self-start">
            Súhrn za obdobie →
          </Link>
        </div>
        <div className="card">
          <Suspense fallback={<p className="text-sm text-muted">Načítava sa...</p>}>
            <DailyClosingForm admin />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
