export type SaayaVoiceLanguage = "en-IN" | "hi-IN";
export type SaayaVoiceChoice = { voice: SpeechSynthesisVoice; isReliablyFemale: boolean };

// These are metadata hints, not assumptions that any named system voice is installed.
export const preferredFemaleVoiceHints = [
  "female", "woman", "zira", "samantha", "aria", "jenny", "ava", "susan", "heera", "neerja",
  "priya", "aditi", "raveena", "veena", "kajal", "swara", "lekha", "meera", "kavya",
];

const femaleNamePattern = new RegExp(`(?:^|[\\s()_-])(?:${preferredFemaleVoiceHints.join("|")})(?:$|[\\s()_-])`, "i");
const maleNamePattern = /(?:^|[\s()_-])(?:male|man|boy|david|mark|daniel|rishi|james|george)(?:$|[\s()_-])/i;

function reliablyFemale(voice: SpeechSynthesisVoice): boolean {
  const metadata = voice as SpeechSynthesisVoice & { gender?: string };
  if (metadata.gender?.toLowerCase() === "female") return true;
  if (metadata.gender?.toLowerCase() === "male") return false;
  const name = `${voice.name} ${voice.voiceURI}`;
  return femaleNamePattern.test(name) && !maleNamePattern.test(name);
}

function languageRank(voice: SpeechSynthesisVoice, requested: SaayaVoiceLanguage): number {
  const lang = voice.lang.toLowerCase();
  if (requested === "hi-IN") {
    if (lang === "hi-in") return 120;
    if (lang.startsWith("hi-")) return 105;
    if (lang.startsWith("en-in")) return 65;
    if (lang.startsWith("en-")) return 50;
    return 0;
  }
  if (lang.startsWith("en-in")) return 110;
  if (lang.startsWith("en-")) return 90;
  return 0;
}

/** Selects a matching female voice only when available metadata supports that choice. */
export function getPreferredSaayaVoice(voices: SpeechSynthesisVoice[], requested: SaayaVoiceLanguage = "en-IN"): SaayaVoiceChoice | undefined {
  let candidates = voices
    .map((voice) => ({ voice, female: reliablyFemale(voice), language: languageRank(voice, requested) }))
    .filter((candidate) => candidate.language > 0);
  if (requested === "hi-IN" && candidates.some((candidate) => candidate.language >= 105)) {
    candidates = candidates.filter((candidate) => candidate.language >= 105);
  }
  candidates.sort((a, b) => {
    const aScore = a.language + (a.female ? 1000 : 0) + (a.voice.localService ? 8 : 0) + (/natural|neural|premium/i.test(a.voice.name) ? 4 : 0);
    const bScore = b.language + (b.female ? 1000 : 0) + (b.voice.localService ? 8 : 0) + (/natural|neural|premium/i.test(b.voice.name) ? 4 : 0);
    return bScore - aScore || a.voice.name.localeCompare(b.voice.name);
  });
  const selected = candidates[0];
  return selected ? { voice: selected.voice, isReliablyFemale: selected.female } : undefined;
}

/** Changes only the spoken copy; visible SAAYA branding and message text remain untouched. */
export function prepareTextForSpeech(text: string): string {
  return text.replace(/\bSAAYA\b/gi, "Saaya");
}

export function splitSpeechIntoChunks(text: string, maxLength = 220): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n+/).map((part) => part.trim()).filter(Boolean);
  let pending = "";
  const append = (piece: string) => {
    const candidate = pending ? `${pending} ${piece}` : piece;
    if (candidate.length <= maxLength) { pending = candidate; return; }
    if (pending) { chunks.push(pending); pending = ""; }
    if (piece.length <= maxLength) { pending = piece; return; }
    const words = piece.split(/\s+/);
    for (const word of words) {
      const next = pending ? `${pending} ${word}` : word;
      if (next.length > maxLength && pending) { chunks.push(pending); pending = word; }
      else pending = next;
    }
  };
  for (const paragraph of paragraphs) {
    const sentences: string[] = [];
    let sentenceStart = 0;
    for (let index = 0; index < paragraph.length; index += 1) {
      const punctuation = paragraph[index];
      const sentenceEnd = punctuation === "।" || punctuation === "!" || punctuation === "?" || (punctuation === "." && (index + 1 === paragraph.length || /\s/.test(paragraph[index + 1] ?? "")));
      if (sentenceEnd) { sentences.push(paragraph.slice(sentenceStart, index + 1).trim()); sentenceStart = index + 1; }
    }
    if (sentenceStart < paragraph.length) sentences.push(paragraph.slice(sentenceStart).trim());
    for (const sentence of sentences) append(sentence);
    if (pending) { chunks.push(pending); pending = ""; }
  }
  if (pending) chunks.push(pending);
  return chunks;
}
