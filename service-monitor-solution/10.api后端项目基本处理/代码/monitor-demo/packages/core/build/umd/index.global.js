(() => {
  // src/monitor.ts
  var getTransport = () => null;
  var Monitor = class {
    constructor(options) {
      this.options = options;
      this.transport = null;
    }
    init(transport) {
      var _a;
      this.transport = transport;
      getTransport = () => transport;
      for (const integration of (_a = this.options.integrations) != null ? _a : []) {
        integration.init(transport);
      }
    }
  };
})();
