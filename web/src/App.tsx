import { BrowserRouter, Routes, Route } from "react-router-dom";
import Overview from "./pages/Overview";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Overview />} />
      </Routes>
    </BrowserRouter>
  );
}