import worker from "../cloudflare/src/index";
import type { Env } from "../cloudflare/src/types";

export const onRequest: PagesFunction = async (context) => {
  return worker.fetch(context.request, context.env as unknown as Env);
};
