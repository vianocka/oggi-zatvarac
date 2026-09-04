import { Suspense } from "react";
import { DailyClosingForm } from "./daily-closing-form";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10 font-sans sm:px-6 sm:py-16">
      <main className="flex w-full max-w-lg flex-col gap-6">
        <div className="flex flex-col gap-2 px-1 text-center sm:text-left">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Denná uzávierka
          </h1>
          <p className="text-sm text-muted">
            Vyplňte formulár, hotovosť do obálky sa počíta automaticky.
          </p>
        </div>
        <div className="card">
          <Suspense fallback={<p className="text-sm text-muted">Načítava sa...</p>}>
            <DailyClosingForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
