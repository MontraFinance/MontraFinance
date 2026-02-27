/**
 * Profanity / slur filter for holders chat.
 * Catches creative spellings (leet-speak, symbol substitutions).
 * Used for both messages and display names.
 */

// Character substitution map — maps leet-speak to their alpha equivalents
const SUBS: Record<string, string> = {
  "@": "a",
  "4": "a",
  "^": "a",
  "8": "b",
  "(": "c",
  "{": "c",
  "3": "e",
  "6": "g",
  "9": "g",
  "#": "h",
  "!": "i",
  "1": "i",
  "|": "i",
  "0": "o",
  "5": "s",
  "$": "s",
  "7": "t",
  "+": "t",
  "2": "z",
};

/**
 * Normalize text: strip accents, apply leet-speak substitution,
 * collapse repeated chars, lowercase.
 */
function normalize(text: string): string {
  // Remove diacritics / accents
  let s = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Lowercase
  s = s.toLowerCase();
  // Apply character substitutions
  s = s
    .split("")
    .map((c) => SUBS[c] || c)
    .join("");
  // Remove non-alpha (keep spaces for word boundary detection)
  s = s.replace(/[^a-z\s]/g, "");
  // Collapse repeated characters (e.g., "faaag" → "fag")
  s = s.replace(/(.)\1{2,}/g, "$1$1");
  return s;
}

// ── Banned word list ──
// Each entry is matched against the normalized text.
// Keep sorted alphabetically for maintainability.
const BANNED_PATTERNS: string[] = [
  "anal",
  "anus",
  "bastard",
  "bitch",
  "blowjob",
  "boner",
  "butthole",
  "chink",
  "clit",
  "cock",
  "coon",
  "cum",
  "cunt",
  "damn",
  "dick",
  "dildo",
  "dyke",
  "fag",
  "fagg",
  "faggot",
  "felch",
  "fuck",
  "gook",
  "handjob",
  "hell",
  "homo",
  "jizz",
  "kike",
  "lesbo",
  "milf",
  "negro",
  "nigga",
  "nigger",
  "nude",
  "pedo",
  "penis",
  "piss",
  "porn",
  "pussy",
  "rape",
  "retard",
  "scrotum",
  "semen",
  "sex",
  "shit",
  "slut",
  "smegma",
  "spic",
  "spook",
  "testicle",
  "tits",
  "tranny",
  "twat",
  "vagina",
  "vulva",
  "wank",
  "wetback",
  "whore",
];

// Build regex patterns — word-boundary aware where possible
const BANNED_RE = BANNED_PATTERNS.map(
  (word) => new RegExp(`(?:^|\\s|\\b)${word}(?:\\s|$|\\b)`, "i"),
);

// Also do a simple substring check for the worst slurs (even inside words)
const STRICT_SUBSTRINGS = [
  "nigger",
  "nigga",
  "faggot",
  "fagg",
  "fag",
  "kike",
  "chink",
  "gook",
  "spic",
  "wetback",
  "tranny",
  "retard",
  "cunt",
];

/**
 * Check if text contains profanity / slurs.
 * Returns { clean: true } or { clean: false, reason: string }.
 */
export function checkProfanity(text: string): { clean: boolean; reason?: string } {
  const normalized = normalize(text);

  // Strict substring check for worst slurs (catches even embedded in other words)
  for (const slur of STRICT_SUBSTRINGS) {
    if (normalized.includes(slur)) {
      return { clean: false, reason: "Message contains prohibited language" };
    }
  }

  // Word-boundary check for general profanity
  for (const re of BANNED_RE) {
    if (re.test(normalized)) {
      return { clean: false, reason: "Message contains inappropriate language" };
    }
  }

  return { clean: true };
}

/**
 * Check display name for profanity.
 * Stricter — also rejects names that are just numbers or too short.
 */
export function checkDisplayName(name: string): { valid: boolean; reason?: string } {
  const trimmed = name.trim();

  if (trimmed.length < 2) {
    return { valid: false, reason: "Display name must be at least 2 characters" };
  }
  if (trimmed.length > 20) {
    return { valid: false, reason: "Display name must be 20 characters or less" };
  }
  // Only allow alphanumeric, underscores, hyphens, periods
  if (!/^[a-zA-Z0-9_.\-]+$/.test(trimmed)) {
    return { valid: false, reason: "Display name can only contain letters, numbers, underscores, hyphens, and periods" };
  }
  // Must start with a letter
  if (!/^[a-zA-Z]/.test(trimmed)) {
    return { valid: false, reason: "Display name must start with a letter" };
  }

  const profCheck = checkProfanity(trimmed);
  if (!profCheck.clean) {
    return { valid: false, reason: "Display name contains prohibited language" };
  }

  return { valid: true };
}
