/**
 * AuthShell — the frame around Student login and the staff sign-in pages.
 *
 * The same navy and faint claim-form ruling as the landing page's hero, so a
 * student who taps "Student login" lands somewhere that is visibly the same
 * product. Desktop: a navy panel on the left, the form on the right. Phone: a
 * short navy band with the logo and title, the form under it — the form is
 * never pushed below the fold by decoration.
 */

import "@fontsource-variable/public-sans";
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export const AUTH_FONT = { fontFamily: "'Public Sans Variable', 'Public Sans', system-ui, sans-serif" };

const RULED = {
  backgroundImage:
    "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
  backgroundSize: "88px 44px",
};

interface AuthShellProps {
  /** The page's own heading, e.g. "Student login". */
  title: string;
  /** One sentence under the heading. */
  subtitle: string;
  /** Desktop-only panel content under the heading (what's inside, help). */
  aside?: ReactNode;
  /** Links in the top-right corner. */
  nav?: ReactNode;
  children: ReactNode;
}

export function AuthShell({ title, subtitle, aside, nav, children }: AuthShellProps) {
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-800 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" style={AUTH_FONT}>
      {/* Navy panel — full height on desktop, a band on phones */}
      <aside className="relative isolate overflow-hidden bg-[#192166] text-white">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]" aria-hidden="true" style={RULED} />
        <div
          className="pointer-events-none absolute -bottom-40 -left-32 -z-10 h-[460px] w-[460px] rounded-full bg-[#2040c0] opacity-40 blur-[120px]"
          aria-hidden="true"
        />
        <div className="flex h-full flex-col px-5 pb-8 pt-4 lg:px-14 lg:pb-14 lg:pt-8">
          <div className="flex items-center justify-between gap-3">
            <Link to="/" className="rounded-lg bg-white px-2.5 py-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              <img src="/healthcarehustlers-logo.png" alt="Healthcare Hustlers — home" className="h-6 w-auto" style={{ maxWidth: "150px" }} />
            </Link>
            <div className="flex items-center gap-1 text-sm lg:hidden">{nav}</div>
          </div>

          <div className="mt-8 lg:mt-auto lg:mb-auto">
            <h1 className="text-[2rem] font-extrabold leading-tight tracking-[-0.02em] lg:text-[2.8rem]">{title}</h1>
            <p className="mt-2 max-w-[44ch] text-[15px] leading-relaxed text-white/75 lg:text-[17px]">{subtitle}</p>
            {aside && <div className="mt-10 hidden lg:block">{aside}</div>}
          </div>

          <p className="mt-10 hidden text-[13px] text-white/45 lg:block">
            Every patient, payer and fee in the simulator is fictional and for teaching only.
          </p>
        </div>
      </aside>

      {/* Form side */}
      <main className="flex flex-col px-5 pb-12 pt-6 lg:px-14 lg:pt-8">
        <div className="hidden items-center justify-end gap-1 text-sm lg:flex">{nav}</div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-4 lg:py-10">{children}</div>
      </main>
    </div>
  );
}

/** A nav link styled for whichever side of the shell it lands on. */
export function AuthNavLink({ to, children }: { to: "/" | "/login" | "/access" | "/admin"; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-lg px-3 py-2 font-medium text-white/85 hover:bg-white/10 lg:text-slate-600 lg:hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2040c0]"
    >
      {children}
    </Link>
  );
}
