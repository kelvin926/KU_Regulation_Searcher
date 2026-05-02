import { net, session } from "electron";
import { AppError } from "../../shared/errors";
import { KOREA_POLICY_ORIGIN } from "../../shared/constants";

export interface SessionFetchResult {
  status: number;
  url: string;
  text: string;
}

export interface SessionBinaryFetchResult {
  status: number;
  url: string;
  headers: Headers;
  arrayBuffer: ArrayBuffer;
}

export interface SessionFetchOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: BodyInit;
}

export async function fetchWithSession(url: string, options: SessionFetchOptions = {}): Promise<SessionFetchResult> {
  const response = await requestWithSession(url, options);
  const text = await response.text();
  if (looksLikeLoginPage(text, response.url)) {
    throw new AppError("AUTH_EXPIRED");
  }
  return { status: response.status, url: response.url, text };
}

export async function fetchBinaryWithSession(
  url: string,
  options: SessionFetchOptions = {},
): Promise<SessionBinaryFetchResult> {
  const response = await requestWithSession(url, options);
  const arrayBuffer = await response.arrayBuffer();
  return { status: response.status, url: response.url, headers: response.headers, arrayBuffer };
}

async function requestWithSession(url: string, options: SessionFetchOptions): Promise<Response> {
  const cookieHeader = await buildCookieHeader(url);

  try {
    const response = await net.fetch(url, {
      method: options.method ?? "GET",
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "KU-Regulation-Searcher/0.4.0",
        ...(options.headers ?? {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: options.body,
    });

    if (response.status === 401 || response.status === 403) {
      throw new AppError("AUTH_EXPIRED");
    }
    if (!response.ok) {
      throw new AppError(response.status >= 500 ? "NETWORK_ERROR" : "UNKNOWN_API_ERROR");
    }
    return response;
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
