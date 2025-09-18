import * as nodewot from "@node-wot/core";
import type { RouteParams, RouterContext } from "jsr:@oak/oak/router";
import { getThingFromParams, setCorsAndType } from "./common.ts";
import type { AppState } from "./common.ts";

export default function eventRoute(
  ctx: RouterContext<
    "/:thing/events/:event",
    RouteParams<"/:thing/events/:event">,
    AppState
  >,
): void {
  const thing = getThingFromParams(ctx);
  const eventName = ctx.params.event;

  if (!thing) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Thing not found" };
    return;
  }
  if (!eventName) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Event name missing" };
    return;
  }

  setCorsAndType(ctx, nodewot.ContentSerdes.DEFAULT);

  // TODO: implement long-polling or SSE subscription
  ctx.response.status = 501;
  ctx.response.body = { error: "Event subscribe not implemented" };
}
