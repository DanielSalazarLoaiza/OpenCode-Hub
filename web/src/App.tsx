import { Navigate, Route, Routes } from "react-router";
import { Sidebar } from "./components/layout/Sidebar";
import { Topbar } from "./components/layout/Topbar";
import { CommandsPage } from "./features/commands/CommandsPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { ChatPage } from "./features/sessions/ChatPage";
import { SessionListPage } from "./features/sessions/SessionListPage";

export default function App() {
  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="min-h-0 flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/sessions" element={<SessionListPage />} />
            <Route path="/sessions/:id" element={<ChatPage />} />
            <Route path="/commands" element={<CommandsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
