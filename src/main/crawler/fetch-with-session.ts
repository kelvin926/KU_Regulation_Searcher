import { net, session } from "electron";
import { AppError } from "../../shared/errors";
import { KOREA_POLICY_ORIGIN } from "../../shared/constants";

export interface SessionFetchResult {
  status: number;
  url: string;
  text: string;
}

export async function fetchWithSession(url: string): Promise<SessionFetchResult> {
  const cookieHeader = await buildCookieHeader(url);

  try {
    const response = await net.fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "KU-Regulation-Assistant/0.1.0",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
    });

    const text = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new AppError("AUTH_EXPIRED");
    }
    if (!response.ok) {
      throw new AppError(response.status >= 500 ? "NETWORK_ERROR" : "UNKNOWN_API_ERROR");
    }
    if (looksLikeLoginPage(text, response.url)) {
      throw new AppError("AUTH_EXPIRED");
    }
    return { status: response.status, url: response.url, text };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("NETWORK_ERROR", error instanceof Error ? error.message : undefined);
  }
}

export function looksLikeLoginPage(html: string, url?: string): boolean {
  const lowerUrl = (url ?? "").toLowerCase();
  if (lowerUrl.includes("login")) return true;
  const compact = html.replace(/\s+/g, " ").toLowerCase();
  const hasPasswordInput = compact.includes('type="password"') || compact.includes("type='password'");
  const hasLoginForm = compact.includes("<form") && (compact.includes("login") || compact.includes("로그인"));
  return (
    (hasPasswordInput && (compact.includes("login") || compact.includes("로그인") || compact.includes("아이디"))) ||
    (hasLoginForm && (compact.includes("password") || compact.includes("비밀번호")))
  );
}

async function buildCookieHeader(url: string): Promise<string> {
  const cookies = await session.defaultSession.cookies.get({ url: KOREA_POLICY_ORIGIN });
  const targetCookies = await session.defaultSession.cookies.get({ url });
  const merged = new Map<string, string>();
  for (const cookie of [...cookies, ...targetCookies]) {
    merged.set(cookie.name, `${cookie.name}=${cookie.value}`);
  }
  return Array.from(merged.values()).join("; ");
}
