import * as nodewot from "@node-wot/core";
import type { RouteParams, RouterContext } from "jsr:@oak/oak/router";
import { getThingFromParams, setCorsAndType } from "./common.ts";
import type { AppState } from "./common.ts";

export default function propertyObserveRoute(
  ctx: RouterContext<
    "/:thing/properties/:property/observable",
    RouteParams<"/:thing/properties/:property/observable">,
    AppState
  >,
): void {
  const thing = getThingFromParams(ctx);
  const propName = ctx.params.property;

  if (!thing) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Thing not found" };
    return;
  }
  if (!propName) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Property name missing" };
    return;
  }

  setCorsAndType(ctx, nodewot.ContentSerdes.DEFAULT);

  // TODO: implement long-poll or SSE observation
  ctx.response.status = 501;
  ctx.response.body = { error: "Observe property not implemented" };
}
