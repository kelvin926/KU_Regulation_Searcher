import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  net: {},
  session: {
    defaultSession: {
      cookies: {
        get: vi.fn(),
      },
    },
  },
}));

import { looksLikeLoginPage } from "./fetch-with-session";

describe("session fetch login detection", () => {
  it("detects login pages with a password input", () => {
    expect(
      looksLikeLoginPage(`
        <html>
          <body>
            <form action="/login">
              <input name="id" />
              <input type="password" name="password" />
              <button>로그인</button>
            </form>
          </body>
        </html>
      `),
    ).toBe(true);
  });

  it("does not treat regulation content forms as expired login sessions", () => {
    expect(
      looksLikeLoginPage(`
        <html>
          <body>
            <form id="searchForm">
              <input name="search" value="login password" />
            </form>
            <div class="lawname">사무분장 규정</div>
            <p>제 1 조 (목적) 이 규정은 교내 사무를 정한다.</p>
          </body>
        </html>
      `),
    ).toBe(false);
  });
});
