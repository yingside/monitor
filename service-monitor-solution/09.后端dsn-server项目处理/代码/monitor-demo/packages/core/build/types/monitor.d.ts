import { Transport } from "./transport";
import { MonitorOptions } from "./types";
export declare let getTransport: () => Transport | null;
export declare class Monitor {
    private options;
    private transport;
    constructor(options: MonitorOptions);
    init(transport: Transport): void;
}
//# sourceMappingURL=monitor.d.ts.map