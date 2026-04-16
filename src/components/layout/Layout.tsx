import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
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