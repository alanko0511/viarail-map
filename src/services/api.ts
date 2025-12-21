import { hc } from "hono/client";
import type { AppType } from "../../worker";

export const api = hc<AppType>("/");
