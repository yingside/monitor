import { Transport } from "../transport";
export interface IIntegration {
    init(transport: Transport): void;
}
export declare class Integration implements IIntegration {
    transport: Transport | null;
    init(transport: Transport): void;
}
export interface MonitorOptions {
    dsn: string;
    integrations?: IIntegration[];
}
//# sourceMappingURL=index.d.ts.map