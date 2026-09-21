import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { mkdir } from "node:fs/promises";
await mkdir(".local", { recursive: true });
const db = await PGlite.create(".local/postgres");
const server = new PGLiteSocketServer({ db, port: 5433, host: "127.0.0.1" });
await server.start();
console.log("Local test database listening on 127.0.0.1:5433. No Google services connected.");
async function close() { await server.stop(); await db.close(); process.exit(0); }
process.on("SIGINT", close); process.on("SIGTERM", close);
