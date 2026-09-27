import { useEffect, useMemo, useRef, useState } from "react";
import type { HistoricalWardRisk, HeatTrendDay, RiskLevel } from "../types/heat";
import type { alerts, recommendations } from "../data/mockHeatData";
import { calculateHealthImpact } from "../data/healthImpact";
import { citySummaryForDate, shortDate, wardHistory } from "../data/historicalRisk";
import { thermalMetrics } from "../data/thermalStress";
import { getPreferredSaayaVoice, prepareTextForSpeech, splitSpeechIntoChunks, type SaayaVoiceLanguage } from "./saayaVoice";

type Props = {
  date: string;
  selectedWardId: number | null;
  rows: HistoricalWardRisk[];
  forecasts: HeatTrendDay[];
  alertsData: typeof alerts;
  recommendationsData: typeof recommendations;
  onWard: (id: number) => void;
  onOpenWard: (id: number) => void;
  onHeatMap: (id?: number) => void;
  onResponse: (id: number) => void;
  onAlertDraft: (draft: { wardId: number; audience: "Resident" | "Hospital" | "Both"; message: string }) => void;
  initialPrompt?: string;
  onPromptConsumed?: () => void;
};
type Answer = { title: string; summary: string; evidence: string[]; actions?: string[]; wards?: HistoricalWardRisk[]; caveat?: string; draft?: string; draftWardId?: number; draftAudience?: "Resident" | "Hospital" | "Both"; draftAudienceLabel?: string; draftTransferAllowed?: boolean };
type Turn = { question: string; answer: Answer };
const levels: RiskLevel[] = ["Low", "Moderate", "High", "Very High", "Extreme"];
const riskRank = (risk: RiskLevel) => levels.indexOf(risk);
const fullWard = (ward: HistoricalWardRisk) => `Ward ${ward.wardId} · ${ward.wardName}`;
const saayaGreeting = "Namaste, SAAYA mein aapka swagat hai. Main Pune ke heat risk, wards, forecasts aur municipal response ke baare mein aapki madad kar sakti hoon.";

function responseSpeechText(answer: Answer, editedDraft?: string): string {
  const parts = [answer.title, answer.summary];
  if (answer.evidence.length) parts.push(`Key evidence. ${answer.evidence.join(". ")}`);
  if (answer.wards?.length) parts.push(`Ward details. ${answer.wards.slice(0, 5).map((ward) => {
    const impact = calculateHealthImpact(ward);
    const metric = thermalMetrics(ward);
    return `${fullWard(ward)}. Risk ${ward.riskLevel}. HTSI ${metric.htsi}. Temperature ${ward.temperature.toFixed(1)} degrees Celsius. Exposure ${impact.exposure}. Vulnerability data unavailable. Health impact ${impact.potentialImpact}, estimate.`;
  }).join(" ")}`);
  if (answer.actions?.length) parts.push(`Recommended actions. ${answer.actions.slice(0, 4).join(". ")}`);
  if (answer.draft) parts.push(`Draft public alert. ${editedDraft ?? answer.draft}`);
  if (answer.caveat) parts.push(`Note. ${answer.caveat}`);
  return parts.filter(Boolean).join("\n\n");
}

type CopilotVoiceState = "idle" | "listening" | "thinking" | "speaking" | "error";
type RecognitionResultLike = { isFinal: boolean; 0?: { transcript?: string } };
type RecognitionEventLike = { resultIndex: number; results: ArrayLike<RecognitionResultLike> };
type RecognitionErrorLike = { error?: string };
type RecognitionLike = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: RecognitionErrorLike) => void) | null;
  onend: (() => void) | null; start: () => void; stop: () => void; abort: () => void;
};
type RecognitionConstructor = new () => RecognitionLike;

