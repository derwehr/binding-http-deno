import * as nodewot from "@node-wot/core";
import type { RouteParams, RouterContext } from "jsr:@oak/oak/router";
import { getThingFromParams, isEmpty, setCorsAndType } from "./common.ts";
import type { AppState } from "./common.ts";

const { error, warn } = nodewot.createLoggers(
  "binding-http",
  "routes",
  "property",
);

export default async function propertyRoute(
  ctx: RouterContext<
    "/:thing/properties/:property",
    RouteParams<"/:thing/properties/:property">,
    AppState
  >,
): Promise<void> {
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
  const property = thing.properties[ctx.params.property];

  if (property == null) {
    ctx.response.status = 404;
    ctx.response.body = { error: `Property '${propName}' not found` };
    return;
  }

  const options: WoT.InteractionOptions & { formIndex: number } = {
    formIndex: nodewot.default.ProtocolHelpers.findRequestMatchingFormIndex(
      property.forms,
      "http",
      ctx.request.url.toString(),
      contentType,
    ),
  };
  const uriVariables = nodewot.default.Helpers.parseUrlParameters(
    ctx.request.url.toString(),
    thing.uriVariables,
    property.uriVariables,
  );
  if (!isEmpty(uriVariables)) {
    options.uriVariables = uriVariables;
  }

  if (ctx.request.method === "GET") {
    // try {
    const content = await thing.handleReadProperty(
      ctx.params.property,
      options,
    );
    ctx.response.headers.set("Content-Type", content.type);
    ctx.response.status = 200;
    ctx.response.body = content.body;
    return;
    // } catch (err) {
    //   const message = (err instanceof Error)
    //     ? err.message
    //     : JSON.stringify(err);

    //   error(`Exception during property write: ${message}`);
    //   ctx.response.status = 500;
    //   ctx.response.body = {
    //     error: `Exception during property write: ${message}`,
    //   };
    //   return;
    // }
  }

  if (ctx.request.method === "PUT") {
    const readOnly: boolean = property.readOnly ?? false;
    if (readOnly) {
      ctx.response.status = 403;
      ctx.response.body = { error: `Property '${propName}' is readOnly` };
      return;
    }

    try {
      await thing.handleWriteProperty(
        ctx.params.property,
        new nodewot.Content(
          contentType,
          nodewot.default.ProtocolHelpers.toNodeStream(
            ctx.request.body.stream,
          ) ?? null,
        ),
        options,
      );
      ctx.response.status = 204;
      return;
    } catch (err) {
      const message = (err instanceof Error)
        ? err.message
        : JSON.stringify(err);

      error(`Exception during property write: ${message}`);
      ctx.response.status = 500;
      ctx.response.body = {
        error: `Exception during property write: ${message}`,
      };
      return;
    }
  }

  ctx.response.status = 405;
}
