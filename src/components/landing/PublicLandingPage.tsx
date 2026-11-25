/**
 * PublicLandingPage — what a visitor sees before they sign in.
 *
 * One idea leads: a real claim moving from code to payment (ClaimLifecycle).
 * Everything around it is quiet. The tutorials come next because the question
 * a prospective student asks is "what will I actually do in here?"; then the
 * two tracks, then how to enroll. Set in Public Sans, the typeface of the US
 * Web Design System that CMS's own sites use.
 *
 * Content kept from the previous page: both tracks and their features, the
 * price, the four enrollment steps, Student Login and Admin Panel links.
 */

import "@fontsource-variable/public-sans";
import { Link } from "@tanstack/react-router";
import {
  BadgeDollarSign,
  BarChart3,
  ClipboardList,
  FileText,
  Hash,
  LayoutGrid,
  ListChecks,
  Mic,
  Receipt,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Smile,
  Stethoscope,
} from "lucide-react";
import { ClaimLifecycle } from "./ClaimLifecycle";
import { TutorialGuides } from "./TutorialGuides";
import { TUTORIAL_PATIENT_TIP } from "../../domain/howToTutorials";

const FONT = { fontFamily: "'Public Sans Variable', 'Public Sans', system-ui, sans-serif" };

const medicalStages = [
  { icon: FileText, title: "Scribe — clinical charting", desc: "Vitals, HPI, review of systems and a structured SOAP note, signed and locked for the coder." },
  { icon: Search, title: "Coder — ICD-10 and CPT", desc: "Search the code sets, put the diagnoses in order, link each procedure and check the E/M level." },
  { icon: ShieldCheck, title: "Prior authorization", desc: "Match documentation to payer criteria and submit the request before the service is billed." },
  { icon: BadgeDollarSign, title: "Biller — claims", desc: "Build the CMS-1500, clear the edit checks, send the 837P and read the 277CA." },
  { icon: RefreshCw, title: "Payment posting and denials", desc: "Post the 835, read every CARC, then correct, appeal or bill the patient." },
  { icon: Mic, title: "AR voice follow-up", desc: "Call an insurance rep about a denied claim, with accent practice for US calls." },
];

const dentalFeatures = [
  { icon: Hash, title: "CDT coding", desc: "Procedures with tooth, surface and quadrant." },
  { icon: LayoutGrid, title: "Odontogram and perio chart", desc: "Tooth charting with pocket depths and mobility." },
  { icon: FileText, title: "ADA J430D claim form", desc: "Line-level paid, downgraded and denied results." },
  { icon: Scale, title: "12-step adjudication", desc: "Maximums, frequency limits, waiting periods, alternate benefits." },
  { icon: ClipboardList, title: "Treatment planning", desc: "Per-item insurance estimates, accepted to completed." },
  { icon: ListChecks, title: "Claim status queue", desc: "Created, sent, pending, paid, denied, appealed." },
  { icon: BarChart3, title: "Patient ledger", desc: "Charges, payments, adjustments and 30/60/90+ aging." },
  { icon: Receipt, title: "EOB / ERA and appeals", desc: "A guided path from denial to appeal letter." },
];

const enrollSteps = [
  { title: "Pay $20 / 5,500 PKR", desc: "UBL, EasyPaisa or PayPal." },
  { title: "Send your request", desc: "Fill in the form with your transaction ID." },
  { title: "Get approved", desc: "An admin activates your phone number." },
  { title: "Start practising", desc: "Log in with your phone number." },
];

