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
var server = require('./server.js');
var logger = require('./logger.js');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function getValueEx(database, name, callback) {
    database.collection('variables').findOne({name: name}, function(error, record) {
        if(error) {
            logger.error('variables.getValueEx(): error getting value - ' + error.toString());
            return callback({type: 'internal', message: 'Internal error.'});
        }
        return callback(null, record ? record.value : null);
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function setValueEx(database, name, value, callback) {
    database.collection('variables').findAndModify({name: name}, [],
        {$set: {value: value}},
        {new: true, upsert: true},
        function(error) {
            if(error) {
                logger.error('variables.setValueEx(): error setting value - ' + error.toString());
                return callback({type: 'internal', message: 'Internal error.'});
            }
            return callback();
        }
    );
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
module.exports = {
    getValue: _.partial(getValueEx, server.db),
    setValue: _.partial(setValueEx, server.db),
    getValueEx: getValueEx,
    setValueEx: setValueEx
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
