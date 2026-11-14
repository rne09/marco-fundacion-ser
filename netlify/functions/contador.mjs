import { getStore } from "@netlify/blobs";

// GET  -> { total }
// POST -> suma 1 y devuelve { total }
export default async (req) => {
  const store = getStore({ name: "contador", consistency: "strong" });
  let total = Number(await store.get("total")) || 0;
  if (req.method === "POST") {
    total += 1;
    await store.set("total", String(total));
  }
  return Response.json({ total }, { headers: { "cache-control": "no-store" } });
};

export const config = { path: "/api/contador" };
