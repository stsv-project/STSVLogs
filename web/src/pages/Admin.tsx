import { useState } from "react";
import { PageShell } from "../components/Dashboard";

export default function Admin() {
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [version, setVersion] = useState("");
  const [releasePage, setReleasePage] = useState("");
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error">("success");

  async function login() {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      setMessageKind("error");
      setMessage("密码错误");
      return;
    }
    const data = await res.json();
    setToken(data.token);
    setMessageKind("success");
    setMessage("登录成功");
    loadConfig();
  }

  async function loadConfig() {
    const res = await fetch("/api/config/version");
    const data = await res.json();
    setVersion(data.latest_version || "");
    setReleasePage(data.release_page_url || "");
  }

  async function save() {
    const res = await fetch("/api/config/version", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        latest_version: version,
        release_page: releasePage,
      }),
    });
    setMessageKind(res.ok ? "success" : "error");
    setMessage(res.ok ? "保存成功" : "保存失败");
  }

  if (!token) {
    return (
      <PageShell title="管理登录" subtitle="版本清单和发布页配置入口。">
        <section className="form-panel">
          {message && <p className={`message ${messageKind}`}>{message}</p>}
          <label className="field-label" htmlFor="admin-password">管理员密码</label>
          <input
            id="admin-password"
            className="input"
            type="password"
            placeholder="ADMIN_PASSWORD"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="button" onClick={login}>
            登录
          </button>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell title="版本管理" subtitle="更新 STSVWB 动态版本清单。">
      <section className="form-panel">
        {message && <p className={`message ${messageKind}`}>{message}</p>}
        <label className="field-label" htmlFor="latest-version">最新版本</label>
        <input
          id="latest-version"
          className="input"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
        />
        <label className="field-label" htmlFor="release-page">发布页链接</label>
        <input
          id="release-page"
          className="input"
          value={releasePage}
          onChange={(e) => setReleasePage(e.target.value)}
        />
        <button className="button" onClick={save}>
          保存
        </button>
      </section>
    </PageShell>
  );
}
