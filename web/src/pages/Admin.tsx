import { useState } from "react";

export default function Admin() {
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [version, setVersion] = useState("");
  const [releasePage, setReleasePage] = useState("");
  const [message, setMessage] = useState("");

  // 登录
  async function login() {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      setMessage("密码错误");
      return;
    }
    const data = await res.json();
    setToken(data.token);
    setMessage("登录成功");
    loadConfig();
  }

  // 加载当前配置
  async function loadConfig() {
    const res = await fetch("/api/config/version");
    const data = await res.json();
    setVersion(data.latest_version || "");
    setReleasePage(data.release_page_url || "");
  }

  // 保存
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
    if (res.ok) setMessage("保存成功");
    else setMessage("保存失败");
  }

  if (!token) {
    return (
      <div style={{ padding: 24, maxWidth: 400 }}>
        <h1>管理登录</h1>
        <input
          type="password"
          placeholder="管理员密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 8 }}
        />
        <button onClick={login} style={{ padding: "8px 16px" }}>
          登录
        </button>
        {message && <p style={{ color: "red" }}>{message}</p>}
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 400 }}>
      <h1>版本管理</h1>
      {message && <p style={{ color: "green" }}>{message}</p>}
      <label>最新版本</label>
      <input
        value={version}
        onChange={(e) => setVersion(e.target.value)}
        style={{ width: "100%", padding: 8, marginBottom: 8 }}
      />
      <label>发布页链接</label>
      <input
        value={releasePage}
        onChange={(e) => setReleasePage(e.target.value)}
        style={{ width: "100%", padding: 8, marginBottom: 16 }}
      />
      <button onClick={save} style={{ padding: "8px 24px" }}>
        保存
      </button>
    </div>
  );
}
