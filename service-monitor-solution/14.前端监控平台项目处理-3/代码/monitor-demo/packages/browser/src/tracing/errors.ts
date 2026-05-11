import { Transport } from "@duyi/monitor-sdk-core";

export class Errors {
  constructor(private transport: Transport) {}

  init() {
    window.onerror = (message, source, lineno, colno, error) => {
      this.transport.send({
        event_type: "error",
        type: error?.name,
        stack: error?.stack,
        message,
        path: window.location.pathname
      });
    };

    window.onunhandledrejection = event => {
      this.transport.send({
        event_type: "error",
        type: "unhandled_rejection",
        message: event.reason?.message,
        stack: event.reason?.stack,
        path: window.location.pathname
      });
    };
  }
}
