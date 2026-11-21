/**
 * /payments — the Payments rail page
 *
 * Inspired by: the 835 / ERA posting queue every practice management system
 * keeps — Epic's Remittance worklist, eClinicalWorks' Payment Posting. It answers
 * one question: which payer answered, and whose money has not reached the ledger
 * yet?
 *
 * Spec `eleven-rail-pages.md` (owner decision, 2026-11-20). A row here is one of
 * the student's own 835s with **no `postedAt`** — the payer has adjudicated the
 * claim, the 835 is on the encounter, and nothing has been posted from it. The
 * payer, the payment date, the paid amount and the line count are the 835's own
 * fields; none of them is typed on this page.
 *
 * A posted 835 is not on this page: its money is on the ledger, and its unpaid
 * lines are the AR work on `/denials-ar`.
 *
 * The dental track posts no 835 at all (`specs/eleven-rail-pages.md` § honest
 * limits), so its section shows what its ledger actually holds — the insurance
 * payments recorded there — and says so, rather than dressing a ledger entry as
 * an 835.
 */

import { useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { PatientProvider, usePatientStore } from "../store/patientStore";
import { PipelineProvider, usePipeline, type Role } from "../store/pipelineStore";
import { useActiveTrack } from "../components/shell/activeTrack";
import { requestPatientOpen } from "../components/shell/pendingPatient";
import { readDentalTrackRecord } from "../components/dental/DentalTrackStore";
import {
  buildDentalPaymentRows,
  buildPaymentRows,
  dentalCaseLabel,
  type RailRow,
} from "../domain/railPages";
import {
  RailEmptyState,
  RailNote,
  RailPageHeader,
  RailRowList,
  RailSection,
  railFooter,
} from "../components/rail/RailPageFrame";

export const Route = createFileRoute("/payments")({
  component: () => (
    <PatientProvider>
      <PipelineProvider>
        <PaymentsPage />
      </PipelineProvider>
    </PatientProvider>
  ),
});

function PaymentsPage() {
  // The stored track, live (owner item 4): the header switch and the page agree.
  const track = useActiveTrack();
  const navigate = useNavigate();
  const { allEncounters, activePatientId } = usePipeline();
  const { getPatientById } = usePatientStore();
  const dental = useMemo(() => readDentalTrackRecord(), []);

  const nameForPatient = (patientId: string | null | undefined, fallback?: string | null): string => {
    const patient = patientId ? getPatientById(patientId) : undefined;
    if (patient) return `${patient.firstName} ${patient.lastName}`;
    return fallback ?? "No patient attached";
  };

  const remittances = useMemo<RailRow[]>(
    () => buildPaymentRows({ encounters: Object.values(allEncounters), nameForPatient }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allEncounters, getPatientById],
  );
  const dentalPayments = useMemo<RailRow[]>(
    () => buildDentalPaymentRows(dental, dentalCaseLabel(dental)),
    [dental],
  );

  const openStage = (patientId: string | null, role: Role) => {
    requestPatientOpen(patientId, undefined, role);
    void navigate({ to: "/" });
  };

  return (
    <AppShell
      track={track}
      activeNav="payments"
      selectedPatientId={activePatientId ?? undefined}
      footer={railFooter}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <RailPageHeader
          icon={Wallet}
          title="Payments"
          purpose="835 remittances waiting to be posted to the ledger."
          count={remittances.length}
          countLabel={
            remittances.length === 1 ? "remittance waiting to be posted" : "remittances waiting to be posted"
          }
        />

        {remittances.length === 0 ? (
          <RailEmptyState nextStep="a remittance appears once a claim is accepted and adjudicated. Open the Biller stage, submit the claim and ask the payer to adjudicate it." />
        ) : (
          <RailRowList rows={remittances} onOpenMedical={openStage} />
        )}

        <RailSection title="Dental" count={dentalPayments.length}>
          {dentalPayments.length === 0 ? (
            <RailEmptyState nextStep="post a dental payment in the dental track's Remittance stage — it lands on that case's ledger, and the ledger is what this section reads." />
          ) : (
            <RailRowList rows={dentalPayments} onOpenMedical={openStage} />
          )}
        </RailSection>

        <RailNote>
          The dental track posts no 835: its Remittance stage writes to the case ledger, so the dental section shows
          the insurance payments that ledger holds. A medical 835 disappears from this page the moment it is posted —
          its money is then on the ledger and its unpaid lines are on Denials and AR.
        </RailNote>
        </div>
      </div>
    </AppShell>
  );
}
