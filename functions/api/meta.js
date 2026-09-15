import { ITEM_GROUPS } from "../_shared/report.js";

export function onRequestGet() {
  return Response.json({ items: ITEM_GROUPS });
}
