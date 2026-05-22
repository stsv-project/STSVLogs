import { useQuery } from "@tanstack/react-query";
import { get } from "../api";

export default function Overview() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => get<{ status: string }>("/healthz"),
  });

  return (
    <div style={{ padding: 24 }}>
      <h1>STSVWB 遥测仪表盘</h1>
      <p>
        后端状态:{" "}
        {health.isLoading
          ? "检查中..."
          : health.data?.status === "ok"
            ? "✅ 正常"
            : "❌ 异常"}
      </p>
    </div>
  );
}
