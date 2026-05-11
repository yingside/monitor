var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  init: () => init
});
module.exports = __toCommonJS(index_exports);
var import_monitor_sdk_core = require("@duyi/monitor-sdk-core");
var import_monitor_sdk_browser_utils = require("@duyi/monitor-sdk-browser-utils");

// src/transport/index.ts
var BrowserTransport = class {
  constructor(dsn) {
    this.dsn = dsn;
  }
  send(data) {
    const payload = {
      ...data
      // 其他需要添加的数据
    };
    fetch(this.dsn, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json"
      }
    }).catch((error) => {
      console.error("\u4E0A\u62A5\u5931\u8D25:", error);
    });
  }
};

// src/tracing/errors.ts
var Errors = class {
  constructor(transport) {
    this.transport = transport;
  }
  init() {
    window.onerror = (message, source, lineno, colno, error) => {
      this.transport.send({
        event_type: "error",
        type: error == null ? void 0 : error.name,
        stack: error == null ? void 0 : error.stack,
        message,
        path: window.location.pathname
      });
    };
    window.onunhandledrejection = (event) => {
      var _a, _b;
      this.transport.send({
        event_type: "error",
        type: "unhandled_rejection",
        message: (_a = event.reason) == null ? void 0 : _a.message,
        stack: (_b = event.reason) == null ? void 0 : _b.stack,
        path: window.location.pathname
      });
    };
  }
};

// src/index.ts
var init = (options) => {
  const monitor = new import_monitor_sdk_core.Monitor(options);
  const transport = new BrowserTransport(options.dsn);
  monitor.init(transport);
  new Errors(transport).init();
  new import_monitor_sdk_browser_utils.Metrics(transport).init();
  return monitor;
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  init
});
