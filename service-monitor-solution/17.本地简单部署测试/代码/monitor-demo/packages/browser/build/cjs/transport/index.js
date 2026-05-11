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

// src/transport/index.ts
var transport_exports = {};
__export(transport_exports, {
  BrowserTransport: () => BrowserTransport
});
module.exports = __toCommonJS(transport_exports);
var import_monitor_sdk_browser_utils = require("@duyi/monitor-sdk-browser-utils");
var BrowserTransport = class {
  constructor(dsn) {
    this.dsn = dsn;
  }
  send(data) {
    const browserInfo = (0, import_monitor_sdk_browser_utils.getBrowserInfo)();
    const payload = {
      ...data,
      // 其他需要添加的数据
      browserInfo
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BrowserTransport
});
