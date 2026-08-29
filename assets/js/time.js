/*
 * Time stamping — America/Chicago, ISO 8601 with offset.
 * The programme runs on Central time; stamps must be unambiguous on the sheet,
 * so we always carry the offset (-05:00 CDT / -06:00 CST) rather than a bare local time.
 */

export const TZ = 'America/Chicago';

function partsIn(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  // Intl renders midnight as "24" in some engines; normalise to "00".
  if (p.hour === '24') p.hour = '00';
  return p;
}

/** Offset of `date` in `timeZone`, as ±HH:MM. */
function offsetString(date, timeZone) {
  const p = partsIn(date, timeZone);
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  let minutes = Math.round((asUTC - Math.floor(date.getTime() / 1000) * 1000) / 60000);
  const sign = minutes < 0 ? '-' : '+';
  minutes = Math.abs(minutes);
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

/** Full ISO 8601 stamp in America/Chicago, e.g. 2026-08-27T14:32:05-05:00 */
export function stampNow(date = new Date()) {
  const p = partsIn(date, TZ);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${offsetString(date, TZ)}`;
}

/** Calendar date in America/Chicago, YYYY-MM-DD. */
export function todayISO(date = new Date()) {
  const p = partsIn(date, TZ);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Pull the YYYY-MM-DD out of a stamp (or any ISO-ish string). */
export function dateOf(stamp) {
  if (!stamp) return '';
  const m = String(stamp).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

/** Human-readable rendering for the report header. */
export function prettyStamp(stamp) {
  if (!stamp) return '';
  const m = String(stamp).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return String(stamp);
  const [, y, mo, d, h, mi] = m;
  const hour = +h % 12 || 12;
  const ampm = +h < 12 ? 'a.m.' : 'p.m.';
  const months = ['January','February','March','April','May','June','July',
                  'August','September','October','November','December'];
  return `${months[+mo - 1]} ${+d}, ${y} at ${hour}:${mi} ${ampm} CT`;
}

/** Whole minutes between two stamps; null when either is missing or unparseable. */
export function durationMinutes(inStamp, outStamp) {
  if (!inStamp || !outStamp) return null;
  const a = Date.parse(inStamp), b = Date.parse(outStamp);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return Math.round((b - a) / 60000);
}

/**
 * Readable Time In / Time Out for the report header. A same-day range prints the date
 * once with both clock times, instead of repeating the full date twice.
 */
export function timeRange(inStamp, outStamp) {
  if (!inStamp) return '';
  if (!outStamp) return prettyStamp(inStamp);
  const a = String(inStamp).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  const b = String(outStamp).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!a || !b) return `${prettyStamp(inStamp)} – ${prettyStamp(outStamp)}`;
  if (a[1] !== b[1]) return `${prettyStamp(inStamp)} – ${prettyStamp(outStamp)}`;

  const clock = (h, m) => `${+h % 12 || 12}:${m}`;
  const mer = (h) => (+h < 12 ? 'a.m.' : 'p.m.');
  const months = ['January','February','March','April','May','June','July',
                  'August','September','October','November','December'];
  const [, y, mo, d] = a[1].match(/(\d{4})-(\d{2})-(\d{2})/);
  const date = `${months[+mo - 1]} ${+d}, ${y}`;

  return mer(a[2]) === mer(b[2])
    ? `${date} · ${clock(a[2], a[3])} – ${clock(b[2], b[3])} ${mer(b[2])} CT`
    : `${date} · ${clock(a[2], a[3])} ${mer(a[2])} – ${clock(b[2], b[3])} ${mer(b[2])} CT`;
}

/**
 * Clock-only range for a report header that already shows the Observation Date in its
 * own field: "9:15 - 10:04 a.m. CT". Falls back to the full stamp if the two stamps
 * land on different days, where the date genuinely carries meaning.
 */
export function clockRange(inStamp, outStamp) {
  if (!inStamp) return '';
  const a = String(inStamp).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!a) return prettyStamp(inStamp);

  const clock = (h, m) => `${+h % 12 || 12}:${m}`;
  const mer = (h) => (+h < 12 ? 'a.m.' : 'p.m.');

  if (!outStamp) return `${clock(a[2], a[3])} ${mer(a[2])} CT`;

  const b = String(outStamp).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!b) return `${clock(a[2], a[3])} ${mer(a[2])} CT`;
  if (a[1] !== b[1]) return timeRange(inStamp, outStamp);

  return mer(a[2]) === mer(b[2])
    ? `${clock(a[2], a[3])} – ${clock(b[2], b[3])} ${mer(b[2])} CT`
    : `${clock(a[2], a[3])} ${mer(a[2])} – ${clock(b[2], b[3])} ${mer(b[2])} CT`;
}
