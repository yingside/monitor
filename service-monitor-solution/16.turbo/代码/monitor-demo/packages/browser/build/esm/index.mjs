import {
  Errors
} from "./chunk-V2R2QOUA.mjs";
import {
  BrowserTransport
} from "./chunk-YEZKAGLB.mjs";

// src/index.ts
import { Monitor } from "@duyi/monitor-sdk-core";
import { Metrics } from "@duyi/monitor-sdk-browser-utils";
var init = (options) => {
  const monitor = new Monitor(options);
  const transport = new BrowserTransport(options.dsn);
  monitor.init(transport);
  new Errors(transport).init();
  new Metrics(transport).init();
  return monitor;
};
export {
  init
};
