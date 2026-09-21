import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env, setting } from "./config";
import { databaseOptions } from "./database-options";

const globalDb = globalThis as unknown as { sjDb?: PrismaClient };
export function db() {
  if (!globalDb.sjDb) globalDb.sjDb = new PrismaClient({ adapter: new PrismaPg({ ...databaseOptions(env("DATABASE_URL")), max: setting("DB_POOL_SIZE", 5, 20) }), log: [] });
  return globalDb.sjDb;
}
