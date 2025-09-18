import * as nodewot from "@node-wot/core";
import type { RouteParams, RouterContext } from "jsr:@oak/oak/router";
import { setCorsAndType } from "./common.ts";
import type { AppState } from "./common.ts";

export default function thingsRoute(
  ctx: RouterContext<"/", RouteParams<"/">, AppState>,
): void {
  setCorsAndType(ctx, nodewot.ContentSerdes.DEFAULT);

  const url = ctx.request.url;
  const scheme = url.protocol.replace(":", "") || "http";
  const port = url.port || (scheme === "https" ? "443" : "8080");

  const list: string[] = [];
  for (const address of nodewot.default.Helpers.getAddresses()) {
    for (const name of ctx.state.getThings().keys()) {
      if (name) {
        list.push(
          `${scheme}://${
            nodewot.default.Helpers.toUriLiteral(address)
          }:${port}/${encodeURIComponent(name)}`,
        );
      }
    }
  }

  ctx.response.status = 200;
  ctx.response.body = list;
}
