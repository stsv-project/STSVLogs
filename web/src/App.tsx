import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import Overview from "./pages/Overview";
import Diagnostics from "./pages/Diagnostics";
import Runs from "./pages/Runs";
import Mods from "./pages/Mods";
import Admin from "./pages/Admin";

function Nav() {
  const location = useLocation();
  const linkStyle = (path: string) => ({
    padding: "8px 16px",
    textDecoration: "none",
    color: location.pathname === path ? "#fff" : "#ccc",
    background: location.pathname === path ? "#555" : "transparent",
    borderRadius: 6,
    fontSize: 14,
  });

  return (
    <nav style={{
      display: "flex", gap: 8, padding: "10px 24px",
      background: "#333", alignItems: "center",
    }}>
      <Link to="/" style={linkStyle("/")}>概览</Link>
      <Link to="/diagnostics" style={linkStyle("/diagnostics")}>诊断</Link>
      <Link to="/runs" style={linkStyle("/runs")}>对局</Link>
      <Link to="/mods" style={linkStyle("/mods")}>模组</Link>
      <Link to="/admin" style={linkStyle("/admin")}>管理</Link>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/diagnostics" element={<Diagnostics />} />
        <Route path="/runs" element={<Runs />} />
        <Route path="/mods" element={<Mods />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}
