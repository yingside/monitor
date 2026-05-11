import {
  Metrics
} from "./chunk-QPQAI3OP.mjs";

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
export {
  Metrics,
  getBrowserInfo
};
