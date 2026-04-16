import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState } from "react";

import Home from "./pages/Home";
import Writeups from "./pages/Writeups";
import WriteupDetail from "./pages/WriteupDetail";
import Notes from "./pages/Notes";

import Navbar from "./components/layout/Navbar";
import Sidebar from "./components/layout/Sidebar";
import CommandPalette from "./components/ui/CommandPalette";

import "./styles/global.css";

/* ────────────────────────────────────────────────────────────
   AppLayout — sidebar + main content for inner pages
   Manages mobile sidebar open/close state locally
   ──────────────────────────────────────────────────────────── */
function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      <main className="app-content">{children}</main>

      {/* Mobile FAB to open sidebar */}
      <button
        className="mobile-sidebar-fab"
        onClick={() => setMobileSidebarOpen(true)}
        aria-label="Open navigation"
        title="Open sidebar"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="16" y2="12" />
          <line x1="3" y1="18" x2="11" y2="18" />
        </svg>
      </button>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   App — BrowserRouter + global CommandPalette mounted once
   ──────────────────────────────────────────────────────────── */
export default function App() {
  return (
    <BrowserRouter>
      {/* CommandPalette is self-contained: listens for Ctrl+K and
          the custom "open-command-palette" event from Navbar */}
      <CommandPalette />

      {/* Navbar is always visible */}
      <Navbar />

      <Routes>
        {/* Home — full-width, no sidebar */}
        <Route path="/" element={<Home />} />

        {/* Writeups list */}
        <Route
          path="/writeups"
          element={
            <AppLayout>
              <Writeups />
            </AppLayout>
          }
        />

        {/* Writeup detail */}
        <Route
          path="/writeups/*"
          element={
            <AppLayout>
              <WriteupDetail />
            </AppLayout>
          }
        />

        {/* Notes list */}
        <Route
          path="/notes"
          element={
            <AppLayout>
              <Notes />
            </AppLayout>
          }
        />

        {/* Note detail */}
        <Route
          path="/notes/*"
          element={
            <AppLayout>
              <WriteupDetail />
            </AppLayout>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}