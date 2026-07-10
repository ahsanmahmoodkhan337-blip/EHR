// ──────────────────────────────────────────────────────────────────────
// ARVoiceSimulator.tsx — AR Voice Specialist Workstation (Stage 5)
// Comprehensive AR tool: aging ledger, call scripts, appeal letter generator,
// accent practice mode, and escalation workflow.
// Inspired by: Epic Resolute Hospital Billing AR Workbench
// ──────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import {
  Phone,
  PhoneCall,
  Clock,
  AlertTriangle,
  CheckCircle2,
  UserPlus,
  MessageSquare,
  ChevronDown,
  Filter,
  DollarSign,
  FileText,
  BookOpen,
  Mic,
  MicOff,
  Copy,
  Check,
  ThumbsUp,
  ArrowUpCircle,
  XCircle,
  ClipboardList,
  Building2,
  Save,
  Play,
  Square,
  Volume2,
  Star,
} from "lucide-react";
import { usePipeline, type DeniedClaim, type ARCallRecord } from "../../store/pipelineStore";
import { scoreARVoice, updateStageScore, getStudentName } from "../../utils/scoring";
import {
  INSURANCE_CARRIERS,
  APPEAL_TEMPLATES,
  AR_SCENARIOS,
  BUCKET_SCRIPTS,
  AGING_LEDGER_DATA,
  AGING_LEDGER_TOTAL,
} from "./arData";

type TabView = "ledger" | "calls" | "scripts" | "appeals" | "scenarios" | "carriers";

