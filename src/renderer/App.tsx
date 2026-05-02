import {
  Bot,
  Database,
  KeyRound,
  LogIn,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { LoginPage } from "./pages/LoginPage";
import { SyncPage } from "./pages/SyncPage";
import { AiSettingsPage } from "./pages/AiSettingsPage";
import { AskPage } from "./pages/AskPage";
import { SearchPage } from "./pages/SearchPage";
import { DataPage } from "./pages/DataPage";

type PageId = "login" | "sync" | "ai" | "ask" | "search" | "data";

const NAV_ITEMS = [
  { id: "login", label: "로그인", icon: LogIn },
  { id: "sync", label: "동기화", icon: RefreshCw },
  { id: "ai", label: "AI 설정", icon: KeyRound },
  { id: "ask", label: "규정 질의", icon: Bot },
  { id: "search", label: "규정 검색", icon: Search },
  { id: "data", label: "데이터", icon: Database },
] as const;

export default function App() {
  const [page, setPage] = useState<PageId>("login");

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <ShieldCheck size={24} />
          <div>
            <strong>KU Regulation</strong>
            <span>Assistant</span>
          </div>
        </div>
        <nav>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={page === item.id ? "active" : ""}
                onClick={() => setPage(item.id)}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>
      <main className="content">
        {page === "login" && <LoginPage />}
        {page === "sync" && <SyncPage />}
        {page === "ai" && <AiSettingsPage />}
        {page === "ask" && <AskPage />}
        {page === "search" && <SearchPage />}
        {page === "data" && <DataPage />}
      </main>
    </div>
  );
}
