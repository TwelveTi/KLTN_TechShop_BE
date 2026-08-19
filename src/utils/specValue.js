// Turns what an admin typed into a product specification into typed storage.
//
// The problem this solves: every spec used to be written to `value_text` only,
// so "16GB", "16 GB" and "16384 MB" were three unrelated strings. Nothing could
// filter on a range, and the AI comparison feature had to guess numbers out of
// prose. `SpecificationDefinition.dataType` existed for this all along; this
// module is what finally honours it.
//
// Design rule: `valueText` is ALWAYS kept, even for typed specs. The product
// page shows exactly what the admin wrote ("16 GB DDR5"), while `valueNumber`
// carries the machine-comparable 16. Display fidelity and comparability are not
// in conflict — they live in different columns.

const DATA_TYPES = ["STRING", "NUMBER", "BOOLEAN", "JSON"];

const TRUE_WORDS = ["true", "yes", "y", "1", "co", "có", "on"];
const FALSE_WORDS = ["false", "no", "n", "0", "khong", "không", "off"];

const stripDiacritics = (value) =>
  String(value)
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    // \p{M} = any Unicode combining mark, i.e. the accents NFD just split off.
    // Written as a property escape rather than a literal range so the source
    // stays plain ASCII.
    .replace(/\p{M}/gu, "");

class SpecValueError extends Error {}

