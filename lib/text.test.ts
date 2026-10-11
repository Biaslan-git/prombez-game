import { describe, expect, it } from "vitest";
import { areaSlugFromCode, questionSlug } from "./slug";
import { normalizeText, truncate } from "./text";

describe("normalizeText", () => {
  it("collapses spaces and nbsp", () => {
    expect(normalizeText("  Какие  требования   ,  предъявляются ? ")).toBe("Какие требования, предъявляются?");
  });
  it("converts quotes to guillemets", () => {
    expect(normalizeText('Закон "О промышленной безопасности"')).toBe("Закон «О промышленной безопасности»");
    expect(normalizeText("ФНП “Правила безопасности”")).toBe("ФНП «Правила безопасности»");
  });
  it("keeps single line breaks, drops repeated empty lines", () => {
    expect(normalizeText("a\n\n\n b ")).toBe("a\n\nb");
  });
});

describe("truncate", () => {
  it("cuts on word boundary", () => {
    expect(truncate("один два три четыре", 12)).toBe("один два…");
    expect(truncate("коротко", 20)).toBe("коротко");
  });
});

describe("slugs", () => {
  it("builds question slug from number and first words", () => {
    expect(
      questionSlug(15, "Кто осуществляет надзор за опасными производственными объектами? И что-то ещё длинное"),
    ).toBe("15-kto-osushchestvlyaet-nadzor-za-opasnymi-proizvodstvennymi-obektami-i");
  });
  it("handles empty tail", () => {
    expect(questionSlug(3, "???")).toBe("3");
  });
  it("builds area slug from code", () => {
    expect(areaSlugFromCode("А.1")).toBe("a1");
    expect(areaSlugFromCode("Б.9.3")).toBe("b93");
  });
});
