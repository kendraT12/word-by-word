// Tiny test harness for the JavaScriptCore shell (jsc -m tests/run.js).
const out = (s) => (globalThis.print ? globalThis.print(s) : console.log(s));
const tests = [];

function stable(v) {
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (v && typeof v === "object") {
    return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}";
  }
  return JSON.stringify(v);
}

export function test(name, fn) { tests.push({ name, fn }); }

export function eq(actual, expected, msg) {
  const a = stable(actual), e = stable(expected);
  if (a !== e) throw new Error((msg ? msg + ": " : "") + "expected " + e + " got " + a);
}

export function ok(x, msg) { if (!x) throw new Error(msg || "expected truthy, got " + stable(x)); }

export async function report() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); pass++; }
    catch (e) { fail++; out("FAIL " + t.name + ": " + ((e && e.message) || e)); }
  }
  out("PASS " + pass);
  out(fail ? "FAILED " + fail : "ALL PASS");
}
