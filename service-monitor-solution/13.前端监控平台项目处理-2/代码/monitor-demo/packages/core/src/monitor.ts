import { Transport } from "./transport";
import { MonitorOptions } from "./types";

export let getTransport: () => Transport | null = () => null;

export class Monitor {
  private transport: Transport | null = null;

  constructor(private options: MonitorOptions) {}

  init(transport: Transport): void {
    this.transport = transport;
    getTransport = () => transport;
    // 如果有integration插件，就应该消费相关插件
    for (const integration of this.options.integrations ?? []) {
      integration.init(transport);
    }
  }
}
