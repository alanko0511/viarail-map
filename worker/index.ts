import { Hono } from "hono";
import { getViaRailData } from "./services/viaRailData";

const server = new Hono().get("/trainData", async (c) => {
  const data = await getViaRailData();

  return c.json({
    attribution: `Copyright © ${new Date().getFullYear()} VIA Rail Canada Inc.`,
    data,
  });
});

export default server;

export type AppType = typeof server;
