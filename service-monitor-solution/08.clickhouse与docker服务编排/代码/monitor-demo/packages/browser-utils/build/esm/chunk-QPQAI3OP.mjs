// src/integrations/metrics.ts
import { onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals";
var Metrics = class {
  constructor(transport) {
    this.transport = transport;
  }
  init() {
    [onCLS, onFCP, onINP, onLCP, onTTFB].forEach((metricFn) => {
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

export {
  Metrics
};
