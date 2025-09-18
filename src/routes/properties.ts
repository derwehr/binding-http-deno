import * as nodewot from "@node-wot/core";
import type { RouteParams, RouterContext } from "jsr:@oak/oak/router";
import { getThingFromParams, setCorsAndType } from "./common.ts";
import type { AppState } from "./common.ts";

export default function propertiesRoute(
  ctx: RouterContext<
    "/:thing/properties/",
    RouteParams<"/:thing/properties/">,
    AppState
  >,
): void {
  const thing = getThingFromParams(ctx);

  if (!thing) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Thing not found" };
    return;
  }

  setCorsAndType(ctx, nodewot.ContentSerdes.DEFAULT);

  // Only expose names here; adapt if you also want values.
  // ExposedThing type has a `properties` index, but its exact shape is not public API across versions.
  const propNames = Object.keys(
    (thing as Record<string, unknown>).properties ?? {},
  );
  ctx.response.status = 200;
  ctx.response.body = { properties: propNames };
}