export function PublicLandingPage() {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-slate-50 text-slate-800" style={FONT}>
      {/* Hero, with the nav sitting on the same navy */}
      <header className="relative isolate overflow-hidden bg-[#192166] text-white">
        {/* Faint ruled lines, like the boxes of a claim form */}
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
          aria-hidden="true"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "88px 44px",
          }}
        />
        <div className="pointer-events-none absolute -right-40 top-10 -z-10 h-[520px] w-[520px] rounded-full bg-[#2040c0] opacity-40 blur-[120px]" aria-hidden="true" />

        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <span className="rounded-lg bg-white px-2.5 py-1.5">
            <img src="/healthcarehustlers-logo.png" alt="Healthcare Hustlers" className="h-6 w-auto" style={{ maxWidth: "150px" }} />
          </span>
          <div className="flex items-center gap-1 text-sm">
            <a href="#tutorials" className="hidden rounded-lg px-3 py-2 text-white/80 hover:text-white sm:inline-block">
              Tutorials
            </a>
            <a href="#tracks" className="hidden rounded-lg px-3 py-2 text-white/80 hover:text-white sm:inline-block">
              Tracks
            </a>
            <Link to="/login" className="rounded-lg px-3 py-2 font-medium text-white hover:bg-white/10">
              Student login
            </Link>
            <Link to="/admin" className="rounded-lg border border-white/25 px-3 py-2 font-medium text-white/90 hover:bg-white/10">
              Admin
            </Link>
          </div>
        </nav>

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 md:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] md:pb-24 md:pt-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[13px] text-white/85">
              <span className="h-1.5 w-1.5 rounded-full bg-[#8fba47]" aria-hidden="true" />
              Medical + dental RCM training, one login
            </p>
            <h1 className="mt-5 max-w-[16ch] text-[2.6rem] font-extrabold leading-[1.05] tracking-[-0.02em] md:text-[3.6rem]">
              Work a real claim from chart to payment.
            </h1>
            <p className="mt-5 max-w-[52ch] text-[17px] leading-relaxed text-white/75">
              Register the patient, chart the visit, code it, send the claim, post the 835 and work the denials —
              the same steps a US billing team does every day, in an EHR built for practice.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/access"
                className="rounded-xl bg-[#8fba47] px-6 py-3.5 text-[15px] font-bold text-[#14200a] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Enroll now — $20 / 5,500 PKR
              </Link>
              <Link
                to="/login"
                className="rounded-xl px-5 py-3.5 text-[15px] font-semibold text-white ring-1 ring-white/30 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Student login
              </Link>
            </div>
            <p className="mt-4 text-[13px] text-white/55">One fee unlocks both the medical and the dental track.</p>
          </div>

          <div className="flex justify-center md:justify-end">
            <ClaimLifecycle />
          </div>
        </div>
      </header>

      {/* Tutorials */}
      <section id="tutorials" className="mx-auto max-w-6xl scroll-mt-6 px-5 py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-[-0.01em] text-slate-900">Learn the EHR in six short tutorials</h2>
          <p className="mt-3 text-[16px] leading-relaxed text-slate-600">
            Each one follows a single step of the visit, with the button names exactly as they appear on screen.
          </p>
        </div>
        <p className="mt-6 max-w-3xl rounded-xl border-l-4 border-[#8fba47] bg-white px-4 py-3 text-[14px] leading-relaxed text-slate-600 ring-1 ring-slate-200">
          {TUTORIAL_PATIENT_TIP}
        </p>
        <div className="mt-8">
          <TutorialGuides />
        </div>
      </section>

      {/* Tracks */}
      <section id="tracks" className="scroll-mt-6 border-y border-slate-200 bg-white py-20">
        <div className="mx-auto grid max-w-6xl gap-14 px-5 lg:grid-cols-2">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef1fc] text-[#2040c0]">
                <Stethoscope className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Medical track</h2>
                <p className="text-sm text-slate-500">A seven-stage encounter, exam room to final payment</p>
              </div>
            </div>
            <ul className="mt-8 divide-y divide-slate-100">
              {medicalStages.map((f) => (
                <li key={f.title} className="flex gap-4 py-4">
                  <f.icon className="mt-0.5 h-5 w-5 shrink-0 text-[#2040c0]" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-slate-900">{f.title}</p>
                    <p className="mt-0.5 text-[14px] leading-relaxed text-slate-600">{f.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e6f4f2] text-[#0f766e]">
                <Smile className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Dental track</h2>
                <p className="text-sm text-slate-500">Built on Dentrix, Eaglesoft and Open Dental workflows</p>
              </div>
            </div>
            <ul className="mt-8 grid gap-x-6 sm:grid-cols-2">
              {dentalFeatures.map((f) => (
                <li key={f.title} className="flex gap-3 border-b border-slate-100 py-4">
                  <f.icon className="mt-0.5 h-5 w-5 shrink-0 text-[#0f766e]" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-slate-900">{f.title}</p>
                    <p className="mt-0.5 text-[14px] leading-relaxed text-slate-600">{f.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Enroll */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-3xl font-bold tracking-[-0.01em] text-slate-900">Get started in four steps</h2>
        <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {enrollSteps.map((step, i) => (
            <li key={step.title} className="relative">
              {i < enrollSteps.length - 1 && (
                <span className="absolute left-12 right-0 top-5 hidden h-px bg-slate-300 lg:block" aria-hidden="true" />
              )}
              <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#192166] text-sm font-bold text-white tabular-nums">
                {i + 1}
              </span>
              <p className="mt-4 font-semibold text-slate-900">{step.title}</p>
              <p className="mt-1 text-[14px] text-slate-600">{step.desc}</p>
            </li>
          ))}
        </ol>
        <Link
          to="/access"
          className="mt-12 inline-block rounded-xl bg-[#192166] px-6 py-3.5 text-[15px] font-bold text-white hover:bg-[#1a2888] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2040c0]"
        >
          Enroll now — $20 / 5,500 PKR
        </Link>
      </section>

      <footer className="border-t border-slate-200 bg-white px-5 py-6 text-center text-[13px] text-slate-500">
        www.healthcarehustlers.org — Healthcare Hustlers EHR Simulation Portal. Every patient, payer and fee is
        fictional and for teaching only.
      </footer>
    </div>
  );
}
