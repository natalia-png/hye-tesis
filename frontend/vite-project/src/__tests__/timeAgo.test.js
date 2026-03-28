// src/__tests__/timeAgo.test.js
import { timeAgo, timeAgoSmart } from "../utils/timeAgo";

const now = () => Date.now();
const secsAgo = (s) => new Date(now() - s * 1000).toISOString();
const minsAgo = (m) => secsAgo(m * 60);
const hoursAgo = (h) => minsAgo(h * 60);
const daysAgo = (d) => hoursAgo(d * 24);

describe("timeAgo", () => {
  test("retorna '—' para valor falsy", () => {
    expect(timeAgo(null)).toBe("—");
    expect(timeAgo(undefined)).toBe("—");
    expect(timeAgo("")).toBe("—");
  });

  test("retorna '—' para fecha inválida", () => {
    expect(timeAgo("no-es-fecha")).toBe("—");
  });

  test("retorna 'ahora' para menos de 60 segundos", () => {
    expect(timeAgo(secsAgo(30))).toBe("ahora");
    expect(timeAgo(secsAgo(0))).toBe("ahora");
  });

  test("retorna 'hace Xmin' para menos de 60 minutos", () => {
    const result = timeAgo(minsAgo(5));
    expect(result).toBe("hace 5min");
  });

  test("retorna 'hace Xh' para menos de 24 horas", () => {
    const result = timeAgo(hoursAgo(3));
    expect(result).toBe("hace 3h");
  });

  test("retorna 'hace Xd' para más de 24 horas", () => {
    const result = timeAgo(daysAgo(2));
    expect(result).toBe("hace 2d");
  });

  test("acepta objeto con campo seconds (Firestore Timestamp)", () => {
    const ts = { seconds: Math.floor((now() - 10000) / 1000) };
    expect(timeAgo(ts)).toBe("ahora");
  });
});

describe("timeAgoSmart", () => {
  test("retorna '—' para valor falsy", () => {
    expect(timeAgoSmart(null)).toBe("—");
    expect(timeAgoSmart(undefined)).toBe("—");
  });

  test("retorna '—' para fecha inválida", () => {
    expect(timeAgoSmart("xyz")).toBe("—");
  });

  test("retorna 'hace unos segundos' para menos de 10 segundos", () => {
    expect(timeAgoSmart(secsAgo(5))).toBe("hace unos segundos");
  });

  test("retorna 'hace Xs' para 10-59 segundos", () => {
    const result = timeAgoSmart(secsAgo(30));
    expect(result).toBe("hace 30s");
  });

  test("retorna 'hace X min' para menos de 60 minutos", () => {
    const result = timeAgoSmart(minsAgo(10));
    expect(result).toBe("hace 10 min");
  });

  test("retorna 'hace X h' para menos de 24 horas", () => {
    const result = timeAgoSmart(hoursAgo(5));
    expect(result).toBe("hace 5 h");
  });

  test("retorna 'hace X d' para más de 24 horas", () => {
    const result = timeAgoSmart(daysAgo(3));
    expect(result).toBe("hace 3 d");
  });

  test("acepta Firestore Timestamp", () => {
    const ts = { seconds: Math.floor((now() - 5000) / 1000) };
    expect(timeAgoSmart(ts)).toBe("hace unos segundos");
  });
});
