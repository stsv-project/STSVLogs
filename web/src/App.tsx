import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import Overview from "./pages/Overview";
import Diagnostics from "./pages/Diagnostics";
import Runs from "./pages/Runs";
import Cards from "./pages/Cards";
import CardAnalysis from "./pages/CardAnalysis";
import Mods from "./pages/Mods";
import Admin from "./pages/Admin";

function Nav() {
  const location = useLocation();
  const linkClass = (path: string) => `nav-link${location.pathname === path ? " active" : ""}`;
  const cardsLinkClass = `nav-link${location.pathname === "/cards" || location.pathname.startsWith("/cards/") ? " active" : ""}`;

  return (
    <nav className="top-nav">
      <div className="brand">STSVLogs</div>
      <Link to="/" className={linkClass("/")}>概览</Link>
      <Link to="/diagnostics" className={linkClass("/diagnostics")}>诊断</Link>
      <Link to="/runs" className={linkClass("/runs")}>对局</Link>
      <Link to="/cards" className={cardsLinkClass}>卡牌</Link>
      <Link to="/mods" className={linkClass("/mods")}>模组</Link>
      <Link to="/admin" className={linkClass("/admin")}>管理</Link>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Nav />
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/diagnostics" element={<Diagnostics />} />
          <Route path="/runs" element={<Runs />} />
          <Route path="/cards" element={<Cards />} />
          <Route path="/cards/:cardId" element={<CardAnalysis />} />
          <Route path="/mods" element={<Mods />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
