import * as nodewot from "@node-wot/core";
import { State } from "jsr:@oak/oak/application";
import type { RouteParams, RouterContext } from "jsr:@oak/oak/router";

export type AppState = { getThings: () => Map<string, nodewot.ExposedThing> };

export function getThingFromParams<
  R extends string,
  P extends RouteParams<R> & { thing?: string },
  S extends AppState,
>(ctx: RouterContext<R, P, S>): nodewot.ExposedThing | undefined {
  const name = ctx.params.thing ?? "";
  return (
    ctx.state.getThings().get(name) ??
      ctx.state.getThings().get(decodeURIComponent(name))
  );
}

export function setCorsAndType<
  R extends string,
  P extends RouteParams<R>,
  S extends State,
>(ctx: RouterContext<R, P, S>, contentType: string): void {
  ctx.response.headers.set("Access-Control-Allow-Origin", "*");
  ctx.response.headers.set(
    "Access-Control-Allow-Methods",
    "GET,PUT,POST,OPTIONS",
  );
  ctx.response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type,Accept",
  );
  ctx.response.type = contentType;
}

export function isEmpty(obj: Record<string, unknown>): boolean {
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) return false;
  }
  return true;
}
