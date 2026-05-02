import { BrowserWindow, safeStorage, session } from "electron";
import fs from "node:fs";
import path from "node:path";
import { KOREA_POLICY_MAIN_URL, KOREA_POLICY_ORIGIN } from "../../shared/constants";
import type { AuthStatus } from "../../shared/types";
import type { AppPaths } from "../app-paths";
import { fetchWithSession, looksLikeLoginPage } from "../crawler/fetch-with-session";
import type { Logger } from "../logs/logger";

interface SavedCookie {
  name: string;
  value: string;
  domain?: string;
  hostOnly?: boolean;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  expirationDate?: number;
  sameSite?: "unspecified" | "no_restriction" | "lax" | "strict";
}

export class SessionManager {
  private readonly cookiePath: string;

  constructor(
    private readonly paths: AppPaths,
    private readonly logger: Logger,
  ) {
    this.cookiePath = path.join(paths.authDir, "cookies.enc");
  }

  async openLoginWindow(parent: BrowserWindow): Promise<AuthStatus> {
    const loginWindow = new BrowserWindow({
      width: 1120,
      height: 820,
      parent,
      modal: false,
      title: "고려대학교 규정관리시스템 로그인",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    await loginWindow.loadURL(KOREA_POLICY_MAIN_URL);
    return new Promise((resolve) => {
      loginWindow.on("closed", async () => {
        await this.saveCookies();
        resolve(await this.checkStatus());
      });
    });
  }

  async checkStatus(): Promise<AuthStatus> {
    if (!(await this.hasAnyPolicyCookie())) {
      await this.loadCookies();
    }

    if (!(await this.hasAnyPolicyCookie())) {
      return { status: "AUTH_REQUIRED", message: "[AUTH_REQUIRED] 로그인 세션이 없습니다." };
    }

    try {
      const result = await fetchWithSession(KOREA_POLICY_MAIN_URL);
      if (looksLikeLoginPage(result.text, result.url)) {
        return { status: "AUTH_EXPIRED", message: "[AUTH_EXPIRED] 로그인 세션이 만료되었습니다." };
      }
      await this.saveCookies();
      return { status: "AUTHENTICATED", message: "로그인 세션을 확인했습니다." };
    } catch (error) {
      this.logger.warn("Auth status check failed", { errorType: error instanceof Error ? error.name : "unknown" });
      return { status: "AUTH_EXPIRED", message: "[AUTH_EXPIRED] 로그인 세션을 확인할 수 없습니다." };
    }
  }

  async saveCookies(): Promise<void> {
    const cookies = await session.defaultSession.cookies.get({ url: KOREA_POLICY_ORIGIN });
    if (cookies.length === 0) return;
    if (!safeStorage.isEncryptionAvailable()) {
      this.logger.warn("Cookie persistence skipped because safeStorage encryption is unavailable");
      return;
    }

    const minimalCookies = cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      hostOnly: cookie.hostOnly,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      expirationDate: cookie.expirationDate,
      sameSite: cookie.sameSite,
    }));

    const payload = JSON.stringify(minimalCookies);
    fs.writeFileSync(this.cookiePath, safeStorage.encryptString(payload));
  }

  async loadCookies(): Promise<void> {
    if (!fs.existsSync(this.cookiePath)) return;

    try {
      const raw = fs.readFileSync(this.cookiePath);
      if (!safeStorage.isEncryptionAvailable()) {
        this.logger.warn("Saved cookies cannot be loaded because safeStorage encryption is unavailable");
        return;
      }
      const payload = safeStorage.decryptString(raw);
      const cookies = JSON.parse(payload) as SavedCookie[];
      for (const cookie of cookies) {
        await session.defaultSession.cookies.set({
          url: cookieToUrl(cookie),
          name: cookie.name,
          value: cookie.value,
          domain: cookie.hostOnly ? undefined : cookie.domain,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          expirationDate: cookie.expirationDate,
          sameSite: cookie.sameSite,
        });
      }
    } catch (error) {
      this.logger.warn("Failed to load saved cookies", { errorType: error instanceof Error ? error.name : "unknown" });
      await this.clearSession();
    }
  }

  async clearSession(): Promise<void> {
    const cookies = await session.defaultSession.cookies.get({ url: KOREA_POLICY_ORIGIN });
    await Promise.all(
      cookies.map((cookie) =>
        session.defaultSession.cookies.remove(cookieToUrl(cookie), cookie.name).catch(() => undefined),
      ),
    );
    if (fs.existsSync(this.cookiePath)) fs.rmSync(this.cookiePath, { force: true });
  }

  async hasStoredSession(): Promise<boolean> {
    return fs.existsSync(this.cookiePath) || (await this.hasAnyPolicyCookie());
  }

  private async hasAnyPolicyCookie(): Promise<boolean> {
    const cookies = await session.defaultSession.cookies.get({ url: KOREA_POLICY_ORIGIN });
    return cookies.length > 0;
  }
}

function cookieToUrl(cookie: Pick<SavedCookie, "domain" | "path" | "secure">): string {
  const host = (cookie.domain ?? "policies.korea.ac.kr").replace(/^\./u, "");
  const protocol = cookie.secure === false ? "http" : "https";
  return `${protocol}://${host}${cookie.path ?? "/"}`;
}
