import * as nodewot from "@node-wot/core";
import type { RouteParams, RouterContext } from "jsr:@oak/oak/router";
import { getThingFromParams, setCorsAndType } from "./common.ts";
import { type AppState, isEmpty } from "./common.ts";

const { error, warn } = nodewot.createLoggers(
  "binding-http",
  "routes",
  "action",
);

export default async function actionRoute(
  ctx: RouterContext<
    "/:thing/actions/:action",
    RouteParams<"/:thing/actions/:action">,
    AppState
  >,
): Promise<void> {
  const thing = getThingFromParams(ctx);
  const actionName = ctx.params.action;

  if (!thing) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Thing not found" };
    return;
  }
  if (!actionName) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Action name missing" };
    return;
  }

  const contentType = ctx.request.headers.get("Content-Type") ??
    nodewot.ContentSerdes.DEFAULT;

  if (ctx.request.method === "PUT" || ctx.request.method === "POST") {
    if (!ctx.request.headers.get("Content-Type")) {
      if (ctx.request.hasBody) {
        ctx.response.status = 400;
        ctx.response.body = { error: "Content-Type header missing" };
        return;
      } // else: no body, no Content-Type -> valid
    } else if (
      nodewot.ContentSerdes.get().getSupportedMediaTypes().indexOf(
        nodewot.ContentSerdes.getMediaType(contentType),
      ) < 0
    ) {
      warn(`Unsupported Content-Type ${contentType}`);
      ctx.response.status = 415;
      ctx.response.body = { error: `Unsupported Content-Type ${contentType}` };
      return;
    }
  }

  const action = thing.actions?.[ctx.params.action];

  if (!action) {
    ctx.response.status = 404;
    ctx.response.body = { error: `Action '${actionName}' not found` };
    return;
  }

  setCorsAndType(ctx, nodewot.ContentSerdes.DEFAULT);

  if (ctx.request.method === "POST") {
    const options: WoT.InteractionOptions & { formIndex: number } = {
      formIndex: nodewot.default.ProtocolHelpers.findRequestMatchingFormIndex(
        action.forms,
        ctx.request.url.toString(),
        contentType,
      ),
    };
    const uriVariables = nodewot.default.Helpers.parseUrlParameters(
      ctx.request.url.toString(),
      thing.uriVariables,
      action.uriVariables,
    );
    if (!isEmpty(uriVariables)) {
      options.uriVariables = uriVariables;
    }
    try {
      const output = await thing.handleInvokeAction(
        ctx.params.action,
        new nodewot.Content(
          contentType,
          nodewot.default.ProtocolHelpers.toNodeStream(
            ctx.request.body.stream,
          ) ?? null,
        ),
        options,
      );
      if (output) {
        ctx.response.status = 200;
        ctx.response.body = output.body;
        if (output.type) {
          ctx.response.headers.set("Content-Type", output.type);
        }
      } else {
        ctx.response.status = 204;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : JSON.stringify(err);
      error(`Error invoking action '${actionName}': ${message}`);
      ctx.response.status = 500;
      ctx.response.body = {
        error: `Error invoking action '${actionName}': ${message}`,
      };
      return;
    }
  }

  const input = ctx.request.hasBody ? await ctx.request.body.json() : undefined;

  // TODO: integrate with ExposedThing action invocation
  ctx.response.status = 501;
  ctx.response.body = { error: "Invoke action not implemented", input };
}
