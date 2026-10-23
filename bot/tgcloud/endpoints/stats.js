// Сколько подписчиков (для владельца): `tgcloud run endpoints/stats '{}'`.
import { db } from "sdk";
import { eq } from "sdk/db";
import { subscribers } from "../schema.js";

export default async function stats() {
  return {
    total: await db.$count(subscribers),
    active: await db.$count(subscribers, eq(subscribers.active, true)),
  };
}
