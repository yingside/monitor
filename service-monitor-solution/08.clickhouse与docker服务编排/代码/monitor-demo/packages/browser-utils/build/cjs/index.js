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
  Metrics: () => Metrics,
  getBrowserInfo: () => getBrowserInfo
});
module.exports = __toCommonJS(index_exports);

// src/integrations/metrics.ts
var import_web_vitals = require("web-vitals");
var Metrics = class {
  constructor(transport) {
    this.transport = transport;
  }
  init() {
    [import_web_vitals.onCLS, import_web_vitals.onFCP, import_web_vitals.onINP, import_web_vitals.onLCP, import_web_vitals.onTTFB].forEach((metricFn) => {
      metricFn((metric) => {
        this.transport.send({
          event_type: "performance",
          type: "web_vitals",
          name: metric.name,
          value: metric.value,
          path: window.location.pathname
        });
      });
    });
  }
};

// src/index.ts
function getBrowserInfo() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    referrer: document.referrer,
    path: location.pathname
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Metrics,
  getBrowserInfo
});
