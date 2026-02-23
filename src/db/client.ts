import Database from "better-sqlite3";
import { config } from "../config.js";
import { schema } from "./schema.js";
import { mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

let db: Database.Database | null = null;

const MIGRATIONS = [
  `ALTER TABLE entity_advertisers ADD COLUMN updated_at INTEGER DEFAULT 0`,
];

export function getDb(): Database.Database {
  if (!db) {
    const dir = dirname(config.dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    db = new Database(config.dbPath);
    db.exec(schema);
    for (const sql of MIGRATIONS) {
      try {
        db.exec(sql);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("duplicate column name")) throw e;
      }
    }
  }
  return db;
}
