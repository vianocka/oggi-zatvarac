import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { CouvertRangeForm } from "./couvert-range-form";

export const metadata: Metadata = {
  title: "Súhrn Couvert - Oggi Zatvarac",
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
            Súhrn Couvert
          </h1>
          <p className="text-sm text-muted">
            Vyberte obdobie - spočíta sa Couvert zo všetkých uzávierok uložených v ňom.
          </p>
        </div>
        <div className="card">
          <Suspense fallback={<p className="text-sm text-muted">Načítava sa...</p>}>
            <CouvertRangeForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
