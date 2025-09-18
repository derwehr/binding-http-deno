import * as nodewot from "@node-wot/core";
import type { RouteParams, RouterContext } from "jsr:@oak/oak/router";
import { getThingFromParams, setCorsAndType } from "./common.ts";
import type { AppState } from "./common.ts";

export default function thingDescriptionRoute(
  ctx: RouterContext<"/:thing", RouteParams<"/:thing">, AppState>,
): void {
  const thing = getThingFromParams(ctx);

  if (!thing) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Thing not found" };
    return;
  }

  setCorsAndType(ctx, nodewot.ContentSerdes.TD);

  ctx.response.status = 200;
  ctx.response.body = thing;
}
