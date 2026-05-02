import type { BrowserWindow } from "electron";
import type { AuthStatus } from "../../shared/types";
import type { SessionManager } from "./session-manager";

export function openLoginWindow(parent: BrowserWindow, sessionManager: SessionManager): Promise<AuthStatus> {
  return sessionManager.openLoginWindow(parent);
}
