import { describe, expect, it } from "vitest";
import { displayText, formatPurchaseDate, formatReceivedDay, formatYen, resolveLocale, translate } from "../src/lib/i18n";
import { errorMessage } from "../src/lib/messages";

describe("display language boundaries", () => {
  it("keeps a manual choice ahead of browser languages and handles regional tags", () => {
    expect(resolveLocale("ja", ["ko-KR", "en-US"])).toBe("ja");
    expect(resolveLocale(null, ["ko-KR", "en-US"])).toBe("ko");
    expect(resolveLocale(null, ["fr-FR", "en-GB"])).toBe("en");
    expect(resolveLocale("broken", ["JA-jp"])).toBe("ja");
    expect(resolveLocale("constructor", ["fr-FR"])).toBe("ja");
  });
  it("formats counts and changes existing error messages at display time", () => {
    expect(translate("ko", "未送信 {count}件", { count: 12 })).toBe("미전송 12건");
    expect(errorMessage("FILE_TOO_LARGE", "en")).toContain("12MB");
    expect(errorMessage("CAMERA_UNAVAILABLE", "ko")).toContain("카메라");
    expect(errorMessage("UNKNOWN", "en")).toContain("retried");
  });
  it("preserves zero yen and never turns missing amounts into zero", () => {
    for (const locale of ["ja", "ko", "en"] as const) {
      expect(formatYen(0, locale)).toMatch(/0/);
      expect(formatYen(0, locale)).not.toBe(formatYen(null, locale));
      expect(formatYen(1234, locale)).toContain("1,234");
    }
  });
  it("retains Japanese calendar dates across language and UTC boundaries", () => {
    expect(formatPurchaseDate("2026-09-21", "en")).toBe("Sep 21, 2026");
    expect(formatReceivedDay("2026-09-20T15:01:00Z", "en")).toContain("21");
    expect(formatPurchaseDate("unrecognized date", "ko")).toBe("unrecognized date");
  });
  it("translates known system labels without rewriting unknown receipt text", () => {
    expect(displayText("店舗名を確認してください", "ko")).toBe("매장명을 확인해 주세요");
    expect(displayText("旅費交通費", "en")).toBe("Travel & transport expense");
    expect(displayText("新宿商店 本店", "en")).toBe("新宿商店 本店");
    expect(displayText("constructor", "en")).toBe("constructor");
  });
});