// Pulls a number out of a value that may carry its unit inline. Admins type
// "16 GB" or "2,5 kg", not bare numbers, and rejecting that would just push the
// mess back onto them.
//
// The separator rules are deliberately narrow, because "16,000" is ambiguous
// between the Vietnamese decimal comma and the English thousands comma. Only
// unambiguous shapes are accepted; anything else is an error the admin can see
// and fix, never a silent guess.
const extractNumber = (raw, unit) => {
  let text = stripDiacritics(raw).trim();

  // Drop the definition's unit when it is written out, plus any trailing
  // alphabetic unit ("16GB" -> "16").
  if (unit) {
    const escaped = stripDiacritics(unit).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (escaped) {
      text = text.replace(new RegExp(`${escaped}\\s*$`, "i"), "").trim();
    }
  }

  text = text.replace(/[a-zA-Z%°"']+\s*$/, "").trim();
  text = text.replace(/\s+/g, "");

  if (text === "") {
    throw new SpecValueError("no numeric part found");
  }

  const sign = text.startsWith("-") ? -1 : 1;
  const digits = text.replace(/^[+-]/, "");

  // 1234 / 1234.5
  if (/^\d+(\.\d+)?$/.test(digits)) {
    return sign * Number(digits);
  }

  // 2,5 -> 2.5 (Vietnamese decimal comma; only when there is no dot at all)
  if (/^\d+,\d+$/.test(digits)) {
    return sign * Number(digits.replace(",", "."));
  }

  // 16.000 / 1.234.567 / 16,000 -> grouped thousands
  if (/^\d{1,3}([.,]\d{3})+$/.test(digits)) {
    return sign * Number(digits.replace(/[.,]/g, ""));
  }

  // 1.234.567,89 -> dot groups with a decimal comma
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(digits)) {
    return sign * Number(digits.replace(/\./g, "").replace(",", "."));
  }

  // 1,234,567.89 -> comma groups with a decimal dot
  if (/^\d{1,3}(,\d{3})+\.\d+$/.test(digits)) {
    return sign * Number(digits.replace(/,/g, ""));
  }

  throw new SpecValueError(`"${raw}" is not a number`);
};

const extractBoolean = (raw) => {
  const text = stripDiacritics(raw).trim().toLowerCase();
  const normalized = String(raw).trim().toLowerCase();

  if (TRUE_WORDS.includes(text) || TRUE_WORDS.includes(normalized)) {
    return true;
  }

  if (FALSE_WORDS.includes(text) || FALSE_WORDS.includes(normalized)) {
    return false;
  }

  throw new SpecValueError(`"${raw}" is not a yes/no value`);
};

const extractJson = (raw) => {
  if (typeof raw === "object" && raw !== null) {
    return raw;
  }

  try {
    return JSON.parse(String(raw));
  } catch {
    throw new SpecValueError(`"${raw}" is not valid JSON`);
  }
};

// Best guess for a brand-new definition, so the common cases get a useful type
// without the admin having to think about it. Always overridable through the
// definition API — inference is a convenience, not a commitment.
const inferDataType = (raw, unit) => {
  if (typeof raw === "boolean") {
    return "BOOLEAN";
  }

  if (typeof raw === "object" && raw !== null) {
    return "JSON";
  }

  const text = String(raw ?? "").trim();

  if (text === "") {
    return "STRING";
  }

  try {
    extractBoolean(text);
    return "BOOLEAN";
  } catch {
    /* not a boolean, keep going */
  }

  try {
    extractNumber(text, unit);
    // A value that is mostly prose with a number in it ("Intel Core i7 1355U")
    // must not become NUMBER. Require the text to be essentially just a
    // quantity, optionally followed by its unit.
    if (/^[+-]?[\d.,\s]+\s*[a-zA-Z%°"']*$/.test(stripDiacritics(text))) {
      return "NUMBER";
    }
  } catch {
    /* not a number */
  }

  return "STRING";
};

/**
 * Build the four value columns of a `ProductSpecification` row.
 *
 * `raw` is the measurable value; `displayText` is optional prose to show
 * instead. Passing both is how a spec stays rich for humans and exact for
 * machines at the same time:
 *
 *     buildSpecValue(18, "NUMBER", "GB", "18GB Unified Memory")
 *     -> valueNumber: 18,  valueText: "18GB Unified Memory"
 *
 * That matters because product copy is written for shoppers ("14.2 inch Liquid
 * Retina XDR, 120Hz ProMotion"), and no parser should be trusted to mine a
 * comparable number out of a sentence like that. When the number is known, state
 * it; parsing is only the convenience path for plain values like "16 GB".
 *
 * Throws SpecValueError when `raw` does not fit the declared dataType.
 * Rejecting is deliberate: silently leaving `valueNumber` NULL is exactly the
 * bug this module exists to remove, and a NULL would only surface much later as
 * a product missing from a filter.
 */
const buildSpecValue = (raw, dataType = "STRING", unit = null, displayText = null) => {
  const columns = {
    valueText: null,
    valueNumber: null,
    valueBoolean: null,
    valueJson: null,
  };

  // Kept for every type so the storefront can render what was actually typed.
  const source = displayText !== null && displayText !== undefined ? displayText : raw;
  const asText = typeof source === "object" && source !== null ? JSON.stringify(source) : String(source ?? "").trim();
  columns.valueText = asText === "" ? null : asText;

  switch (dataType) {
    case "NUMBER":
      columns.valueNumber = extractNumber(raw, unit);
      break;
    case "BOOLEAN":
      columns.valueBoolean = extractBoolean(raw);
      break;
    case "JSON":
      columns.valueJson = extractJson(raw);
      break;
    case "STRING":
      break;
    default:
      throw new SpecValueError(`Unknown dataType "${dataType}"`);
  }

  return columns;
};

/** The single value a client should read, picked by the definition's dataType. */
const readSpecValue = (specification, definition) => {
  switch (definition?.dataType) {
    case "NUMBER":
      return specification.valueNumber === null || specification.valueNumber === undefined
        ? null
        : Number(specification.valueNumber);
    case "BOOLEAN":
      return specification.valueBoolean;
    case "JSON":
      return specification.valueJson;
    default:
      return specification.valueText;
  }
};

module.exports = {
  DATA_TYPES,
  SpecValueError,
  buildSpecValue,
  inferDataType,
  readSpecValue,
};
