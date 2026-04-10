import esbuild from "esbuild"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const config = {
  entryPoints: [path.resolve(__dirname, "src/index.ts")],
  bundle: true,
  minify: true,
  platform: "node",
  outfile: path.resolve(__dirname, "dist/index.cjs"),
  sourcemap: true,
  format: "cjs",
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  alias: {
    "@rahoot/socket": path.resolve(__dirname, "./src"),
    "@rahoot/common": path.resolve(__dirname, "../common/src"),
  },
  external: [
    "express",
    "cors",
    "mongoose",
    "socket.io",
    "dayjs",
    "uuid",
    "zod",
    "path",
    "http",
    "os",
    "fs",
    "fs/promises",
    "child_process",
    "url",
  ],
}

esbuild.build(config).catch((err) => {
  console.error("Build failed:", err)
  process.exit(1)
})
