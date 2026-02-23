#!/usr/bin/env node
import "dotenv/config";
import { getDb } from "./client.js";
import { schema } from "./schema.js";

const db = getDb();
db.exec(schema);
console.log("Migration complete.");
