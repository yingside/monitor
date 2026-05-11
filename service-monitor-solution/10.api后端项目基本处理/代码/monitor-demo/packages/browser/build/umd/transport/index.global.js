(() => {
  // ../../node_modules/.pnpm/web-vitals@5.0.3/node_modules/web-vitals/dist/web-vitals.js
  var L = 1 / 0;

  // ../browser-utils/build/esm/index.mjs
  function getBrowserInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      referrer: document.referrer,
      path: location.pathname
    };
  }

  // src/transport/index.ts
  var BrowserTransport = class {
    constructor(dsn) {
      this.dsn = dsn;
    }
    send(data) {
      const browserInfo = getBrowserInfo();
      const payload = {
        ...data,
        // 其他需要添加的数据
        browserInfo
      };
      fetch(this.dsn, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json"
        }
      }).catch((error) => {
        console.error("\u4E0A\u62A5\u5931\u8D25:", error);
      });
    }
  };
})();
