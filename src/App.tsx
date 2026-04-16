import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Writeups from "./pages/Writeups";
import WriteupDetail from "./pages/WriteupDetail";
import Notes from "./pages/Notes";

import Navbar from "./components/layout/Navbar";
import Sidebar from "./components/layout/Sidebar";

import "./styles/global.css";

/* Layout with sidebar — used for inner pages */
function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-content">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
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

        {/* Writeup detail (wildcard) */}
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

        {/* Note detail (wildcard) */}
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