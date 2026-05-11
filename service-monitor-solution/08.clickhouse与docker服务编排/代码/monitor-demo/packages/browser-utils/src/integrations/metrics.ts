import { Transport } from "@duyi/monitor-sdk-core";
import { onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals";

export class Metrics {
  constructor(private transport: Transport) {}
  init() {
    [onCLS, onFCP, onINP, onLCP, onTTFB].forEach(metricFn => {
      metricFn(metric => {
        // 这里的metric是web-vitals库提供的性能指标对象
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
}
