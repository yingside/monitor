import { Transport } from "@duyi/monitor-sdk-core";
import { getBrowserInfo } from "@duyi/monitor-sdk-browser-utils";
export class BrowserTransport implements Transport {
  constructor(private dsn: string) {}

  send(data: Record<string, unknown>): void {
    const browserInfo = getBrowserInfo();
    const payload = {
      ...data,
      // 其他需要添加的数据
      browserInfo
    };

    // 使用 fetch 上报
    fetch(this.dsn, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json"
      }
    }).catch(error => {
      console.error("上报失败:", error);
    });
  }
}
