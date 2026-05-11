import { Transport } from "@duyi/monitor-sdk-core";
export declare class BrowserTransport implements Transport {
    private dsn;
    constructor(dsn: string);
    send(data: Record<string, unknown>): void;
}
//# sourceMappingURL=index.d.ts.map