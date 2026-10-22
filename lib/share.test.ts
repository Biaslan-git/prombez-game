import { describe, expect, it } from "vitest";
import { telegramShareUrl, vkShareUrl, withUtm } from "./share";

describe("share", () => {
  it("добавляет utm_source, не ломая существующие параметры", () => {
    expect(withUtm("https://prombez-game.ru/a1/q/5-x", "share")).toBe(
      "https://prombez-game.ru/a1/q/5-x?utm_source=share",
    );
    expect(withUtm("https://prombez-game.ru/a1?x=1", "telegram")).toBe(
      "https://prombez-game.ru/a1?x=1&utm_source=telegram",
    );
  });

  it("кодирует адрес и текст", () => {
    const tg = telegramShareUrl("https://prombez-game.ru/a1?utm_source=share", "Я набрал 4 из 5");
    expect(tg).toContain("https://t.me/share/url?url=https%3A%2F%2Fprombez-game.ru%2Fa1%3Futm_source%3Dshare");
    expect(tg).toContain("text=%D0%AF");
    expect(vkShareUrl("https://x.ru/", "Тест")).toBe(
      "https://vk.com/share.php?url=https%3A%2F%2Fx.ru%2F&title=%D0%A2%D0%B5%D1%81%D1%82",
    );
  });
});
