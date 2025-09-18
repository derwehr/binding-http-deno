/**
 * HTTP Server based on Deno's native HTTP server
 */

import * as nodewot from "@node-wot/core";
import type { HttpConfig, HttpForm } from "./http.ts";
import { Application } from "jsr:@oak/oak/application";
import { Router } from "jsr:@oak/oak/router";
import { slugify } from "https://deno.land/x/slugify/mod.ts";
import thingsRoute from "./routes/things.ts";
import thingDescriptionRoute from "./routes/thing-description.ts";
import propertyRoute from "./routes/property.ts";
import actionRoute from "./routes/action.ts";
import eventRoute from "./routes/event.ts";
import propertiesRoute from "./routes/properties.ts";
import propertyObserveRoute from "./routes/property-observe.ts";
import type {
  ActionElement,
  EventElement,
  PropertyElement,
} from "wot-thing-description-types";
import type { AppState } from "./routes/common.ts";

const { debug, info, warn, error } = nodewot.createLoggers(
  "binding-http",
  "http-server-deno",
);

export default class HttpServer implements nodewot.ProtocolServer {
  public readonly scheme: string = "http";

  private readonly PROPERTY_DIR = "properties";
  private readonly ACTION_DIR = "actions";
  private readonly EVENT_DIR = "events";

  private readonly OBSERVABLE_DIR = "observable";

  private server?: Application<AppState>;
  private router?: Router<AppState>;
  private readonly port: number;
  private readonly address?: string;
  private readonly urlRewrite?: Record<string, string>;
  private readonly supportedSecuritySchemes: string[] = ["nosec"];

  private readonly things: Map<string, nodewot.ExposedThing> = new Map<
    string,
    nodewot.ExposedThing
  >();

  constructor(config: HttpConfig = {}) {
    if (typeof config !== "object") {
      throw new Error(
        `HttpServer requires config object (got ${typeof config})`,
      );
    }

    this.port = config.port ?? 8080;
    this.address = config.address;

    debug(`HttpServer starting on ${this.address ?? "undefined"}:${this.port}`);

    this.server = new Application<AppState>();
    this.router = new Router<AppState>();

    this.router.get("/", thingsRoute);
    this.router.get("/:thing", thingDescriptionRoute);
    this.router.get(`/:thing/${this.PROPERTY_DIR}/`, propertiesRoute);
    this.router.get(`/:thing/${this.PROPERTY_DIR}/:property`, propertyRoute);
    this.router.put(`/:thing/${this.PROPERTY_DIR}/:property`, propertyRoute);
    this.router.get(
      `/:thing/${this.PROPERTY_DIR}/:property/${this.OBSERVABLE_DIR}`,
      propertyObserveRoute,
    );
    this.router.post(`/:thing/${this.ACTION_DIR}/:action`, actionRoute);
    this.router.get(`/:thing/${this.EVENT_DIR}/:event`, eventRoute);

    this.server.use(async (ctx, next) => {
      ctx.state.getThings = this.getThings.bind(this);
      await next();
    });

    this.server.use(this.router.routes());
    this.server.use(this.router.allowedMethods());
  }

  public start(): Promise<void> {
    if (!this.server) {
      return Promise.reject(new Error("HttpServer not properly initialized"));
    }

    this.server?.listen({ port: this.port, hostname: this.address })
      .then(() => {
        info(`HttpServer listening on port ${this.port}`);
      })
      .catch((err) => {
        error(
          `HttpServer failed to start on port ${this.port}: ${err.message}`,
        );
      });

    return Promise.resolve();
  }

  public stop(): Promise<void> {
    return Promise.resolve();
  }

  public getThings(): Map<string, nodewot.ExposedThing> {
    return this.things;
  }

  public getPort(): number {
    return this.port;
  }

  public async expose(
    thing: nodewot.ExposedThing,
    tdTemplate: WoT.ExposedThingInit = {},
  ): Promise<void> {
    let urlPath = slugify(thing.title, { lower: true });

    if (this.things.has(urlPath)) {
      // ensure unique URL path per thing
      let i = 2;
      while (this.things.has(`${urlPath}-${i}`)) {
        i++;
      }
      urlPath = `${urlPath}-${i}`;
    }

    thing.securityDefinitions = {
      [this.supportedSecuritySchemes[0]]: {
        scheme: this.supportedSecuritySchemes[0],
      },
    };
    thing.security = [this.supportedSecuritySchemes[0]];

    debug(`HttpServer exposing '${thing.title}' as '${urlPath}'`);
    this.things.set(urlPath, thing);

    for (const address of nodewot.default.Helpers.getAddresses()) {
      const base: string = `${this.scheme}://${address}:${this.port}/${
        encodeURIComponent(urlPath)
      }`;
      this.addEndpoint(thing, tdTemplate, base);
    }
  }

  public async destroy(thingId: string): Promise<boolean> {
    debug(
      `HttpServer on port ${this.port} destroying thingId '${thingId}'`,
    );

    for (const [name, thing] of this.things.entries()) {
      if (thing.id === thingId) {
        this.things.delete(name);
        info(`HttpServer successfully destroyed '${thing.title}'`);

        return true;
      }
    }

    info(`HttpServer failed to destroy thing with thingId '${thingId}'`);
    return false;
  }

