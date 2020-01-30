////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//  Copyright (C) 2008-2013 Quantron Systems LLC.
//  All Rights Reserved.
//
//  This file is part of the b12 project.
//  For conditions of distribution and use,
//  please contact sales@quantron-systems.com
//
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

'use strict';

var _ = require('underscore');
var logger = require('./logger.js');
var errors = require('./errors.js');
var common = require('./common.js');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var MemoryCache = function() {
    this.EXPIRE = 60 * 60 * 6; // 6 hours
    this.caches = {};
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
MemoryCache.prototype.wrap = function(fn, expireTimeInSeconds) {
    var that = this;

    if(typeof expireTimeInSeconds === 'undefined') {
        expireTimeInSeconds = that.EXPIRE;
    }

    return function () {
        var argsArray = Array.prototype.slice.call(arguments);

        if(argsArray.length < 1) {
            logger.error('MemoryCache.wrap(): called with arguments count less than 1.');
            return fn.apply(null, argsArray);
        }

        var successCallback = argsArray[argsArray.length - 1];

        if(typeof(successCallback) != 'function') {
            logger.error('MemoryCache.wrap(): called with non-function last argument.');
            return fn.apply(null, argsArray);
        }

        if(!fn.name) {
            logger.error('MemoryCache.wrap(): called for anonymous function. MemoryCache cache disabled for that functions.');
            return fn.apply(null, argsArray);
        }

        var originalArguments = argsArray.slice(0, argsArray.length - 1);
        var argumentsForKey = [fn.name].concat(originalArguments);

        var key = null;

        try {
            key = JSON.stringify(argumentsForKey);
        } catch(error) {
            logger.error('MemoryCache.wrap(): exception on JSON.stringify key: %s. Calling original function.', error);
            return fn.apply(null, argsArray);
        }

        if(_.has(that.caches, key)) {
            var cached = that.caches[key];
            if(cached.expirationTime > common.currentDateTime()) {
                //logger.verbose('MemoryCache.wrap(): cache hit for ' + fn.name);
                return successCallback(null, cached.value);
            } else {
                logger.verbose('MemoryCache.wrap(): cache expired for ' + fn.name);
                delete that.caches[key];
            }
        } else {
            logger.verbose('MemoryCache.wrap(): cache miss for ' + fn.name);
        }

        var dataCallback = function(error, result) {
            if(error) {
                logger.error('MemoryCache.wrap(): error getting data - ' + JSON.stringify(error));
            } else {
                that.caches[key] = {
                    expirationTime: common.currentDateTime() + expireTimeInSeconds * 1000,
                    value: common.clone(result)
                };
            }

            return successCallback(error, result);
        };

        originalArguments.push(dataCallback);
        fn.apply(null, originalArguments);
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
module.exports = {
    MemoryCache: new MemoryCache()
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