export default function ARVoiceSimulator() {
  const pipeline = usePipeline();
  const {
    state,
    resolveDenial,
    assignDenial,
    addCallRecord,
    getClaimsByAging,
    arCalls,
  } = pipeline;

  const [activeTab, setActiveTab] = useState<TabView>("ledger");
  const [selectedBucket, setSelectedBucket] = useState<string>("0-30");
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null);
  const [accentMode, setAccentMode] = useState(false);
  const [arScore, setArScore] = useState<number | null>(null);

  // ── Speech Synthesis (American Accent Audio) ──
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingText, setSpeakingText] = useState("");
  const [voicesLoaded, setVoicesLoaded] = useState(false);

  useEffect(() => {
    // Load voices — they may not be available immediately
    const loadVoices = () => {
      if (window.speechSynthesis.getVoices().length > 0) {
        setVoicesLoaded(true);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const getAmericanVoice = (): SpeechSynthesisVoice | null => {
    const voices = window.speechSynthesis.getVoices();
    // Prefer a voice with "en-US" lang
    const american = voices.find((v) => v.lang.startsWith("en-US"));
    return american || voices.find((v) => v.lang.startsWith("en")) || null;
  };

  const speak = (text: string) => {
    // Cancel any current speech
    window.speechSynthesis.cancel();
    if (!text.trim()) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.9; // Slightly slower for learners
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voice = getAmericanVoice();
    if (voice) utterance.voice = voice;

    setIsSpeaking(true);
    setSpeakingText(text);

    utterance.onend = () => {
      setIsSpeaking(false);
      setSpeakingText("");
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setSpeakingText("");
    };

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setSpeakingText("");
  };

  const isCurrentlyPlaying = (text: string) => isSpeaking && speakingText === text;

  // Appeal letter state
  const [selectedAppeal, setSelectedAppeal] = useState(APPEAL_TEMPLATES[0].id);
  const [appealPatientName, setAppealPatientName] = useState("");
  const [appealClaimId, setAppealClaimId] = useState("");
  const [copiedAppeal, setCopiedAppeal] = useState(false);

  // Scenario state
  const [selectedScenario, setSelectedScenario] = useState(0);
  const [scenarioNote, setScenarioNote] = useState("");

  // Call script bucket
  const [scriptBucket, setScriptBucket] = useState<string>("0-30");

  const claimsByAging = getClaimsByAging();

  // ─── Bucket stats ────────────────────────────────────────────────
  const bucketStats = [
    { key: "0-30", label: "0-30 Days", count: (claimsByAging["0-30"] ?? []).length + AGING_LEDGER_DATA[0].totalClaims, color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    { key: "31-60", label: "31-60 Days", count: (claimsByAging["31-60"] ?? []).length + AGING_LEDGER_DATA[1].totalClaims, color: "bg-orange-100 text-orange-700 border-orange-200" },
    { key: "61-90", label: "61-90 Days", count: (claimsByAging["61-90"] ?? []).length + AGING_LEDGER_DATA[2].totalClaims, color: "bg-red-100 text-red-700 border-red-200" },
    { key: "90+", label: "90+ Days", count: (claimsByAging["90+"] ?? []).length + AGING_LEDGER_DATA[3].totalClaims, color: "bg-rose-100 text-rose-700 border-rose-300" },
  ];

  const currentClaims = claimsByAging[selectedBucket] ?? [];

  // ─── Handlers ────────────────────────────────────────────────────
  const handleLogCall = (claim: DeniedClaim, outcome: ARCallRecord["outcome"]) => {
    const record: ARCallRecord = {
      id: `call-${Date.now()}`,
      claimId: claim.id,
      patientName: claim.patientName,
      caller: "AR Agent",
      timestamp: new Date().toISOString(),
      duration: Math.floor(Math.random() * 600) + 30,
      outcome,
    };
    addCallRecord(record);
  };

  const handleCopyAppeal = () => {
    const template = APPEAL_TEMPLATES.find((t) => t.id === selectedAppeal);
    if (!template) return;
    const letter = template.body
      .replace(/\[Patient Name\]/g, appealPatientName || "[Patient Name]")
      .replace(/\[Claim ID\]/g, appealClaimId || "[Claim ID]")
      .replace(/\[Payer Name\]/g, "Insurance Company Name");
    navigator.clipboard.writeText(letter).then(() => {
      setCopiedAppeal(true);
      setTimeout(() => setCopiedAppeal(false), 2000);
    });
  };

  const statusColors: Record<string, string> = {
    unresolved: "bg-red-100 text-red-700",
    "in-progress": "bg-amber-100 text-amber-700",
    resolved: "bg-green-100 text-green-700",
    escalated: "bg-purple-100 text-purple-700",
  };

  // ─── Tabs ─────────────────────────────────────────────────────────
  const tabs: { key: TabView; label: string; icon: React.ReactNode }[] = [
    { key: "ledger", label: "Aging Ledger", icon: <DollarSign className="h-3.5 w-3.5" /> },
    { key: "calls", label: "Claims", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
    { key: "scripts", label: "Call Scripts", icon: <Phone className="h-3.5 w-3.5" /> },
    { key: "appeals", label: "Appeal Letters", icon: <FileText className="h-3.5 w-3.5" /> },
    { key: "scenarios", label: "Practice Scenarios", icon: <BookOpen className="h-3.5 w-3.5" /> },
    { key: "carriers", label: "Carrier Info", icon: <Building2 className="h-3.5 w-3.5" /> },
  ];

  // ─── RENDER ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-2">
          <PhoneCall className="h-4 w-4 text-sky-600" />
          <h2 className="text-sm font-bold text-slate-800">AR Voice Specialist</h2>
          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700">Stage 5</span>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
            {arCalls.length} Calls
          </span>
        </div>
        <button
          onClick={() => setAccentMode(!accentMode)}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
            accentMode
              ? "border-green-300 bg-green-50 text-green-700"
              : "border-slate-200 text-slate-500 hover:bg-slate-50"
          }`}
        >
          {accentMode ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
          {accentMode ? "Accent Practice ON" : "Accent Practice OFF"}
        </button>
      </div>

      {/* ── Sub-tabs ── */}
      <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50 px-2 gap-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap px-2.5 py-2 text-[10px] font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-sky-600 text-sky-700 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ═══ TAB: AGING LEDGER ═══ */}
        {activeTab === "ledger" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700">AR Aging Ledger</p>
              <p className="text-[10px] font-medium text-slate-500">
                Total AR: <span className="font-bold text-slate-700">${AGING_LEDGER_TOTAL.totalAmount.toLocaleString()}</span>
                {" "}| {AGING_LEDGER_TOTAL.totalClaims} Claims
              </p>
            </div>

            {/* Aging summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {AGING_LEDGER_DATA.map((bucket) => (
                <div
                  key={bucket.bucket}
                  className={`rounded-lg border p-3 ${bucket.color}`}
                >
                  <p className="text-[10px] font-medium text-slate-500">{bucket.label}</p>
                  <p className="text-lg font-bold text-slate-800">${bucket.totalAmount.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-500">{bucket.totalClaims} claims</p>
                </div>
              ))}
            </div>

            {/* Aging chart (bar visualization) */}
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="mb-3 text-[10px] font-semibold text-slate-600">Aging Distribution by Dollar Amount</p>
              <div className="space-y-2">
                {AGING_LEDGER_DATA.map((bucket) => {
                  const pct = (bucket.totalAmount / AGING_LEDGER_TOTAL.totalAmount) * 100;
                  const barColorMap: Record<string, string> = {
                    "0-30": "bg-yellow-400",
                    "31-60": "bg-orange-400",
                    "61-90": "bg-red-400",
                    "90+": "bg-rose-500",
                  };
                  return (
                    <div key={bucket.bucket} className="space-y-0.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-medium text-slate-600">{bucket.label}</span>
                        <span className="text-slate-500">
                          ${bucket.totalAmount.toLocaleString()} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-3 w-full rounded-full bg-slate-100">
                        <div
                          className={`h-3 rounded-full ${barColorMap[bucket.bucket] || "bg-slate-400"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top carrier breakdown */}
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="mb-2 text-[10px] font-semibold text-slate-600">Top Aging by Payer</p>
              <div className="space-y-1.5">
                {["United Healthcare", "Blue Cross", "Medicare", "Aetna", "Medicaid"].map((payer, i) => {
                  const amt = [18500, 14200, 9800, 7500, 5200][i];
                  return (
                    <div key={payer} className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-600">{payer}</span>
                      <span className="font-medium text-slate-700">${amt.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Practice tip */}
            <div className="rounded-lg border border-sky-100 bg-sky-50 p-3">
              <p className="text-[10px] font-medium text-sky-700">
                <ClipboardList className="mr-1 inline h-3 w-3" />
                RCM Pro Tip
              </p>
              <p className="mt-1 text-[10px] text-sky-600">
                The aging ledger should be reviewed DAILY. Focus on the 90+ day bucket first — these claims are
                at highest risk of becoming non-collectible. A good AR team keeps &lt;15% of total AR in the 90+ bucket.
                Current: {(AGING_LEDGER_DATA[3].totalAmount / AGING_LEDGER_TOTAL.totalAmount * 100).toFixed(0)}%.
              </p>
            </div>
          </div>
        )}

        {/* ═══ TAB: CLAIMS (CALLS) ═══ */}
        {activeTab === "calls" && (
          <div className="space-y-4">
            {/* Bucket tabs */}
            <div className="flex flex-wrap gap-2">
              {bucketStats.map((b) => (
                <button
                  key={b.key}
                  onClick={() => setSelectedBucket(b.key)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-medium transition-all ${
                    selectedBucket === b.key
                      ? `${b.color} ring-1 ring-slate-400`
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  {b.label}
                  <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[9px] ${
                    selectedBucket === b.key ? "bg-white/60" : "bg-slate-100"
                  }`}>
                    {b.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Claims list */}
            {currentClaims.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="mb-2 h-10 w-10 text-green-400" />
                <p className="text-sm font-medium text-slate-500">No claims in this bucket</p>
                <p className="text-xs text-slate-400">All resolved. Simulate a denial in Stage 3 to populate this view.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {currentClaims.map((claim) => (
                  <div key={claim.id} className="rounded-lg border border-slate-200 bg-white shadow-sm">
                    <button
                      onClick={() => setExpandedClaim(expandedClaim === claim.id ? null : claim.id)}
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                        <div>
                          <p className="text-[11px] font-medium text-slate-700">
                            Claim #{claim.id.slice(-8)}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            ${claim.amount.toFixed(2)} — {claim.reason}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                          statusColors[claim.resolutionStatus] ?? "bg-slate-100 text-slate-600"
                        }`}>
                          {claim.resolutionStatus.replace("-", " ")}
                        </span>
                        <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${
                          expandedClaim === claim.id ? "rotate-180" : ""
                        }`} />
                      </div>
                    </button>

                    {expandedClaim === claim.id && (
                      <div className="border-t border-slate-100 px-3 py-3">
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div><span className="text-slate-400">Patient:</span><p className="font-medium">{claim.patientName || "N/A"}</p></div>
                          <div><span className="text-slate-400">Denied:</span><p className="font-medium">{new Date(claim.deniedAt).toLocaleDateString()}</p></div>
                          <div><span className="text-slate-400">Amount:</span><p className="font-medium">${claim.amount.toFixed(2)}</p></div>
                          <div><span className="text-slate-400">Assigned:</span><p className="font-medium">{claim.assignedTo || "Unassigned"}</p></div>
                        </div>

                        {/* Call buttons */}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {["reached-patient", "left-voicemail", "promised-payment", "no-answer"].map((outcome) => (
                            <button
                              key={outcome}
                              onClick={() => handleLogCall(claim, outcome as ARCallRecord["outcome"])}
                              className="flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[9px] font-medium text-slate-600 hover:bg-slate-50"
                            >
                              <Phone className="h-2.5 w-2.5" />
                              {outcome.replace(/-/g, " ")}
                            </button>
                          ))}
                        </div>

                        {/* Escalation buttons */}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <button onClick={() => resolveDenial(claim.id, "resolved")}
                            className="flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-[9px] font-medium text-white hover:bg-green-500">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Resolve
                          </button>
                          <button onClick={() => resolveDenial(claim.id, "escalated")}
                            className="flex items-center gap-1 rounded bg-purple-600 px-2 py-1 text-[9px] font-medium text-white hover:bg-purple-500">
                            <UserPlus className="h-2.5 w-2.5" /> Escalate
                          </button>
                          <button onClick={() => resolveDenial(claim.id, "in-progress")}
                            className="flex items-center gap-1 rounded bg-amber-600 px-2 py-1 text-[9px] font-medium text-white hover:bg-amber-500">
                            <MessageSquare className="h-2.5 w-2.5" /> In Progress
                          </button>
                          <button onClick={() => resolveDenial(claim.id, "resolved")}
                            className="flex items-center gap-1 rounded bg-slate-600 px-2 py-1 text-[9px] font-medium text-white hover:bg-slate-500">
                            <XCircle className="h-2.5 w-2.5" /> Write Off
                          </button>
                          {/* Read claim audio button */}
                          <button
                            onClick={() => {
                              const text = `Claim ${claim.id.slice(-8)}. Patient: ${claim.patientName || "Unknown"}. Amount: ${claim.amount.toFixed(2)} dollars. Reason: ${claim.reason}. Status: ${claim.resolutionStatus.replace("-", " ")}.`;
                              if (isCurrentlyPlaying(text)) {
                                stopSpeaking();
                              } else {
                                speak(text);
                              }
                            }}
                            className={`flex items-center gap-1 rounded px-2 py-1 text-[9px] font-medium transition-colors ${
                              isCurrentlyPlaying(`Claim ${claim.id.slice(-8)}.`)
                                ? "bg-red-100 text-red-700 animate-pulse"
                                : "bg-sky-100 text-sky-700 hover:bg-sky-200"
                            }`}
                          >
                            {isCurrentlyPlaying(`Claim ${claim.id.slice(-8)}.`) ? (
                              <><Square className="h-2.5 w-2.5" /> Stop</>
                            ) : (
                              <><Volume2 className="h-2.5 w-2.5" /> Read Claim</>
                            )}
                          </button>
                        </div>

                        {/* Call history */}
                        {arCalls.filter((c) => c.claimId === claim.id).length > 0 && (
                          <div className="mt-2 rounded bg-slate-50 p-2">
                            <p className="mb-1 text-[9px] font-medium text-slate-500">Call History</p>
                            {arCalls.filter((c) => c.claimId === claim.id).slice(0, 3).map((call) => (
                              <div key={call.id} className="flex items-center justify-between py-0.5 text-[9px]">
                                <span className="text-slate-600">{call.outcome.replace(/-/g, " ")}</span>
                                <span className="text-slate-400">{Math.floor(call.duration / 60)}m {call.duration % 60}s</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Accent practice callout */}
            {accentMode && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="text-[10px] font-medium text-green-700">
                  <Mic className="mr-1 inline h-3 w-3" />
                  Accent Practice Mode Active
                </p>
                <p className="mt-1 text-[10px] text-green-600">
                  Read the claim details out loud in a professional American/neutral accent. Focus on clear
                  enunciation of claim numbers, dollar amounts, and denial codes. Use the Call Scripts tab for
                  full dialogues to practice.
                </p>
                {currentClaims.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => {
                        const claim = currentClaims[0];
                        const text = `Sample claim. Claim number ${claim.id.slice(-8)}. Patient: ${claim.patientName || "Unknown"}. Amount: ${claim.amount.toFixed(2)} dollars. Reason: ${claim.reason}.`;
                        if (isCurrentlyPlaying(text)) {
                          stopSpeaking();
                        } else {
                          speak(text);
                        }
                      }}
                      className={`flex items-center gap-1 rounded px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
                        isCurrentlyPlaying(`Sample claim.`)
                          ? "bg-red-100 text-red-700 animate-pulse"
                          : "bg-green-600 text-white hover:bg-green-500"
                      }`}
                    >
                      {isCurrentlyPlaying(`Sample claim.`) ? (
                        <><Square className="h-3.5 w-3.5" /> Stop Playback</>
                      ) : (
                        <><Play className="h-3.5 w-3.5" /> Hear Sample Claim</>
                      )}
                    </button>
                    {isCurrentlyPlaying(`Sample claim.`) && (
                      <span className="text-[9px] text-green-600 animate-pulse">🔊 Playing...</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: CALL SCRIPTS ═══ */}
        {activeTab === "scripts" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-slate-700">AR Call Scripts</p>
              <select
                value={scriptBucket}
                onChange={(e) => setScriptBucket(e.target.value)}
                className="rounded border border-slate-200 px-2 py-1 text-[10px] outline-none focus:border-sky-300"
              >
                {Object.entries(BUCKET_SCRIPTS).map(([key]) => (
                  <option key={key} value={key}>{AGING_LEDGER_DATA.find(d => d.bucket === key)?.label || key}</option>
                ))}
              </select>
            </div>

            {BUCKET_SCRIPTS[scriptBucket] && (
              <div className="rounded-xl border border-sky-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Phone className="h-4 w-4 text-sky-600" />
                  <p className="text-xs font-semibold text-sky-700">{BUCKET_SCRIPTS[scriptBucket].bucket} — Call Script</p>
                </div>

                {/* Opening */}
                <div className="mb-3 rounded-lg border border-sky-100 bg-sky-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-sky-700">Opening Statement</p>
                    <button
                      onClick={() => {
                        if (isCurrentlyPlaying(BUCKET_SCRIPTS[scriptBucket].opening)) {
                          stopSpeaking();
                        } else {
                          speak(BUCKET_SCRIPTS[scriptBucket].opening);
                        }
                      }}
                      className={`flex items-center gap-1 rounded px-2 py-1 text-[9px] font-medium transition-colors ${
                        isCurrentlyPlaying(BUCKET_SCRIPTS[scriptBucket].opening)
                          ? "bg-red-100 text-red-700 animate-pulse"
                          : "bg-sky-100 text-sky-700 hover:bg-sky-200"
                      }`}
                      title={voicesLoaded ? "Play audio in American English" : "Loading voices..."}
                    >
                      {isCurrentlyPlaying(BUCKET_SCRIPTS[scriptBucket].opening) ? (
                        <><Square className="h-3 w-3" /> Stop</>
                      ) : (
                        <><Volume2 className="h-3 w-3" /> Play Audio</>
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-[10px] text-sky-600 leading-relaxed">{BUCKET_SCRIPTS[scriptBucket].opening}</p>
                </div>

                {/* Key questions */}
                <div className="mb-3">
                  <p className="mb-1.5 text-[10px] font-semibold text-slate-600">Key Questions to Ask</p>
                  <div className="space-y-1">
                    {BUCKET_SCRIPTS[scriptBucket].questions.map((q, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[10px] text-slate-600">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sky-100 text-[8px] font-bold text-sky-600">{i + 1}</span>
                        {q}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Closing */}
                <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold text-slate-600">Closing Statement</p>
                  <p className="mt-1 text-[10px] text-slate-500 italic">{BUCKET_SCRIPTS[scriptBucket].closing}</p>
                </div>

                {/* Tips */}
                <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
                  <p className="text-[10px] font-semibold text-amber-700">💡 Tips for this Bucket</p>
                  <p className="mt-1 text-[10px] text-amber-600">{BUCKET_SCRIPTS[scriptBucket].tips}</p>
                </div>
              </div>
            )}

            {accentMode && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="text-[10px] font-medium text-green-700">
                  <Mic className="mr-1 inline h-3 w-3" />
                  Accent Practice: Read the opening statement out loud 3 times
                </p>
                <p className="mt-1 text-[10px] text-green-600">
                  Focus on: clear enunciation, natural pausing at commas, stress on claim numbers and amounts.
                  Replace [bracketed] text with realistic values. Practice the questions in different orders.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (isCurrentlyPlaying(BUCKET_SCRIPTS[scriptBucket].opening)) {
                        stopSpeaking();
                      } else {
                        speak(BUCKET_SCRIPTS[scriptBucket].opening);
                      }
                    }}
                    className={`flex items-center gap-1 rounded px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
                      isCurrentlyPlaying(BUCKET_SCRIPTS[scriptBucket].opening)
                        ? "bg-red-100 text-red-700 animate-pulse"
                        : "bg-green-600 text-white hover:bg-green-500"
                    }`}
                  >
                    {isCurrentlyPlaying(BUCKET_SCRIPTS[scriptBucket].opening) ? (
                      <><Square className="h-3.5 w-3.5" /> Stop Playback</>
                    ) : (
                      <><Play className="h-3.5 w-3.5" /> Hear American Accent</>
                    )}
                  </button>
                  {isCurrentlyPlaying(BUCKET_SCRIPTS[scriptBucket].opening) && (
                    <span className="text-[9px] text-green-600 animate-pulse">🔊 Playing...</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: APPEAL LETTERS ═══ */}
        {activeTab === "appeals" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-sky-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-sky-600" />
                <p className="text-xs font-semibold text-slate-700">Appeal Letter Generator</p>
              </div>

              {/* Template selector */}
              <div className="mb-3">
                <label className="mb-1 block text-[10px] font-medium text-slate-500">Appeal Type</label>
                <select
                  value={selectedAppeal}
                  onChange={(e) => setSelectedAppeal(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-sky-400"
                >
                  {APPEAL_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>

              {/* Patient info */}
              <div className="mb-3 grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-slate-500">Patient Name</label>
                  <input
                    type="text"
                    value={appealPatientName}
                    onChange={(e) => setAppealPatientName(e.target.value)}
                    placeholder="Enter patient name..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[10px] outline-none focus:border-sky-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-slate-500">Claim ID</label>
                  <input
                    type="text"
                    value={appealClaimId}
                    onChange={(e) => setAppealClaimId(e.target.value)}
                    placeholder="Enter claim ID..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[10px] outline-none focus:border-sky-400"
                  />
                </div>
              </div>

              {/* Letter preview */}
              {APPEAL_TEMPLATES.filter((t) => t.id === selectedAppeal).map((template) => (
                <div key={template.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-semibold text-slate-600">{template.title}</p>
                    <button
                      onClick={handleCopyAppeal}
                      className="flex items-center gap-1 rounded bg-sky-600 px-2 py-1 text-[9px] font-medium text-white hover:bg-sky-500"
                    >
                      {copiedAppeal ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
                      {copiedAppeal ? "Copied!" : "Copy Letter"}
                    </button>
                  </div>
                  <p className="mb-2 text-[9px] text-amber-600 bg-amber-50 px-2 py-1 rounded">{template.reason}</p>
                  <pre className="whitespace-pre-wrap text-[10px] text-slate-700 leading-relaxed font-sans">
                    {template.body
                      .replace(/\[Patient Name\]/g, appealPatientName || "[Patient Name]")
                      .replace(/\[Claim ID\]/g, appealClaimId || "[Claim ID]")
                      .replace(/\[Payer Name\]/g, "Insurance Company Name")
                    }
                  </pre>
                </div>
              ))}
            </div>

            {/* Practice tip */}
            <div className="rounded-lg border border-sky-100 bg-sky-50 p-3">
              <p className="text-[10px] font-medium text-sky-700">
                <FileText className="mr-1 inline h-3 w-3" />
                Writing Tips
              </p>
              <ul className="mt-1 space-y-0.5 text-[10px] text-sky-600">
                <li>• Keep it to one page — appeals reviewers are busy</li>
                <li>• Reference the specific denial code (CO-16, CO-50, etc.)</li>
                <li>• Attach supporting documentation with a checklist</li>
                <li>• Send certified mail or use the payer's online appeal portal</li>
                <li>• Follow up within 30 days if no response</li>
                <li>• Include the original claim number on every page</li>
              </ul>
            </div>
          </div>
        )}

        {/* ═══ TAB: PRACTICE SCENARIOS ═══ */}
        {activeTab === "scenarios" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              {AR_SCENARIOS.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedScenario(i)}
                  className={`rounded-lg border p-2 text-left text-[10px] transition-colors ${
                    selectedScenario === i
                      ? "border-sky-300 bg-sky-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span className="font-medium text-slate-700">{s.title}</span>
                  <span className={`ml-1 rounded px-1 py-0.5 text-[8px] font-medium ${
                    s.type === "denied" ? "bg-red-100 text-red-600" :
                    s.type === "partial-pay" ? "bg-amber-100 text-amber-600" :
                    s.type === "underpaid" ? "bg-orange-100 text-orange-600" :
                    s.type === "overpaid" ? "bg-blue-100 text-blue-600" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {s.type.replace("-", " ")}
                  </span>
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-sky-200 bg-white p-4 shadow-sm">
              <p className="mb-2 text-xs font-semibold text-sky-700">{AR_SCENARIOS[selectedScenario].title}</p>

              {/* Description */}
              <div className="mb-3 rounded-lg bg-amber-50 p-3">
                <p className="text-[10px] font-medium text-amber-700">Scenario</p>
                <p className="mt-0.5 text-[10px] text-amber-600">{AR_SCENARIOS[selectedScenario].description}</p>
              </div>

              {/* Script */}
              <div className="mb-3 rounded-lg border border-sky-100 bg-sky-50 p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-semibold text-sky-700">
                    <Phone className="mr-1 inline h-3 w-3" />
                    What to Say
                  </p>
                  <button
                    onClick={() => {
                      if (isCurrentlyPlaying(AR_SCENARIOS[selectedScenario].script)) {
                        stopSpeaking();
                      } else {
                        speak(AR_SCENARIOS[selectedScenario].script);
                      }
                    }}
                    className={`flex items-center gap-1 rounded px-2 py-1 text-[9px] font-medium transition-colors ${
                      isCurrentlyPlaying(AR_SCENARIOS[selectedScenario].script)
                        ? "bg-red-100 text-red-700 animate-pulse"
                        : "bg-sky-100 text-sky-700 hover:bg-sky-200"
                    }`}
                    title="Play scenario script in American English"
                  >
                    {isCurrentlyPlaying(AR_SCENARIOS[selectedScenario].script) ? (
                      <><Square className="h-3 w-3" /> Stop</>
                    ) : (
                      <><Volume2 className="h-3 w-3" /> Play Audio</>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-sky-600 leading-relaxed">{AR_SCENARIOS[selectedScenario].script}</p>
              </div>

              {/* Resolution */}
              <div className="mb-3 rounded-lg border border-green-100 bg-green-50 p-3">
                <p className="mb-1 text-[10px] font-semibold text-green-700">
                  <ThumbsUp className="mr-1 inline h-3 w-3" />
                  Resolution Steps
                </p>
                <p className="text-[10px] text-green-600">{AR_SCENARIOS[selectedScenario].resolution}</p>
              </div>

              {/* Practice notes */}
              <div>
                <label className="mb-1 block text-[10px] font-medium text-slate-500">Your Practice Notes</label>
                <textarea
                  value={scenarioNote}
                  onChange={(e) => setScenarioNote(e.target.value)}
                  placeholder="Write your call notes here... What would you say differently?"
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[10px] outline-none focus:border-sky-400 resize-none"
                />
              </div>
            </div>

            {accentMode && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="text-[10px] font-medium text-green-700">
                  <Mic className="mr-1 inline h-3 w-3" />
                  Read the script out loud with a professional American accent. Focus on: "thirty" vs "thirteen" ($30 vs $13),
                  "ninety" vs "nineteen" ($90 vs $19), and "fourteen" / "forty" clarity.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (isCurrentlyPlaying(AR_SCENARIOS[selectedScenario].script)) {
                        stopSpeaking();
                      } else {
                        speak(AR_SCENARIOS[selectedScenario].script);
                      }
                    }}
                    className={`flex items-center gap-1 rounded px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
                      isCurrentlyPlaying(AR_SCENARIOS[selectedScenario].script)
                        ? "bg-red-100 text-red-700 animate-pulse"
                        : "bg-green-600 text-white hover:bg-green-500"
                    }`}
                  >
                    {isCurrentlyPlaying(AR_SCENARIOS[selectedScenario].script) ? (
                      <><Square className="h-3.5 w-3.5" /> Stop Playback</>
                    ) : (
                      <><Play className="h-3.5 w-3.5" /> Hear American Accent</>
                    )}
                  </button>
                  {isCurrentlyPlaying(AR_SCENARIOS[selectedScenario].script) && (
                    <span className="text-[9px] text-green-600 animate-pulse">🔊 Playing...</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: CARRIER INFO ��══ */}
        {activeTab === "carriers" && (
          <div className="space-y-4">
            <p className="text-xs font-semibold text-slate-700">Insurance Carrier Directory</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {INSURANCE_CARRIERS.map((carrier) => (
                <div key={carrier.name} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-4 w-4 text-sky-600" />
                    <p className="text-[11px] font-semibold text-slate-700">{carrier.name}</p>
                  </div>
                  <div className="space-y-1 text-[10px]">
                    <div className="flex items-start gap-1">
                      <Phone className="mt-0.5 h-2.5 w-2.5 text-slate-400" />
                      <span className="text-slate-600">{carrier.phone}</span>
                    </div>
                    <div className="flex items-start gap-1">
                      <Clock className="mt-0.5 h-2.5 w-2.5 text-slate-400" />
                      <span className="text-slate-600">{carrier.hours}</span>
                    </div>
                    <div className="flex items-start gap-1">
                      <Building2 className="mt-0.5 h-2.5 w-2.5 text-slate-400" />
                      <span className="text-slate-600">{carrier.department} | {carrier.waitTime}</span>
                    </div>
                  </div>
                  <div className="mt-2 rounded bg-sky-50 p-2 text-[9px] text-sky-600">
                    {carrier.notes}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-sky-100 bg-sky-50 p-3">
              <p className="text-[10px] font-medium text-sky-700">
                <Phone className="mr-1 inline h-3 w-3" />
                Call Prep Checklist
              </p>
              <ul className="mt-1 space-y-0.5 text-[10px] text-sky-600">
                <li>✓ Have patient ID, claim number, and DOS ready before dialing</li>
                <li>✓ Know the denial code and what you're asking for</li>
                <li>✓ Get a reference number for every call</li>
                <li>✓ Note the representative's name and ID</li>
                <li>✓ Follow up in writing after verbal agreements</li>
              </ul>
            </div>
          </div>
        )}

        {/* Complete Pipeline — marks all stages as done */}
        {arScore !== null && (
          <div className="mt-4 flex items-center justify-center gap-1.5 text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5 text-xs">
            <Star className="h-3.5 w-3.5" />
            AR Voice Score: <strong>{arScore}/5</strong>
          </div>
        )}
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => {
              const score = scoreARVoice(true);
              setArScore(score);
              updateStageScore(getStudentName(), "arVoice", score);
              pipeline.completePipeline();
            }}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 shadow-sm transition-colors"
          >
            <CheckCircle2 className="h-4 w-4" />
            Complete Pipeline — Generate Certificate
          </button>
        </div>
      </div>
    </div>
  );
}

// (exported above)

// ─── Claim Appeal Letter Generator ───────────────────────────────

const CARC_CODES = [
  { code: "CO-16", description: "Claim lacks information needed for adjudication" },
  { code: "CO-50", description: "Non-covered service because this is not deemed a medical necessity" },
  { code: "CO-119", description: "Benefit maximum has been reached" },
  { code: "CO-97", description: "The benefit for this service is included in the payment for another service" },
  { code: "PR-1", description: "Deductible amount has not been met" },
  { code: "PR-2", description: "Co-insurance amount" },
  { code: "OA-23", description: "Procedure code is inconsistent with the diagnosis code" },
  { code: "OA-100", description: "Missing prior authorization" },
];

const APPEAL_REASONS = [
  { id: "med-necessary", label: "Service was medically necessary", text: "The denied service was medically necessary for the patient's condition. The clinical documentation supports the medical necessity, and the procedure was appropriate given the patient's diagnosis and clinical presentation." },
  { id: "coding-correct", label: "Coding was correct and supported", text: "The submitted ICD-10 and CPT codes accurately reflect the patient's diagnosis and the services rendered. The coding is supported by the clinical documentation in the medical record." },
  { id: "pa-obtained", label: "Prior authorization was obtained", text: "Prior authorization was obtained prior to the service being rendered. The authorization number and approval documentation are attached for reference." },
  { id: "modifier-needed", label: "Modifier should have been appended", text: "The appropriate modifier should have been appended to the procedure code to indicate the circumstances of the service. We request reprocessing with the correct modifier." },
  { id: "timely-filing", label: "Claim was filed within timely filing limit", text: "The claim was submitted within the timely filing limits specified by the payer. The submission date and confirmation are available upon request." },
];

export function AppealLetterGenerator() {
  const [carcCode, setCarcCode] = useState("");
  const [selectedReason, setSelectedReason] = useState<string[]>([]);
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const carc = CARC_CODES.find(c => c.code === carcCode);
  const reasons = APPEAL_REASONS.filter(r => selectedReason.includes(r.id));

  const letterParts = [
    `Re: Appeal of Claim Denial — ${carcCode || "[CARC Code]"}`,
    carc?.description ? `Denial Reason: ${carc.description}` : "",
    "",
    "Dear Appeals Department,",
    "",
    "This letter is a formal request for appeal of the above-referenced claim denial.",
    ...reasons.map(r => r.text),
    "",
    "We respectfully request that you review the attached documentation and reprocess this claim accordingly.",
    "",
    "Sincerely,",
    "Healthcare Hustlers Billing Department",
    new Date().toLocaleDateString(),
  ].filter(Boolean).join("\n");

  const handleCopy = () => {
    navigator.clipboard.writeText(letterParts).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleGenerate = () => {
    if (!carcCode || selectedReason.length === 0) return;
    setGenerated(true);
  };

  return (
    <div className="mt-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-4 w-4 text-rose-600" />
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">Claim Appeal Letter Generator</h3>
      </div>

      {!generated ? (
        <div className="space-y-3">
          {/* CARC Code Select */}
          <div>
            <label className="mb-1 block text-[10px] font-medium text-slate-500">CARC Denial Code</label>
            <select value={carcCode} onChange={e => setCarcCode(e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-[10px] outline-none focus:border-rose-400 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200">
              <option value="">Select a denial code...</option>
              {CARC_CODES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.description}</option>)}
            </select>
          </div>

          {/* Appeal Reason Select */}
          <div>
            <label className="mb-1 block text-[10px] font-medium text-slate-500">Appeal Rationale</label>
            <div className="space-y-1">
              {APPEAL_REASONS.map(r => (
                <label key={r.id} className={`flex items-start gap-2 rounded-lg border p-2 cursor-pointer text-[10px] ${
                  selectedReason.includes(r.id) ? "border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-700" : "border-slate-100 dark:border-slate-700"
                }`}>
                  <input type="checkbox" checked={selectedReason.includes(r.id)} onChange={() => setSelectedReason(prev => prev.includes(r.id) ? prev.filter(x => x !== r.id) : [...prev, r.id])} className="mt-0.5 h-3 w-3 accent-rose-500" />
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-300">{r.label}</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">{r.text.slice(0, 100)}...</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!carcCode || selectedReason.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-medium text-white hover:bg-rose-500 disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            <FileText className="h-3.5 w-3.5" />
            Generate Appeal Letter
          </button>
        </div>
      ) : (
        <div className="space-y-3 animate-slide-in">
          <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 p-3 whitespace-pre-wrap text-[10px] text-slate-700 dark:text-slate-300 font-mono leading-relaxed">
            {letterParts}
          </div>

          <div className="flex gap-2">
            <button onClick={handleCopy} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-indigo-500">
              {copied ? <CheckCircle2 className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
              {copied ? "Copied!" : "Copy to Clipboard"}
            </button>
            <button onClick={handleSave} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-emerald-500">
              {saved ? <CheckCircle2 className="h-3 w-3" /> : <Save className="h-3 w-3" />}
              {saved ? "Saved!" : "Save & Log"}
            </button>
            <button onClick={() => setGenerated(false)} className="rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-1.5 text-[10px] font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700">
              Edit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}