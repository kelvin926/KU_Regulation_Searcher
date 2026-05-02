import { BrowserWindow, shell } from "electron";
import path from "node:path";
import { APP_NAME } from "../shared/constants";

export function createMainWindow(): BrowserWindow {
  const iconPath = process.env.VITE_DEV_SERVER_URL
    ? path.join(process.cwd(), "build", "icon.png")
    : path.join(process.resourcesPath, "icon.png");

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1040,
    minHeight: 720,
    title: APP_NAME,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  return mainWindow;
}
