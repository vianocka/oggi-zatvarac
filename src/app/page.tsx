import { Suspense } from "react";
import { DailyClosingForm } from "./daily-closing-form";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 font-sans dark:bg-black">
      <main className="flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col gap-2 text-center sm:text-left">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Denná uzávierka
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Vyplňte formulár, hotovosť do obálky sa počíta automaticky.
          </p>
        </div>
        <Suspense fallback={<p className="text-sm text-zinc-500">Načítava sa...</p>}>
          <DailyClosingForm />
        </Suspense>
      </main>
    </div>
  );
}
