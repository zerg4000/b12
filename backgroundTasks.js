////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//  Copyright (C) 2008-2014 Quantron Systems LLC.
//  All Rights Reserved.
//
//  This file is part of the b12 project.
//  For conditions of distribution and use,
//  please contact sales@quantron-systems.com
//
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

'use strict';

var _ = require('underscore');
var common = require('./common.js');
var apiRegistrar = require('./APIRegistrar.js');
var logger = require('./logger.js');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.start = function(func, intervalSeconds, callback) {
    logger.info('backgroundTasks.start(): task started - ' + func.name);
    var handler = {
        func: func,
        intervalSeconds: intervalSeconds,
        intervalId: '',
        needToStop: false
    };
    func(function(error) {
        if(error) {
            return callback(error);
        }
        setInterval(function(intervalId) {
            handler.intervalId = intervalId;
            if(handler.needToStop) {
                clearInterval(intervalId);
            } else {
                func(function(error) {
                    if(error) {
                        logger.error('backgroundTasks: error in task ' + func.name + ' - ' + JSON.stringify(error));
                    }
                });
            }
        }, (intervalSeconds * 1000));
        return callback(null, handler);
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.stop = function(handler) {
    logger.info('backgroundTasks.stop(): task stopped - ' + handler.func.name);
    handler.needToStop = true;
    clearTimeout(handler.intervalId);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
