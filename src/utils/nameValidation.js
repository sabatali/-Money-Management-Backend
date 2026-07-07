const MAX_NAME_LENGTH = 50;

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 400;
  }
}

const collapseSpaces = (value) => value.replace(/\s+/g, " ").trim();

const isOnlyNumbers = (value) => /^[0-9]+$/.test(value.replace(/\s+/g, ""));

// Words the user typed fully in caps (e.g. "HBL", "NASA") are assumed to be
// intentional acronyms and are preserved instead of being lowercased.
const toTitleCase = (value) =>
  value
    .split(" ")
    .map((word) => {
      if (!word) return word;
      if (word.length > 1 && word === word.toUpperCase() && /[A-Z]/.test(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");

/**
 * Trims, collapses whitespace, and rejects empty / too long / numeric-only names.
 * Throws ValidationError on failure. Returns the cleaned (but not yet cased) name.
 */
const sanitizeName = (rawName) => {
  if (typeof rawName !== "string") {
    throw new ValidationError("Name is required.");
  }
  const cleaned = collapseSpaces(rawName);
  if (!cleaned) {
    throw new ValidationError("Name is required.");
  }
  if (cleaned.length > MAX_NAME_LENGTH) {
    throw new ValidationError(`Name must be at most ${MAX_NAME_LENGTH} characters.`);
  }
  if (isOnlyNumbers(cleaned)) {
    throw new ValidationError("Name cannot contain only numbers.");
  }
  return cleaned;
};

/** Lowercase key used for case-insensitive duplicate checks / master lookups. */
const buildNormalizedKey = (cleanedName) => cleanedName.toLowerCase();

const capitalizeName = (cleanedName) => toTitleCase(cleanedName);

module.exports = {
  ValidationError,
  MAX_NAME_LENGTH,
  sanitizeName,
  buildNormalizedKey,
  capitalizeName,
};
