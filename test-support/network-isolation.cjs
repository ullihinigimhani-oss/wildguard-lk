// Test-only transport guard. Never include this module in application bundles.
const net = require('node:net');
const tls = require('node:tls');
const http = require('node:http');
const https = require('node:https');
const dns = require('node:dns');
const dgram = require('node:dgram');

function installNetworkIsolation({ allowLocalServers = false, target = globalThis } = {}) {
  const undo = [];
  const ports = new Set();
  const blocked = () => { throw new Error('TEST_NETWORK_BLOCKED: use an explicit network mock'); };
  function replace(object, key, value) {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    Object.defineProperty(object, key, { configurable: true, writable: true, value });
    undo.push(() => descriptor ? Object.defineProperty(object, key, descriptor) : delete object[key]);
  }
  function permitted(host, port) {
    return allowLocalServers && ['127.0.0.1', '::1', '[::1]'].includes(host) && ports.has(Number(port));
  }
  const listen = net.Server.prototype.listen;
  replace(net.Server.prototype, 'listen', function (...args) {
    if (!allowLocalServers) return blocked();
    this.once('listening', () => {
      const address = this.address();
      if (address && typeof address === 'object') {
        ports.add(address.port);
        this.once('close', () => ports.delete(address.port));
      }
    });
    return listen.apply(this, args);
  });
  const connect = net.Socket.prototype.connect;
  replace(net.Socket.prototype, 'connect', function (...args) {
    // Node may pass its internally normalized [options, callback] tuple.
    const first = Array.isArray(args[0]) ? args[0][0] : args[0];
    const options = typeof first === 'object' ? first : { port: first, host: args[1] };
    if (!permitted(options.host, options.port) || options.path) return blocked();
    return connect.apply(this, args);
  });
  for (const transport of [http, https]) {
    for (const method of ['request', 'get']) {
      const original = transport[method];
      replace(transport, method, function (...args) {
        const first = args[0];
        const options = typeof first === 'string' || first instanceof URL ? new URL(first) : first;
        if (!permitted(options?.hostname || options?.host, options?.port)) return blocked();
        return original.apply(this, args);
      });
    }
  }
  replace(tls, 'connect', blocked);
  replace(dgram, 'createSocket', blocked);
  for (const key of Object.keys(dns).filter(key => /^(lookup|resolve|reverse)/.test(key) && typeof dns[key] === 'function')) {
    replace(dns, key, blocked);
    if (dns.promises[key]) replace(dns.promises, key, async () => blocked());
  }
  replace(target, 'fetch', async () => blocked());
  if (target.XMLHttpRequest) replace(target.XMLHttpRequest.prototype, 'send', blocked);
  else replace(target, 'XMLHttpRequest', class {
    // Jest Expo does not supply XHR. Keep an explicit deny-only transport for Axios.
    open() {}
    setRequestHeader() {}
    abort() {}
    send() { blocked(); }
  });
  if (target.WebSocket) replace(target, 'WebSocket', class { constructor() { blocked(); } });
  if (target.EventSource) replace(target, 'EventSource', class { constructor() { blocked(); } });
  if (target.navigator?.sendBeacon) replace(target.navigator, 'sendBeacon', blocked);
  return () => undo.reverse().forEach(restore => restore());
}

module.exports = { installNetworkIsolation };
