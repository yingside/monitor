/*
interface InitOptions {
  dsn: string;
  integrations?: any[];
}

type Transport = BrowserTransport; //| NodeTransport | ImageTansport | XHRTransport | FetchTransport;

class Monitor {
  dsn: string;
  integrations: any[];

  constructor(options: InitOptions) {
    this.dsn = options.dsn;
    this.integrations = options.integrations || [];
  }

  init(transport: Transport) {
    // 上层抽象，只需要关注Transport的send方法即可
    // 无论用哪种方式上报，最终都会调用这个方法
    transport.send({});
  }
}

class BrowserTransport {
  constructor(private dsn: string) {}

  send(data: Record<string, unknown>) {
    // 1. fetch
    // fetch()
    // 2. XHR
    // const xhr = new XMLHttpRequest();
    // 3. img
    // const img = new Image(); img.src = xxxx
    // 4. sendBeacon
    // navigator.sendBeacon(this.dsn, JSON.stringify(data));

    console.log("浏览器上报", data);
  }
}
*/

import { Integration, Monitor } from "@duyi/monitor-sdk-core";
import { Metrics } from "@duyi/monitor-sdk-browser-utils";
import { BrowserTransport } from "./transport";
import { Errors } from "./tracing/errors";

export const init = (options: { dsn: string; integrations?: Integration[] }) => {
  // 伪代码
  /*
  // 需要有监控实例
  const 监控实例 = new 监控({
    dsn: options.dsn,
    integrations: options.integrations || []
  });

  const 上报对象 = new 上报(options.dsn);

  监控实例.init(上报对象);

  // 错误异常采集
  new Errors(上报对象).init();

  // 性能采集
  new Metrics(上报对象).init();
  */

  const monitor = new Monitor(options);

  const transport = new BrowserTransport(options.dsn);
  monitor.init(transport);

  // 错误异常采集
  new Errors(transport).init();

  // 性能采集
  new Metrics(transport).init();

  return monitor;
};
