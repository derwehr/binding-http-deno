import { Form } from "@node-wot/core";

export interface HttpConfig {
  port?: number;
  address?: string;
}

export type HTTPMethodName =
  | "GET"
  | "PUT"
  | "POST"
  | "DELETE"
  | "PATCH"
  | "HEAD";

export class HttpHeader {
  public "htv:fieldName": string;
  public "htv:fieldValue": string;
}

export class HttpForm extends Form {
  public "htv:methodName"?: HTTPMethodName;
  public "htv:headers"?: Array<HttpHeader> | HttpHeader;
}
