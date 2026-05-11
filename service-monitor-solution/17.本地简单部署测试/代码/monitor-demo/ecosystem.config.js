module.exports = {
  apps : [{
    name: 'dsn-server',
    script: './apps/backend/dsn-server/dist/main.js'
  }, {
    name: 'monitor-server',
    script: './apps/backend/monitor-server/dist/main.js'
  }]
};
