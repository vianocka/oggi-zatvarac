import Link from "next/link";
import type { Metadata } from "next";
import { OdhadView } from "./odhad-view";

export const metadata: Metadata = {
  title: "Odhad tržby - Oggi Zatvarac",
};

export default function OdhadPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10 font-sans sm:px-6 sm:py-16">
      <main className="flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-2 px-1 text-center sm:text-left">
          <Link href="/" className="btn-ghost self-center sm:self-start">
            ← Späť na uzávierku
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Odhad tržby
          </h1>
          <p className="text-sm text-muted">
            Odhad tržby za aktuálny mesiac podľa dennej tržby z Dotykačky, s ohľadom na
            zostávajúce dni v týždni. Vo výbere môžete zobraziť aj skoršie mesiace.
          </p>
        </div>
        <div className="card">
          <OdhadView />
        </div>
      </main>
    </div>
  );
}
