import type { Metadata } from "next";
import { login } from "./actions";
import { safeNextPath } from "@/lib/subpage-auth";

export const metadata: Metadata = {
  title: "Prihlásenie - Oggi Zatvarac",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const configured = Boolean(process.env.SUBPAGES_PASSWORD);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-10 font-sans sm:px-6 sm:py-16">
      <main className="flex w-full max-w-sm flex-col gap-6">
        <h1 className="px-1 text-center text-2xl font-semibold tracking-tight text-foreground sm:text-left sm:text-3xl">
          Prihlásenie
        </h1>
        <form action={login} className="card flex flex-col gap-4">
          <input type="hidden" name="next" value={safeNextPath(next)} />
          <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
            Heslo
            <input
              type="password"
              name="password"
              required
              autoFocus
              autoComplete="current-password"
              className="field"
            />
          </label>
          {error && <p className="text-sm text-danger">Nesprávne heslo.</p>}
          {!configured && (
            <p className="text-sm text-danger">
              SUBPAGES_PASSWORD nie je nastavené na serveri.
            </p>
          )}
          <button type="submit" className="btn-primary">
            Prihlásiť sa
          </button>
        </form>
      </main>
    </div>
  );
}
