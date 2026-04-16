import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Writeups from "./pages/Writeups";
import WriteupDetail from "./pages/WriteupDetail";
import Notes from "./pages/Notes";

import Navbar from "./components/layout/Navbar";
import Sidebar from "./components/layout/Sidebar";

import "./styles/global.css";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <Navbar />

      <div className="main">
        <Sidebar />
        <div className="content">{children}</div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Home */}
        <Route
          path="/"
          element={
            <Layout>
              <Home />
            </Layout>
          }
        />

        {/* Writeups list */}
        <Route
          path="/writeups"
          element={
            <Layout>
              <Writeups />
            </Layout>
          }
        />

        {/* Writeup detail (IMPORTANT: wildcard) */}
        <Route
          path="/writeups/*"
          element={
            <Layout>
              <WriteupDetail />
            </Layout>
          }
        />

        {/* Notes */}
        <Route
          path="/notes"
          element={
            <Layout>
              <Notes />
            </Layout>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}