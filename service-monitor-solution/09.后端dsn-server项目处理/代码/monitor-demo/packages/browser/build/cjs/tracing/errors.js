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

// src/tracing/errors.ts
var errors_exports = {};
__export(errors_exports, {
  Errors: () => Errors
});
module.exports = __toCommonJS(errors_exports);
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Errors
});
