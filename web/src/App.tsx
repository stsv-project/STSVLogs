import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { StatusBlock } from "./components/Dashboard";
import { cardsOverviewQueryKey, fetchCardsOverview } from "./pages/cardStatsQuery";
import { queryClient } from "./queryClient";

const Overview = lazy(() => import("./pages/Overview"));
const Diagnostics = lazy(() => import("./pages/Diagnostics"));
const Runs = lazy(() => import("./pages/Runs"));
const loadCardsPage = () => import("./pages/Cards");
const Cards = lazy(loadCardsPage);
const CardAnalysis = lazy(() => import("./pages/CardAnalysis"));
const Mods = lazy(() => import("./pages/Mods"));
const Admin = lazy(() => import("./pages/Admin"));

function Nav() {
  const location = useLocation();
  const linkClass = (path: string) => `nav-link${location.pathname === path ? " active" : ""}`;
  const cardsLinkClass = `nav-link${location.pathname === "/cards" || location.pathname.startsWith("/cards/") ? " active" : ""}`;
  const prefetchCards = () => {
    void loadCardsPage();
    void queryClient.prefetchQuery({
      queryKey: cardsOverviewQueryKey,
      queryFn: fetchCardsOverview,
      staleTime: 60_000,
    });
  };

  return (
    <nav className="top-nav">
      <div className="brand">STSVLogs</div>
      <Link to="/" className={linkClass("/")}>概览</Link>
      <Link to="/diagnostics" className={linkClass("/diagnostics")}>诊断</Link>
      <Link to="/runs" className={linkClass("/runs")}>对局</Link>
      <Link to="/cards" className={cardsLinkClass} onFocus={prefetchCards} onMouseEnter={prefetchCards}>卡牌</Link>
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
        <Suspense fallback={<StatusBlock>加载中...</StatusBlock>}>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/diagnostics" element={<Diagnostics />} />
            <Route path="/runs" element={<Runs />} />
            <Route path="/cards" element={<Cards />} />
            <Route path="/cards/:cardId" element={<CardAnalysis />} />
            <Route path="/mods" element={<Mods />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  );
}
