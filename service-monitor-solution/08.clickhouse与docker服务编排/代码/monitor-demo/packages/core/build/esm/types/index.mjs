// src/types/index.ts
var Integration = class {
  constructor() {
    this.transport = null;
  }
  init(transport) {
    this.transport = transport;
  }
};
export {
  Integration
};
