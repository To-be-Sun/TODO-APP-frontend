import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker本番ビルド用にスタンドアロン出力を有効化
  output: "standalone",
};

export default nextConfig;