  private addUrlRewriteEndpoints(
    form: nodewot.Form,
    forms: Array<nodewot.Form>,
  ): void {
    if (this.urlRewrite != null) {
      for (const [inUri, toUri] of Object.entries(this.urlRewrite)) {
        const endsWithToUri: boolean = form.href.endsWith(toUri);
        if (endsWithToUri) {
          const form2 = nodewot.default.Helpers.structuredClone(form);
          form2.href = form2.href.substring(0, form.href.lastIndexOf(toUri)) +
            inUri;
          forms.push(form2);
          debug(
            `HttpServer on port ${this.port} assigns urlRewrite '${form2.href}' for '${form.href}'`,
          );
        }
      }
    }
  }

  public addEndpoint(
    thing: nodewot.ExposedThing,
    tdTemplate: WoT.ExposedThingInit,
    base: string,
  ): void {
    for (const type of nodewot.ContentSerdes.get().getOfferedMediaTypes()) {
      const properties = Object.values(thing.properties);

      let allReadOnly = true;
      let allWriteOnly = true;

      for (const property of properties) {
        const readOnly: boolean = property.readOnly ?? false;
        if (!readOnly) {
          allReadOnly = false;
        }

        const writeOnly: boolean = property.writeOnly ?? false;
        if (!writeOnly) {
          allWriteOnly = false;
        }
      }

      if (properties.length > 0) {
        const href = `${base}/${this.PROPERTY_DIR}/`;
        const form = new nodewot.Form(href, type);
        if (allReadOnly && !allWriteOnly) {
          form.op = ["readallproperties", "readmultipleproperties"];
        } else if (allWriteOnly && !allReadOnly) {
          form.op = ["writeallproperties", "writemultipleproperties"];
        } else {
          form.op = [
            "readallproperties",
            "readmultipleproperties",
            "writeallproperties",
            "writemultipleproperties",
          ];
        }
        if (thing.forms == null) {
          thing.forms = [];
        }
        thing.forms.push(form);
        this.addUrlRewriteEndpoints(form, thing.forms);
      }

      for (const [propertyName, property] of Object.entries(thing.properties)) {
        const propertyNamePattern = nodewot.default.Helpers
          .updateInteractionNameWithUriVariablePattern(
            propertyName,
            property.uriVariables,
            thing.uriVariables,
          );
        const href = base + "/" + this.PROPERTY_DIR + "/" + propertyNamePattern;
        const form = new nodewot.Form(href, type);
        nodewot.default.ProtocolHelpers.updatePropertyFormWithTemplate(
          form,
          (tdTemplate.properties?.[propertyName] ?? {}) as PropertyElement,
        );

        const readOnly: boolean = property.readOnly ?? false;
        const writeOnly: boolean = property.writeOnly ?? false;

        if (readOnly) {
          form.op = ["readproperty"];
          const hform: HttpForm = form;
          hform["htv:methodName"] ??= "GET";
        } else if (writeOnly) {
          form.op = ["writeproperty"];
          const hform: HttpForm = form;
          hform["htv:methodName"] ??= "PUT";
        } else {
          form.op = ["readproperty", "writeproperty"];
        }

        property.forms.push(form);
        debug(
          `HttpServer on port ${this.port} assigns '${href}' to Property '${propertyName}'`,
        );
        this.addUrlRewriteEndpoints(form, property.forms);

        // if property is observable add an additional form with a observable href
        if (property.observable === true) {
          const href = base +
            "/" +
            this.PROPERTY_DIR +
            "/" +
            encodeURIComponent(propertyName) +
            "/" +
            this.OBSERVABLE_DIR;
          const form = new nodewot.Form(href, type);
          form.op = ["observeproperty", "unobserveproperty"];
          form.subprotocol = "longpoll";
          property.forms.push(form);
          debug(
            `HttpServer on port ${this.port} assigns '${href}' to observable Property '${propertyName}'`,
          );
          this.addUrlRewriteEndpoints(form, property.forms);
        }
      }

      for (const [actionName, action] of Object.entries(thing.actions)) {
        const actionNamePattern = nodewot.default.Helpers
          .updateInteractionNameWithUriVariablePattern(
            actionName,
            action.uriVariables,
            thing.uriVariables,
          );
        const href = base + "/" + this.ACTION_DIR + "/" + actionNamePattern;
        const form = new nodewot.Form(href, type);
        nodewot.default.ProtocolHelpers.updateActionFormWithTemplate(
          form,
          (tdTemplate.actions?.[actionName] ?? {}) as ActionElement,
        );
        form.op = ["invokeaction"];
        const hform: HttpForm = form;

        hform["htv:methodName"] ??= "POST";
        action.forms.push(form);
        debug(
          `HttpServer on port ${this.port} assigns '${href}' to Action '${actionName}'`,
        );
        this.addUrlRewriteEndpoints(form, action.forms);
      }

      for (const [eventName, event] of Object.entries(thing.events)) {
        const eventNamePattern = nodewot.default.Helpers
          .updateInteractionNameWithUriVariablePattern(
            eventName,
            event.uriVariables,
            thing.uriVariables,
          );
        const href = base + "/" + this.EVENT_DIR + "/" + eventNamePattern;
        const form = new nodewot.Form(href, type);
        nodewot.default.ProtocolHelpers.updateEventFormWithTemplate(
          form,
          (tdTemplate.events?.[eventName] ?? {}) as EventElement,
        );
        form.subprotocol = "longpoll";
        form.op = ["subscribeevent", "unsubscribeevent"];
        event.forms.push(form);
        debug(
          `HttpServer on port ${this.port} assigns '${href}' to Event '${eventName}'`,
        );
        this.addUrlRewriteEndpoints(form, event.forms);
      }
    }
  }
}
