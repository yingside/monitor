export interface Transport {
    send(data: Record<string, unknown>): void;
}
export declare class BrowserTransport implements Transport {
    private dsn;
    constructor(dsn: string);
    send(data: Record<string, unknown>): void;
}
//# sourceMappingURL=index.d.ts.map