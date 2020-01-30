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

var common = require('./common.js');
var server = require('./server.js');
var logger = require('./logger.js');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.getNextValue = function(counterName, callback) {
    server.db.collection('counters').findAndModify({name: counterName}, [], {$inc: {value: 1}},
        {new: true, upsert: true}, function(error, counter) {
            if(error) {
                logger.error('counters.getNextValue(): error generating new number - ' + error.toString());
                return callback({type: 'internal', message: 'Internal error.'});
            }
            return callback(null, counter.value.toString());
        });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
