// src/transport/index.ts
import { getBrowserInfo } from "@duyi/monitor-sdk-browser-utils";
var BrowserTransport = class {
  constructor(dsn) {
    this.dsn = dsn;
  }
  send(data) {
    const browserInfo = getBrowserInfo();
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

export {
  BrowserTransport
};
