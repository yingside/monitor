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
  Monitor: () => Monitor,
  getTransport: () => getTransport
});
module.exports = __toCommonJS(index_exports);

// src/monitor.ts
var getTransport = () => null;
var Monitor = class {
  constructor(options) {
    this.options = options;
    this.transport = null;
  }
  init(transport) {
    var _a;
    this.transport = transport;
    getTransport = () => transport;
    for (const integration of (_a = this.options.integrations) != null ? _a : []) {
      integration.init(transport);
    }
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Monitor,
  getTransport
});