function VoiceIcon({ kind }: { kind: "speaker" | "stop" | "mic" | "mic-off" }) {
  const paths: Record<typeof kind, string> = {
    speaker: "M4 10v4h3l4 3V7l-4 3H4Zm10-1a5 5 0 0 1 0 6m2-9a9 9 0 0 1 0 12",
    stop: "M7 7h10v10H7z",
    mic: "M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-6 8a6 6 0 0 0 12 0m-6 6v4m-4 0h8",
    "mic-off": "M9 9v2a3 3 0 0 0 5.1 2.1M15 9V6a3 3 0 0 0-5.8-1M6 11a6 6 0 0 0 10 4.5M12 17v4m-4 0h8M3 3l18 18",
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={paths[kind]} /></svg>;
}

function answerFor(question: string, rows: HistoricalWardRisk[], selectedWardId: number | null, forecast: HeatTrendDay[], alertsData: typeof alerts, recommendationsData: typeof recommendations): Answer {
  const q = question.toLowerCase();
  const summary = citySummaryForDate(rows[0]?.date ?? "");
  const idMatch = [...q.matchAll(/ward\s*(\d+)/g)].map((match) => Number(match[1]));
  const wardById = (id: number) => rows.find((row) => row.wardId === id);
  const ranked = [...rows].sort((a, b) => thermalMetrics(b).htsi - thermalMetrics(a).htsi || a.wardId - b.wardId);
  const chosen = wardById(idMatch[0] ?? selectedWardId ?? ranked[0]?.wardId ?? 1) ?? ranked[0];
  const topFive = ranked.slice(0, 5);
  const highPlus = rows.filter((row) => riskRank(row.riskLevel) >= riskRank("High"));
  const exposureRows = rows.filter((row) => riskRank(calculateHealthImpact(row).exposure) >= riskRank("High"));
  const dataNote = `Historical reference ${shortDate(rows[0]?.date ?? "2026-05-31")} · Open-Meteo / ERA5 weather inputs with SAAYA prototype ward calibration.`;

  if (/prepared|readiness|ready for this afternoon|are we prepared/.test(q)) return { title: "Municipal readiness", summary: "Readiness assessment unavailable with current data.", evidence: ["No verified information is available for hospital capacity, cooling-centre occupancy, water supplies, or field-team deployment."], caveat: "The current SAAYA dataset contains heat-risk indicators and recommendations, not live municipal resource status." };
  if (/what changed|changed since|previous forecast|since yesterday|change since/.test(q)) {
    const previousDate = new Date(`${rows[0]?.date ?? "2026-05-31"}T00:00:00Z`);
    previousDate.setUTCDate(previousDate.getUTCDate() - 1);
    const priorDay = previousDate.toISOString().slice(0, 10);
    const previousRows = rows.map((row) => wardHistory(row.wardId).find((item) => item.date === priorDay)).filter((row): row is HistoricalWardRisk => Boolean(row));
    if (previousRows.length !== rows.length) return { title: "Change assessment", summary: "Comparison data is unavailable for this period. A complete prior-day ward dataset and previous forecast snapshot are not available.", evidence: [dataNote], caveat: "No temperature, risk, priority, or forecast changes are inferred without comparable records." };
    const previousSummary = citySummaryForDate(priorDay);
    const previousPriority = [...previousRows].sort((a, b) => thermalMetrics(b).htsi - thermalMetrics(a).htsi).slice(0, 3);
    const currentPriority = ranked.slice(0, 3);
    const changedPriority = currentPriority.filter((row) => !previousPriority.some((prior) => prior.wardId === row.wardId)).map((row) => `Ward ${row.wardId} entered the top three`);
    const temperatureChange = summary.temperature - previousSummary.temperature;
    return { title: "What changed", summary: `Historical day-over-day comparison · ${shortDate(priorDay)} to ${shortDate(rows[0]?.date ?? "")}\nTemperature: city average ${temperatureChange > 0 ? "+" : ""}${temperatureChange.toFixed(1)}°C.\nRisk: city average HTSI ${previousSummary.score} to ${summary.score} · ${previousSummary.riskLevel} to ${summary.riskLevel}.\nPriority wards: ${changedPriority.length ? changedPriority.join(", ") : "No new ward entered the top three by HTSI."}\nForecast: previous forecast snapshot unavailable.`, evidence: ["Uses historical ward weather rows and existing calibrated HTSI values for consecutive dates.", "This comparison is descriptive and does not establish the cause of a change."], caveat: "The dataset contains historical weather inputs, not archived forecast runs." };
  }
  if (!q.trim()) return { title: "Ask a municipal heat question", summary: "Use ward, risk, forecast and readiness questions. Answers are generated from the current SAAYA prototype dataset; this is not a live AI service.", evidence: [dataNote] };
  if (/(draft|advisory|alert)/.test(q) && /(draft|write|prepare|advisory|alert)/.test(q)) {
    const municipalStaff = /municipal staff/.test(q);
    const audience = /hospital|healthcare|facility/.test(q) ? "Hospital" : /worker|public|resident/.test(q) ? "Resident" : "Both";
    const metrics = thermalMetrics(chosen);
    const isMarathi = /marathi|मराठी/.test(q);
    const draft = isMarathi
      ? `उष्णतेबाबत आरोग्य सूचना\n${fullWard(chosen)}\n\nSAAYA प्रोटोटाइप डेटामध्ये ${chosen.riskLevel.toLowerCase()} उष्णता-जोखीम दिसते (HTSI ${metrics.htsi}/100). ही सूचना अधिकृत करण्यापूर्वी स्थानिक परिस्थिती तपासून घ्या.\n\n• नियमितपणे पाणी प्या आणि सावलीत विश्रांती घ्या.\n• तीव्र उष्णतेच्या काळात अनावश्यक बाहेर जाणे टाळा.\n• ज्येष्ठ नागरिक, मुले आणि बाहेर काम करणाऱ्या व्यक्तींची काळजी घ्या.\n\nAI-निर्मित मसुदा · अधिकृत प्रसिद्धीपूर्वी महानगरपालिका पडताळणी आवश्यक.`
      : `HEAT HEALTH ADVISORY · DRAFT\n${fullWard(chosen)}\nRisk: ${chosen.riskLevel} · HTSI ${metrics.htsi}/100 · historical reference ${shortDate(chosen.date)}\nTime: Not available in the current dataset; confirm before publication.\n\n${municipalStaff ? "Municipal staff: review the ward-level risk information and established local heat-response procedures. This is a preparedness suggestion, not a record of assigned or completed action." : audience === "Hospital" ? "Healthcare facilities: review heat-response readiness, staffing, hydration supplies and local escalation procedures. This is a preparedness suggestion, not a report of current facility status." : /worker/.test(q) ? "Outdoor workers: schedule strenuous work away from peak heat where feasible, provide regular water and rest breaks, and follow local safety procedures." : "Residents: drink water regularly, rest in shaded or cool areas, avoid prolonged outdoor exposure during peak heat, and check on people who may need assistance."}\n\nAI-GENERATED DRAFT · REQUIRES MUNICIPAL REVIEW.`;
    const audienceLabel = municipalStaff ? "Municipal Staff" : audience === "Resident" ? (/worker/.test(q) ? "Outdoor Workers" : "Public") : audience === "Hospital" ? "Healthcare Facilities" : "Public and healthcare facilities";
    return { title: "Alert draft prepared", summary: `${fullWard(chosen)} · ${chosen.riskLevel} · HTSI ${metrics.htsi}. Draft only; SAAYA has not issued or sent an alert.`, evidence: [dataNote, `Audience selection: ${audienceLabel}. Health outcomes and delivery are not verified.`], draft, draftWardId: chosen.wardId, draftAudience: audience, draftAudienceLabel: audienceLabel, draftTransferAllowed: !municipalStaff };
  }
  if (/situation brief|brief|today/.test(q) && /(brief|situation|generate|summary)/.test(q)) {
    const peak = forecast.filter((day) => day.period === "Forecast").reduce((max, day) => day.score > max.score ? day : max, forecast.find((day) => day.period === "Forecast")!);
    return { title: "SAAYA situation brief", summary: `Date: ${shortDate(rows[0]?.date ?? "2026-05-31")}\nOverall heat situation: ${summary.riskLevel} · HTSI ${summary.score}/100\nPriority wards: ${topFive.slice(0, 3).map((ward, index) => `${index + 1}. Ward ${ward.wardId} · ${ward.riskLevel}`).join("; ")}\nMajor changes: Comparison with a previous forecast is unavailable.\nRecommended actions: Review local service readiness and prepare targeted heat-safety communication.\nAlert status: ${alertsData.length} prototype alert records; delivery status is not verified.`, evidence: [dataNote, "Ward-specific forecasts and verified readiness feeds are unavailable."], actions: recommendationsData.slice(0, 3).map((item) => `${item.title} · ${item.action}`) };
  }
  if (/worsen|tomorrow|forecast|expected/.test(q)) {
    const outlook = forecast.filter((day) => day.period === "Forecast");
    const peak = outlook.reduce((max, day) => day.score > max.score ? day : max, outlook[0]);
    return { title: "Forecast interpretation", summary: `The available forecast is city-wide. Its peak is ${peak.risk} at HTSI ${peak.score}/100 with a maximum of ${peak.maxTemperature}°C on ${peak.label}. It does not contain per-ward forecasts, so SAAYA cannot reliably identify which individual wards will worsen tomorrow.`, evidence: outlook.slice(0, 4).map((day) => `${day.label}: ${day.risk} · HTSI ${day.score} · ${day.maxTemperature}°C`), caveat: "Ward-specific forecast values are not available in the current SAAYA dataset." };
  }
  if (/alert/.test(q) && /(review|active|need)/.test(q)) return { title: "Existing alert records", summary: `${alertsData.length} prototype alert records are listed in SAAYA. Review the existing alert workflow before any official action.`, evidence: alertsData.map((item) => `${item.title} · ${item.wards} · ${item.time} · ${item.status}`), caveat: "Prototype records do not confirm external delivery or municipal action." };
  if (/compare/.test(q) && idMatch.length > 1) {
    const compared = idMatch.map(wardById).filter((row): row is HistoricalWardRisk => Boolean(row));
    if (compared.length) {
      const first = compared[0]; const second = compared[1];
      const difference = second ? Math.abs(first.temperature - second.temperature) : 0;
      const keyDifference = !second ? "Only one requested ward is present in the available data." : first.riskLevel !== second.riskLevel ? `${fullWard(first)} is ${first.riskLevel}; ${fullWard(second)} is ${second.riskLevel}.` : first.temperature !== second.temperature ? `${fullWard(first.temperature > second.temperature ? first : second)} is ${difference.toFixed(1)}°C warmer; both are ${first.riskLevel}.` : `Both wards have ${first.riskLevel} risk and matching temperature in the available reference.`;
      return { title: "Ward comparison", summary: `Key difference: ${keyDifference} Demographic vulnerability data is unavailable; health impact is a model estimate, not a clinical record.`, evidence: compared.map((row) => { const health = calculateHealthImpact(row); return `${fullWard(row)} · ${row.riskLevel} · ${row.temperature.toFixed(1)}°C · ${health.exposure} exposure · ${health.potentialImpact} estimated health impact`; }), wards: compared, caveat: dataNote };
    }
  }
  if (/health impact|impact estimate/.test(q)) {
    const impact = calculateHealthImpact(chosen); const metrics = thermalMetrics(chosen);
    return { title: `${fullWard(chosen)} · health-impact estimate`, summary: `The existing model estimates ${impact.potentialImpact.toLowerCase()} potential health impact for this reference. This is derived decision-support output, not a clinical case count, diagnosis, admission or mortality record.`, evidence: [`Risk ${chosen.riskLevel} · HTSI ${metrics.htsi}/100`, `WBGT ${metrics.wbgt.toFixed(1)}°C · screening estimate`, `Exposure ${impact.exposure} · model-derived`, `Priority population descriptor: ${impact.priorityPopulation}`], caveat: "Vulnerability records and verified healthcare-demand data are not available in the current SAAYA dataset." };
  }
  if (/unusual|change detection|change from|baseline|increased|decreased|anomaly/.test(q)) {
    const history = wardHistory(chosen.wardId).filter((row) => row.date < chosen.date).sort((a, b) => a.date.localeCompare(b.date));
    const baselineRows = history.slice(-7);
    if (baselineRows.length < 4) return { title: `${fullWard(chosen)} · historical comparison`, summary: "Data is not available in the current SAAYA dataset for a useful recent baseline comparison.", evidence: [dataNote] };
    const baseline = baselineRows.reduce((sum, row) => sum + thermalMetrics(row).htsi, 0) / baselineRows.length;
    const current = thermalMetrics(chosen).htsi;
    const change = current - baseline;
    return { title: `${fullWard(chosen)} · recent change`, summary: `Current HTSI ${current}; the mean across the preceding ${baselineRows.length} available historical records is ${baseline.toFixed(1)}. Difference: ${change > 0 ? "+" : ""}${change.toFixed(1)} points. This is a descriptive historical comparison, not a statistically validated anomaly or future prediction.`, evidence: [`Current reference: ${shortDate(chosen.date)} · ${chosen.riskLevel}`, `Comparison records: ${shortDate(baselineRows[0].date)}–${shortDate(baselineRows.at(-1)!.date)}`, dataNote], wards: [chosen], caveat: "Historical weather inputs with prototype ward calibration; verify local conditions before operational interpretation." };
  }
  if (/wbgt/.test(q)) {
    const metrics = thermalMetrics(chosen);
    return { title: `${fullWard(chosen)} · WBGT screening estimate`, summary: `WBGT is estimated at ${metrics.wbgt.toFixed(1)}°C for the selected historical reference. It is a derived screening value, not instrument-measured occupational WBGT.`, evidence: [`Weather inputs: ${chosen.temperature.toFixed(1)}°C air temperature · ${chosen.humidity}% relative humidity · wind ${chosen.windSpeed.toFixed(1)} km/h · solar radiation ${chosen.solarRadiation} W/m²`, `HTSI ${metrics.htsi}/100 · ${chosen.riskLevel}`], caveat: dataNote };
  }
  if (/temperature|humidity|weather inputs/.test(q)) return { title: `${fullWard(chosen)} · weather inputs`, summary: "Weather measurements shown are historical reference inputs from the existing dataset.", evidence: [`Temperature ${chosen.temperature.toFixed(1)}°C`, `Humidity ${chosen.humidity}%`, `Wind ${chosen.windSpeed.toFixed(1)} km/h`, `Solar radiation ${chosen.solarRadiation} W/m²`, dataNote] };
  if (/exposure/.test(q) && /(both|and)/.test(q) && /(risk|htsi)/.test(q)) {
    const matching = rows.filter((row) => riskRank(row.riskLevel) >= riskRank("High") && riskRank(calculateHealthImpact(row).exposure) >= riskRank("High"));
    return { title: "Wards with elevated risk and exposure", summary: `${matching.length} wards meet both conditions in the selected reference data: risk High or above and model-derived exposure High or above.`, evidence: [dataNote], wards: matching, caveat: "Exposure is not a demographic count; health impact and exposure categories are model-derived." };
  }
  if (/exposure/.test(q) && /(high|ward|both)/.test(q)) return { title: "Wards with elevated exposure", summary: `${exposureRows.length} wards have a model-derived exposure category of High or above for the selected historical reference.`, evidence: [dataNote, "Exposure is model-derived from the existing operational score; it is not a demographic count."], wards: exposureRows.slice(0, 12), caveat: "Demographic vulnerability data is not available." };
  if (/extreme/.test(q) && /(which|show|ward)/.test(q)) {
    const matching = rows.filter((row) => row.riskLevel === "Extreme");
    return { title: "Extreme-risk wards", summary: `${matching.length} wards are classified Extreme in the selected reference data.`, evidence: [dataNote], wards: matching, caveat: "Risk categories reflect existing prototype calibration." };
  }
  if (/above|over|greater|htsi\s*>/.test(q)) {
    const threshold = Number(q.match(/(?:above|over|greater than|htsi\s*>\s*)(\d+)/)?.[1] ?? 70);
    const matching = rows.filter((row) => thermalMetrics(row).htsi > threshold).sort((a, b) => thermalMetrics(b).htsi - thermalMetrics(a).htsi);
    return { title: `Wards with HTSI above ${threshold}`, summary: `${matching.length} wards exceed HTSI ${threshold} on the selected reference date.`, evidence: [dataNote, "HTSI is a calculated 0–100 screening index, not a direct sensor measurement."], wards: matching, caveat: "WBGT is a derived screening estimate, not instrument-measured occupational WBGT." };
  }
  if (/prepare|response|action/.test(q)) return { title: "Recommended response", summary: `For ${fullWard(chosen)}, SAAYA records ${chosen.riskLevel} risk. These are proposed checks; no action is recorded as dispatched or completed.`, evidence: [`HTSI ${thermalMetrics(chosen).htsi}/100 · WBGT ${thermalMetrics(chosen).wbgt.toFixed(1)}°C screening estimate`, `Model-derived exposure: ${calculateHealthImpact(chosen).exposure}`], actions: ["Review local health-facility readiness through established channels", "Verify water-point and cooling-centre readiness", "Prepare heat-safety guidance for outdoor workers", "Prepare localized public communication"], wards: [chosen], caveat: "Resource availability and completed municipal actions are not available in the current dataset." };
  if (/why|explain|driver|risk/.test(q)) {
    const metrics = thermalMetrics(chosen); const health = calculateHealthImpact(chosen);
    const contributors = [...metrics.contributors].sort((a, b) => b.value - a.value);
    return { title: fullWard(chosen), summary: `${chosen.riskLevel.toUpperCase()} RISK · HTSI ${metrics.htsi}/100. ${metrics.explanation}`, evidence: [`Temperature ${chosen.temperature.toFixed(1)}°C · ${contributors.find((item) => item.label === "Temperature")?.level}`, `Humidity ${chosen.humidity}% · ${contributors.find((item) => item.label === "Humidity")?.level}`, `Wind ${chosen.windSpeed.toFixed(1)} km/h · ${contributors.find((item) => item.label === "Wind cooling")?.level}`, `Solar radiation ${chosen.solarRadiation} W/m²`, `WBGT ${metrics.wbgt.toFixed(1)}°C · derived screening estimate`, `Exposure ${health.exposure} · health impact ${health.potentialImpact} · model estimates`], actions: recommendationsData.slice(0, 4).map((item) => `${item.title} · ${item.action}`), wards: [chosen], caveat: "Qualitative interpretation of available indicators; these are not feature-importance or TreeSHAP values. Health impact is model-estimated, not a confirmed clinical case." };
  }
  if (/which|attention|priority/.test(q)) return { title: "Today's priorities", summary: `${highPlus.length} wards are High or above in the selected reference. The ranked list shows the three highest HTSI values; these are historical prototype estimates, not live monitoring.`, evidence: [dataNote], wards: ranked.slice(0, 3), caveat: "Prototype risk outputs; verify current local conditions before official action." };
  return { title: "SAAYA data-grounded response", summary: "I can interpret the current ward dataset, existing forecast, prototype alert records and municipal recommendations. I do not have a live AI provider or live operational feeds connected.", evidence: ["Try a ward comparison, HTSI threshold, risk explanation, city situation brief, response preparation question, or alert draft."], caveat: "Data is not available in the current SAAYA dataset for unsupported real-time or facility-level questions." };
}

export function MunicipalAICopilot({ date, selectedWardId, rows, forecasts, alertsData, recommendationsData, onWard, onOpenWard, onHeatMap, onResponse, onAlertDraft, initialPrompt, onPromptConsumed }: Props) {
  const [question, setQuestion] = useState(""); const [turns, setTurns] = useState<Turn[]>([]); const [plannerOpen, setPlannerOpen] = useState(false); const [planWardId, setPlanWardId] = useState(selectedWardId ?? rows[0]?.wardId ?? 1); const [planRisk, setPlanRisk] = useState<RiskLevel>((rows.find((row) => row.wardId === planWardId) ?? rows[0]).riskLevel); const [planPeriod, setPlanPeriod] = useState("Next 24 hours · citywide outlook"); const [checked, setChecked] = useState<string[]>([]); const [draftEdited, setDraftEdited] = useState<Record<number, string>>({}); const [alertBuilderOpen, setAlertBuilderOpen] = useState(false); const [alertWardId, setAlertWardId] = useState(selectedWardId ?? rows[0]?.wardId ?? 1); const [alertAudience, setAlertAudience] = useState("Public"); const [alertLanguage, setAlertLanguage] = useState("English"); const [copiedKey, setCopiedKey] = useState("");
  const [voiceState, setVoiceState] = useState<CopilotVoiceState>("idle");
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState<SaayaVoiceLanguage>("en-IN");
  const [voiceError, setVoiceError] = useState("");
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speakingKey, setSpeakingKey] = useState("");
  const speechToken = useRef(0); const recognitionRef = useRef<RecognitionLike | null>(null);
  const voiceModeRef = useRef(false);
  const consumedInitialPrompt = useRef("");
  const voiceWindow = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  const recognitionConstructor = voiceWindow.SpeechRecognition ?? voiceWindow.webkitSpeechRecognition;
  const speechSupported = typeof window.speechSynthesis !== "undefined" && typeof window.SpeechSynthesisUtterance !== "undefined";
  const speechInputSupported = Boolean(recognitionConstructor);
  const selectedVoice = useMemo(() => getPreferredSaayaVoice(availableVoices, voiceLanguage), [availableVoices, voiceLanguage]);
  useEffect(() => {
    if (!speechSupported) return;
    const synthesis = window.speechSynthesis;
    const refreshVoices = () => { const voices = synthesis.getVoices(); if (voices.length) setAvailableVoices(voices); };
    refreshVoices(); synthesis.addEventListener("voiceschanged", refreshVoices);
    return () => synthesis.removeEventListener("voiceschanged", refreshVoices);
  }, [speechSupported]);
  const summary = useMemo(() => citySummaryForDate(date), [date]);
  const ranked = useMemo(() => [...rows].sort((a, b) => thermalMetrics(b).htsi - thermalMetrics(a).htsi || a.wardId - b.wardId), [rows]);
  const highPlusCount = rows.filter((row) => riskRank(row.riskLevel) >= riskRank("High")).length;
  const priorityPrompts = ["Which wards need attention today?", "Why is Ward 9 at extreme risk?", "What changed since the previous forecast?", "What should we prepare this afternoon?", "Compare Ward 9 and Ward 20", "Draft a heat alert for Ward 9"];
  const copyToClipboard = async (value: string, key: string) => { try { await navigator.clipboard.writeText(value); setCopiedKey(key); window.setTimeout(() => setCopiedKey((current) => current === key ? "" : current), 1600); } catch { setCopiedKey(""); } };
  const waitForVoices = () => new Promise<SpeechSynthesisVoice[]>((resolve) => {
    const synthesis = window.speechSynthesis;
    const ready = synthesis.getVoices();
    if (ready.length) { setAvailableVoices(ready); resolve(ready); return; }
    let settled = false;
    const finish = (voices: SpeechSynthesisVoice[]) => {
      if (settled) return; settled = true; window.clearTimeout(timer);
      synthesis.removeEventListener("voiceschanged", onVoicesChanged);
      if (voices.length) setAvailableVoices(voices);
      resolve(voices);
    };
    const onVoicesChanged = () => { const voices = synthesis.getVoices(); if (voices.length) finish(voices); };
    const timer = window.setTimeout(() => finish(synthesis.getVoices()), 1800);
    synthesis.addEventListener("voiceschanged", onVoicesChanged);
  });
  const stopSpeaking = () => {
    speechToken.current += 1;
    if (speechSupported) window.speechSynthesis.cancel();
    setSpeakingKey(""); setVoiceState("idle"); setVoiceError("");
  };
  const speakText = async (text: string, key: string, languageOverride?: SaayaVoiceLanguage) => {
    if (!speechSupported) { setVoiceState("error"); setVoiceError("Speech playback is unavailable in this browser."); return; }
    const token = ++speechToken.current;
    window.speechSynthesis.cancel();
    const spokenText = prepareTextForSpeech(text);
      const language: SaayaVoiceLanguage = languageOverride ?? (/[ऀ-ॿ]/.test(spokenText) ? "hi-IN" : voiceLanguage);
    setVoiceError(""); setSpeakingKey(key); setVoiceState("thinking");
    try {
      const voices = availableVoices.length ? availableVoices : await waitForVoices();
      if (token !== speechToken.current) return;
      const chunks = splitSpeechIntoChunks(spokenText);
      if (!chunks.length) { setSpeakingKey(""); setVoiceState("idle"); return; }
      const choice = getPreferredSaayaVoice(voices, language);
      const speakChunk = (index: number) => {
        if (token !== speechToken.current) return;
        if (index >= chunks.length) { setSpeakingKey(""); setVoiceState("idle"); return; }
        const utterance = new SpeechSynthesisUtterance(chunks[index]);
        if (choice) utterance.voice = choice.voice;
        utterance.lang = choice?.voice.lang || language;
        utterance.rate = 0.97; utterance.pitch = 1.04; utterance.volume = 1;
        utterance.onstart = () => { if (token === speechToken.current) setVoiceState("speaking"); };
        utterance.onend = () => { if (token === speechToken.current) speakChunk(index + 1); };
        utterance.onerror = (event) => {
          if (token !== speechToken.current) return;
          if (event.error === "canceled" || event.error === "interrupted") { setSpeakingKey(""); setVoiceState("idle"); return; }
          setSpeakingKey(""); setVoiceState("error"); setVoiceError("Couldn’t play the response aloud. You can try again.");
        };
        try { window.speechSynthesis.speak(utterance); }
        catch { setSpeakingKey(""); setVoiceState("error"); setVoiceError("Couldn’t play the response aloud. You can try again."); }
      };
      speakChunk(0);
    } catch {
      if (token === speechToken.current) { setSpeakingKey(""); setVoiceState("error"); setVoiceError("Couldn’t play the response aloud. You can try again."); }
    }
  };
  useEffect(() => () => {
    speechToken.current += 1;
    if (typeof window.speechSynthesis !== "undefined") window.speechSynthesis.cancel();
    recognitionRef.current?.abort();
  }, []);
  const submit = (value = question, autoSpeak = voiceModeRef.current) => {
    if (!value.trim()) return;
    setVoiceError("");
    if (!autoSpeak && voiceState === "error") setVoiceState("idle");
    let resolvedQuestion = value.trim();
    const previousWards = turns.at(-1)?.answer.wards ?? [];
    if (/compare\s+(the\s+)?first two|compare those two/i.test(resolvedQuestion) && previousWards.length >= 2) resolvedQuestion = `Compare Ward ${previousWards[0].wardId} and Ward ${previousWards[1].wardId}`;
    const contextualWard = /\b(this|it|that ward)\b/i.test(resolvedQuestion) && previousWards[0] ? previousWards[0].wardId : selectedWardId;
    const answer = answerFor(resolvedQuestion, rows, contextualWard, forecasts, alertsData, recommendationsData);
    setTurns((current) => [...current, { question: value.trim(), answer }]); setQuestion("");
    if (autoSpeak) {
      setVoiceState("thinking");
      const responseKey = `response-${turns.length}`;
      window.setTimeout(() => { void speakText(responseSpeechText(answer), responseKey); }, 0);
    }
    if (answer.title.includes("Alert draft")) setDraftEdited((current) => ({ ...current, [Date.now()]: answer.draft ?? "" }));
  };
  const startListening = (autoSubmitOnResult = voiceModeRef.current) => {
    if (!recognitionConstructor) { setVoiceState("error"); setVoiceError("Speech recognition is unavailable in this browser. You can still type your question."); return; }
    if (recognitionRef.current) { recognitionRef.current.stop(); return; }
    setVoiceError("");
    try {
      const recognition = new recognitionConstructor();
      recognition.lang = voiceLanguage; recognition.continuous = false; recognition.interimResults = true;
      recognitionRef.current = recognition; let failed = false; let gotFinalResult = false;
      setVoiceState("listening");
      recognition.onresult = (event) => {
        const result = event.results[event.resultIndex];
        const transcript = result?.[0]?.transcript?.trim() ?? "";
        if (!result?.isFinal || !transcript) return;
        gotFinalResult = true;
        setQuestion(transcript); recognition.stop();
        if (autoSubmitOnResult || voiceModeRef.current) { setVoiceState("thinking"); submit(transcript, true); }
        else setVoiceState("idle");
      };
      recognition.onerror = (event) => {
        failed = true; setVoiceState("error");
        setVoiceError(event.error === "not-allowed" || event.error === "service-not-allowed" ? "Microphone permission was denied. Typed chat remains available." : "Voice input failed. You can type your question instead.");
      };
      recognition.onend = () => { recognitionRef.current = null; if (!failed && !gotFinalResult) setVoiceState("idle"); };
      recognition.start();
    } catch {
      recognitionRef.current = null; setVoiceState("error"); setVoiceError("Voice input could not start. You can type your question instead.");
    }
  };
  const toggleVoiceMode = () => {
    if (voiceModeRef.current) {
      voiceModeRef.current = false; setVoiceMode(false); recognitionRef.current?.stop(); stopSpeaking();
      return;
    }
    if (!recognitionConstructor) { setVoiceState("error"); setVoiceError("Speech recognition is unavailable in this browser. You can still type your question."); return; }
    voiceModeRef.current = true; setVoiceMode(true); startListening(true);
  };
  const activeVoice = selectedVoice ? `${selectedVoice.isReliablyFemale ? "Female voice" : "Voice"} · ${selectedVoice.voice.name}` : availableVoices.length ? "System voice" : "Loading available voices";
  useEffect(() => { if (!initialPrompt || consumedInitialPrompt.current === initialPrompt) return; consumedInitialPrompt.current = initialPrompt; const answer = answerFor(initialPrompt, rows, selectedWardId, forecasts, alertsData, recommendationsData); setTurns((current) => [...current, { question: initialPrompt, answer }]); onPromptConsumed?.(); }, [initialPrompt]);
  const openPlanner = () => { const prompt = "Prepare a response plan"; setPlannerOpen(true); submit(prompt); };
  const generateConfiguredDraft = () => { submit(`Draft a heat alert for ${alertAudience} in ${alertLanguage} for Ward ${alertWardId}`); setAlertBuilderOpen(false); };
  const peakForecast = forecasts.filter((day) => day.period === "Forecast").reduce((peak, day) => day.score > peak.score ? day : peak, forecasts.find((day) => day.period === "Forecast")!);
  const planWard = rows.find((row) => row.wardId === planWardId) ?? rows[0];
  const planMetrics = thermalMetrics(planWard); const planHealth = calculateHealthImpact(planWard);
  const serviceActions = ["Healthcare · review facility readiness and expected demand", "Water & cooling · verify water-point and cooling-centre readiness", "Outdoor workers · prepare heat-safety guidance", "Public health · prepare localized communication"];
  const planAssumedRisk = riskRank(planRisk) > riskRank(planWard.riskLevel) ? planRisk : planWard.riskLevel;
  const prepareActions = planAssumedRisk === "Extreme" || planAssumedRisk === "Very High" ? ["Review facility readiness and expected demand", "Verify water-point and cooling-centre readiness", "Prepare outdoor-worker heat-safety guidance", "Prepare localized public communication"] : serviceActions.map((action) => action.split(" · ")[1]);
  const onPlanSubmit = (event: React.FormEvent) => { event.preventDefault(); setPlannerOpen(true); };
  const renderVoiceControls = () => <div className="copilot-voice-tools">
    <button type="button" className={`copilot-voice-mode ${voiceMode ? "is-active" : ""}`} aria-label={voiceMode ? "Disable Voice Mode" : "Enable Voice Mode"} aria-pressed={voiceMode} disabled={!speechInputSupported} onClick={toggleVoiceMode}>Voice Mode</button>
    <label className="copilot-voice-language">Speech language<select aria-label="Speech input language" value={voiceLanguage} onChange={(event) => setVoiceLanguage(event.target.value as SaayaVoiceLanguage)}><option value="en-IN">English / Hinglish</option><option value="hi-IN">हिन्दी</option></select></label>
    <span className="copilot-voice-choice" title={activeVoice}>{activeVoice}</span>
    {voiceState !== "idle" && <span className={`copilot-voice-status is-${voiceState}`} role="status">{voiceState === "listening" ? "Listening…" : voiceState === "thinking" ? "Preparing audio…" : voiceState === "speaking" ? "Speaking…" : "Voice unavailable"}</span>}
    {voiceError && <span className="copilot-voice-error" role="alert">{voiceError}</span>}
  </div>;
  const renderResponseSpeechControl = (answer: Answer, index: number) => {
    const key = `response-${index}`;
    const active = speakingKey === key && (voiceState === "speaking" || voiceState === "thinking");
    return active ? <><span className="copilot-speaking-label" role="status">{voiceState === "speaking" ? "Speaking…" : "Preparing audio…"}</span><button type="button" className="copilot-speech-button is-active" aria-label="Stop speaking" onClick={stopSpeaking}><VoiceIcon kind="stop" /> Stop</button></> : <button type="button" className="copilot-speech-button" aria-label="Read response aloud" onClick={() => void speakText(responseSpeechText(answer, draftEdited[index]), key)}><VoiceIcon kind="speaker" /> Read aloud</button>;
  };
  return <main className="p-4 municipal-copilot">
    <header className="copilot-page-heading"><div><p className="page-eyebrow">MUNICIPAL INTELLIGENCE</p><h1>AI Copilot</h1><p>Data-grounded decision support for heat risk and municipal response.</p></div><span className="copilot-prototype-status">PROTOTYPE · REFERENCE DATA</span></header>
    <div className="copilot-layout"><section className="copilot-main-column">
      {turns.length === 0 ? <section className="copilot-empty-state" aria-labelledby="ask-saaya-title">
        <p className="copilot-identity-mark">SAAYA</p><h2 id="ask-saaya-title">Municipal Heat Intelligence</h2>
        <p className="copilot-empty-copy">Ask about heat risk, ward priorities, forecast changes, municipal response, or alerts. SAAYA will use the current ward and available prototype data as context.</p>
        <section className="copilot-greeting" aria-label="SAAYA greeting"><p>{saayaGreeting}</p>{speakingKey === "greeting" && (voiceState === "speaking" || voiceState === "thinking") ? <div className="copilot-greeting-active"><span role="status">{voiceState === "speaking" ? "Speaking…" : "Preparing audio…"}</span><button type="button" className="copilot-speech-button is-active" aria-label="Stop speaking" onClick={stopSpeaking}><VoiceIcon kind="stop" /> Stop</button></div> : <button type="button" className="copilot-text-action copilot-greeting-play" aria-label="Play SAAYA greeting" onClick={() => void speakText(saayaGreeting, "greeting", voiceLanguage)}><VoiceIcon kind="speaker" /> Play greeting</button>}</section>
        <form className="copilot-composer" onSubmit={(event) => { event.preventDefault(); submit(); }}>
          <label className="sr-only" htmlFor="saaya-copilot-query">Ask SAAYA anything</label>
          <input id="saaya-copilot-query" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask SAAYA anything…" />
          <button type="button" className={`copilot-mic ${voiceState === "listening" ? "is-listening" : ""}`} disabled={!speechInputSupported} aria-label={recognitionRef.current ? "Stop voice input" : "Start voice input"} title={speechInputSupported ? (recognitionRef.current ? "Stop voice input" : "Start voice input") : "Speech recognition is unavailable"} onClick={() => recognitionRef.current ? recognitionRef.current.stop() : startListening()}><VoiceIcon kind={recognitionRef.current ? "mic-off" : "mic"} /></button>
          <button type="submit" className="copilot-send" disabled={!question.trim()} aria-label="Send message"><span>Send</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 5 16 7-16 7 3-7-3-7Z"/><path d="M7 12h13"/></svg></button>
        </form>
        <div className="copilot-suggestions" aria-label="Suggested questions">{priorityPrompts.map((prompt) => <button type="button" key={prompt} onClick={() => submit(prompt)}>{prompt}</button>)}</div>
        {renderVoiceControls()}
      </section> : <section className="copilot-chat-shell" aria-label="SAAYA conversation">
        <div className="copilot-chat-toolbar"><div><span className="copilot-identity-mark">SAAYA</span><h2>Municipal Heat Intelligence</h2></div><button type="button" onClick={() => { stopSpeaking(); setTurns([]); setQuestion(""); setDraftEdited({}); }} aria-label="Start a new chat">New Chat</button></div>
        {renderVoiceControls()}
        <div className="copilot-conversation" aria-live="polite" aria-relevant="additions text">{turns.map((turn, index) => <article className="copilot-turn" key={`${turn.question}-${index}`}>
          <p className="copilot-user-bubble">{turn.question}</p>
          <div className="copilot-assistant-message"><div className="copilot-assistant-label"><span className="copilot-assistant-mark" aria-hidden="true">S</span><b>SAAYA</b>{renderResponseSpeechControl(turn.answer, index)}<button type="button" className="copilot-text-action" onClick={() => void copyToClipboard(`${turn.answer.title}\n${turn.answer.summary}\n${turn.answer.evidence.join("\n")}`, `summary-${index}`)}>{copiedKey === `summary-${index}` ? "Copied" : "Copy"}</button></div>
            <h3>{turn.answer.title}</h3><p className="copilot-answer-summary">{turn.answer.summary}</p>
            {turn.answer.evidence.length > 0 && <section className="copilot-evidence"><h4>Key evidence</h4><ul>{turn.answer.evidence.map((item) => <li key={item}>{item}</li>)}</ul></section>}
            {turn.answer.wards && turn.answer.wards.length > 0 && <div className={`copilot-ward-table ${turn.answer.title.toLowerCase().includes("comparison") ? "is-comparison" : ""}`} role="table" aria-label="Ward comparison and priority results"><div role="row" className="copilot-ward-row copilot-ward-head"><span>{turn.answer.title.toLowerCase().includes("comparison") ? "Metric / ward" : "Priority ward"}</span><span>Risk</span><span>HTSI</span><span>Temperature</span><span>Exposure</span>{turn.answer.title.toLowerCase().includes("comparison") && <><span>Vulnerability</span><span>Health impact</span></>}</div>{turn.answer.wards.slice(0, 5).map((ward, wardIndex) => { const metrics = thermalMetrics(ward); const impact = calculateHealthImpact(ward); return <div role="row" className="copilot-ward-row" key={ward.wardId}><span className="copilot-ward-name-cell"><button type="button" onClick={() => onOpenWard(ward.wardId)} title={fullWard(ward)}>{turn.answer.title.toLowerCase().includes("priorit") ? `${wardIndex + 1}. ` : ""}{fullWard(ward)}</button>{turn.answer.title.toLowerCase().includes("priorit") && <small>Why: {metrics.explanation}</small>}</span><span>{ward.riskLevel}</span><b>{metrics.htsi}</b><span>{ward.temperature.toFixed(1)}°C</span><span>{impact.exposure}</span>{turn.answer.title.toLowerCase().includes("comparison") && <><span>Unavailable</span><span>{impact.potentialImpact} · estimate</span></>}</div>; })}</div>}
            {turn.answer.actions && <section className="copilot-evidence"><h4>Recommended action</h4><ol>{turn.answer.actions.slice(0, 4).map((action) => <li key={action}>{action}</li>)}</ol></section>}
            {turn.answer.draft && <section className="copilot-draft"><div><b>DRAFT PUBLIC ALERT · NOT ISSUED</b><span>{fullWard(rows.find((ward) => ward.wardId === turn.answer.draftWardId) ?? rows[0])}</span></div><textarea aria-label="Edit heat alert draft" value={draftEdited[index] ?? turn.answer.draft} onChange={(event) => setDraftEdited((current) => ({ ...current, [index]: event.target.value }))} rows={6} /><div className="copilot-draft-actions"><button type="button" onClick={() => void copyToClipboard(draftEdited[index] ?? turn.answer.draft!, `draft-${index}`)}>{copiedKey === `draft-${index}` ? "Copied" : "Copy draft"}</button>{turn.answer.draftTransferAllowed !== false && <button type="button" onClick={() => onAlertDraft({ wardId: turn.answer.draftWardId!, audience: turn.answer.draftAudience ?? "Both", message: draftEdited[index] ?? turn.answer.draft! })}>Open Alerts for review</button>}</div></section>}
            {turn.answer.caveat && <p className="copilot-caveat">{turn.answer.caveat}</p>}
            {turn.answer.wards?.[0] && <div className="copilot-chat-actions"><button type="button" onClick={() => onHeatMap(turn.answer.wards![0].wardId)}>View on Heat Map</button><button type="button" onClick={() => onResponse(turn.answer.wards![0].wardId)}>Response Planner</button></div>}
            {turn.answer.title.toLowerCase().includes("situation brief") && <div className="copilot-chat-actions"><button type="button" onClick={() => void copyToClipboard(`${turn.answer.title}\n${turn.answer.summary}\n${turn.answer.evidence.join("\n")}`, `brief-${index}`)}>{copiedKey === `brief-${index}` ? "Copied" : "Copy Brief"}</button><button type="button" onClick={() => onHeatMap()}>View Heat Map</button></div>}
          </div>
        </article>)}</div>
        <form className="copilot-composer copilot-composer-followup" onSubmit={(event) => { event.preventDefault(); submit(); }}><label className="sr-only" htmlFor="saaya-copilot-followup">Ask a follow-up question</label><input id="saaya-copilot-followup" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a follow-up question…" /><button type="button" className={`copilot-mic ${voiceState === "listening" ? "is-listening" : ""}`} disabled={!speechInputSupported} aria-label={recognitionRef.current ? "Stop voice input" : "Start voice input"} title={speechInputSupported ? (recognitionRef.current ? "Stop voice input" : "Start voice input") : "Speech recognition is unavailable"} onClick={() => recognitionRef.current ? recognitionRef.current.stop() : startListening()}><VoiceIcon kind={recognitionRef.current ? "mic-off" : "mic"} /></button><button type="submit" className="copilot-send" disabled={!question.trim()} aria-label="Send message"><span>Send</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 5 16 7-16 7 3-7-3-7Z"/><path d="M7 12h13"/></svg></button></form>
      </section>}
      <p className="copilot-trust-note">Reference date {shortDate(date)} · Historical ward inputs and simulated citywide forecast. Risk values are model-derived; readiness feeds are not connected.</p>
    </section><aside className="copilot-priority-panel"><p className="page-eyebrow">TODAY'S PRIORITIES</p><h2>Municipal context</h2><div className="copilot-priority-city"><span>Priority wards</span><b>{highPlusCount} require attention</b><small>{summary.riskLevel} city status · HTSI {summary.score}/100</small></div><div className="copilot-priority-wards"><h3>Highest current HTSI</h3>{ranked.slice(0, 3).map((ward, index) => <button type="button" key={ward.wardId} onClick={() => onHeatMap(ward.wardId)}><small>{String(index + 1).padStart(2, "0")}</small><span><b title={fullWard(ward)}>{fullWard(ward)}</b><em>{ward.riskLevel} · HTSI {thermalMetrics(ward).htsi}</em></span></button>)}</div><button type="button" className="copilot-map-link" onClick={() => onHeatMap()}>View Heat Map <span aria-hidden="true">→</span></button><p className="copilot-trust-note">Reference data: {shortDate(date)} · {summary.rows.length} wards.</p></aside></div>
  </main>;
}
