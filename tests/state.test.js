import { test, eq } from "./t.js";
import { state, dayLog, practiceDays } from "../state.js";

const withDays = (days, fn) => {
  const was = state.days, wasToday = state.todayOverride;
  state.days = days;
  try { return fn(); } finally { state.days = was; state.todayOverride = wasToday; }
};

test("dayLog: a log written before there was maths gains the maths fields", () => {
  withDays({ "2026-11-26": { minutes: 12, practiced: ["cat"], learned: [], helps: 0, storyWpm: [] } }, () => {
    state.todayOverride = "2026-11-26";
    const log = dayLog();
    eq(log.minutes, 12);
    eq(log.mathMinutes, 0);
    eq(log.mathAnswered, 0);
    eq(log.mathHelps, 0);
    eq(log.mathTrace, []);
  });
});
test("practiceDays: reading days and maths days are counted apart", () => {
  const days = {
    "2026-11-24": { minutes: 10, practiced: ["cat"] },
    "2026-11-25": { mathMinutes: 8, mathAnswered: 14 },
    "2026-11-26": { minutes: 9, mathMinutes: 7 },
  };
  withDays(days, () => {
    eq(practiceDays(), ["2026-11-24", "2026-11-26"]);
    eq(practiceDays("reading"), ["2026-11-24", "2026-11-26"]);
    eq(practiceDays("maths"), ["2026-11-25", "2026-11-26"]);
    eq(practiceDays("any"), ["2026-11-24", "2026-11-25", "2026-11-26"]);
  });
});
