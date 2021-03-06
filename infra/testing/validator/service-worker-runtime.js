const assert = require('assert');
const expect = require('chai').expect;
const fse = require('fs-extra');
const makeServiceWorkerEnv = require('service-worker-mock');
const sinon = require('sinon');
const vm = require('vm');

function setupSpiesAndContext() {
  const importScripts = sinon.spy();
  const workbox = {
    // To make testing easier, return the name of the plugin.
    cacheableResponse: {
      Plugin: sinon.stub().returns('workbox.cacheableResponse.Plugin'),
    },
    clientsClaim: sinon.spy(),
    // To make testing easier, return the name of the plugin.
    expiration: {
      Plugin: sinon.stub().returns('workbox.expiration.Plugin'),
    },
    precaching: {
      precacheAndRoute: sinon.spy(),
      suppressWarnings: sinon.spy(),
    },
    routing: {
      registerNavigationRoute: sinon.spy(),
      registerRoute: sinon.spy(),
    },
    core: {
      setCacheNameDetails: sinon.spy(),
    },
    setConfig: sinon.spy(),
    skipWaiting: sinon.spy(),
    // To make testing easier, return the name of the strategy.
    strategies: {
      cacheFirst: sinon.stub().returns('cacheFirst'),
    },
  };

  const context = Object.assign({
    workbox,
    importScripts,
  }, makeServiceWorkerEnv());

  const methodsToSpies = {
    importScripts,
    cacheableResponsePlugin: workbox.cacheableResponse.Plugin,
    cacheExpirationPlugin: workbox.expiration.Plugin,
    cacheFirst: workbox.strategies.cacheFirst,
    clientsClaim: workbox.clientsClaim,
    precacheAndRoute: workbox.precaching.precacheAndRoute,
    registerNavigationRoute: workbox.routing.registerNavigationRoute,
    registerRoute: workbox.routing.registerRoute,
    setCacheNameDetails: workbox.core.setCacheNameDetails,
    setConfig: workbox.setConfig,
    skipWaiting: workbox.skipWaiting,
    suppressWarnings: workbox.precaching.suppressWarnings,
  };

  return {context, methodsToSpies};
}

function validateMethodCalls({methodsToSpies, expectedMethodCalls}) {
  for (const [method, spy] of Object.entries(methodsToSpies)) {
    if (spy.called) {
      expect(spy.args).to.deep.equal(expectedMethodCalls[method],
        `while testing method calls for ${method}`);
    } else {
      expect(expectedMethodCalls[method],
        `while testing method calls for ${method}`).to.be.undefined;
    }
  }
}

/**
 * This is used in the service worker generation tests to validate core
 * service worker functionality. While we don't fully emulate a real service
 * worker runtime, we set up spies/stubs to listen for certain method calls,
 * run the code in a VM sandbox, and then verify that the service worker
 * made the expected method calls.
 *
 * If any of the expected method calls + parameter combinations were not made,
 * this method will reject with a description of what failed.
 *
 * @param {string} [swFile]
 * @param {string} [swCode]
 * @param {Object} expectedMethodCalls
 * @return {Promise} Resolves if all of the expected method calls were made.
 */
module.exports = async ({swFile, swCode, expectedMethodCalls}) => {
  assert((swFile || swCode) && !(swFile && swCode),
    `Set swFile or swCode, but not both.`);

  if (swFile) {
    swCode = await fse.readFile(swFile, 'utf8');
  }

  const {context, methodsToSpies} = setupSpiesAndContext();

  vm.runInNewContext(swCode, context);

  validateMethodCalls({methodsToSpies, expectedMethodCalls});
};
