(() => {
  // src/tracing/errors.ts
  var Errors = class {
    constructor(transport) {
      this.transport = transport;
    }
    init() {
      window.onerror = (message, source, lineno, colno, error) => {
        this.transport.send({
          event_type: "error",
          type: error == null ? void 0 : error.name,
          stack: error == null ? void 0 : error.stack,
          message,
          path: window.location.pathname
        });
      };
      window.onunhandledrejection = (event) => {
        var _a, _b;
        this.transport.send({
          event_type: "error",
          type: "unhandled_rejection",
          message: (_a = event.reason) == null ? void 0 : _a.message,
          stack: (_b = event.reason) == null ? void 0 : _b.stack,
          path: window.location.pathname
        });
      };
    }
  };
})();
