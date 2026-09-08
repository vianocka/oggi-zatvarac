import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { RangeSummaryForm } from "./range-summary-form";

export const metadata: Metadata = {
  title: "Súhrn za obdobie - Oggi Zatvarac",
};

export default function CouvertyPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10 font-sans sm:px-6 sm:py-16">
      <main className="flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-2 px-1 text-center sm:text-left">
          <Link href="/" className="btn-ghost self-center sm:self-start">
            ← Späť na uzávierku
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Súhrn za obdobie
          </h1>
          <p className="text-sm text-muted">
            Vyberte obdobie - spočíta sa Couvert, Choice Tips a Blocky zo všetkých
            uzávierok uložených v ňom.
          </p>
        </div>
        <div className="card">
          <Suspense fallback={<p className="text-sm text-muted">Načítava sa...</p>}>
            <RangeSummaryForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
