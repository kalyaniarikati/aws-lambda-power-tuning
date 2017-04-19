'use strict';

const utils = require('./utils');

const minRAM = parseInt(process.env.minRAM);
const minCost = parseFloat(process.env.minCost);

/**
 * Execute given function N times in parallel, until every invokation is over.
 */
module.exports.handler = (event, context, callback) => {
  
    // read input from event
    const lambdaARN = event.lambdaARN;
    const value = parseInt(event.value);
    const num = parseInt(event.num);
    const payload = event.payload;
    const enableParallel = event.parallelInvocation || false;

    if (!lambdaARN) {
        const error = new Error("Missing or empty lambdaARN");
        callback(error);
        throw error;  // TODO useless?
    }
    if (!value  || isNaN(value)) {
        const error = new Error("Invalid value: " + value);
        callback(error);
        throw error;  // TODO useless?
    }
    if (!num || isNaN(num)) {
        const error = new Error("Invalid num: " + num);
        callback(error);
        throw error;  // TODO useless?
    }

    // create list of promises (same params)
    const lambdaAlias = "RAM" + value;
    const invocations = utils.range(num).map(function() {
        return utils.invokeLambda.bind(null, lambdaARN, lambdaAlias, payload);
    });

    // initialize promise
    var queue = Promise.resolve();
    var seriesResults = [];

    if (enableParallel) {
        // invoke in parallel
        queue = Promise.all(invocations.map(function(f) {
            return f();
        }));
    } else {
        // invoke in series
        invocations.forEach(function(invocation) {
            queue = queue
                .then(invocation)
                .then(function(result) {
                    seriesResults.push(result);
                    return Promise.resolve(null);  // null result!
                });
        });
    }

    // proceed with aggregation and cost computation
    return queue
        .then(function(parallelResults) {
            // aggregate results (either parallel or series)
            return utils.computeAverageDuration(parallelResults || seriesResults);
        })
        .then(utils.computeAveragePrice.bind(null, minCost, minRAM, value))  // compute price
        .then(function(price) {
            callback(null, price);
            return Promise.resolve(price);
        })
        .catch(console.error.bind(console));
};