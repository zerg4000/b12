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

var async = require('async');
var ObjectID = require('mongodb').ObjectID;
var common = require('./common.js');
var server = require('./server.js');
var logger = require('./logger.js');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var createQuery = function(nativeId, platform, osVersion, name) {
    return {
        nativeId : common.prepareStringForCompare(nativeId),
        platform: common.prepareStringForCompare(platform),
        osVersion: common.prepareStringForCompare(osVersion),
        name: common.prepareStringForCompare(name)
    };
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var loadById = function(collection, deviceId, callback) {
    var query = {'_id' : deviceId};

    collection.findOne(query, function(error, device) {
        if(error) {
            logger.error('Error loading device - ' + JSON.stringify(error));
            return callback(error);
        }
        if(!device) {
            return callback({type: 'not_found', message: 'Device not found.'});
        }
        return callback(null, device);
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var loadByParams = function(collection, nativeId, platform, osVersion, name, callback) {
    collection.findOne(createQuery(nativeId, platform, osVersion, name), function(error, device) {
        if(error) {
            logger.error('devices.loadByParams(): error loading device - ' + error.toString());
            return callback(error);
        }
        return callback(null, device);
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.loadById = function(deviceId, callback) {
    var mongoId = common.parseObjectID(deviceId);
    if(!mongoId) {
        return callback({type: 'invalid_parameter', message: 'Invalid deviceId.'});
    }

    return loadById(server.db.collection('devices'), mongoId, callback);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.loadOrCreate = function(nativeId, platform, osVersion, name, callback) {
    if(!nativeId || nativeId.length === 0) {
        return callback({type: 'invalid_parameter', message: 'NativeId is empty.'});
    }
    if(!platform || platform.length === 0) {
        return callback({type: 'invalid_parameter', message: 'Platform is empty.'});
    }
    if(!osVersion || osVersion.length === 0) {
        return callback({type: 'invalid_parameter', message: 'OS version is empty.'});
    }
    if(!name || name.length === 0) {
        return callback({type: 'invalid_parameter', message: 'Name is empty.'});
    }

    var collection = server.db.collection('devices');
    loadByParams(collection, nativeId, platform, osVersion, name, function(error, device) {
        if(error) {
            return callback({type: 'internal', message: 'Error loading device.'});
        }
        if(device) {
            return callback(null, device);
        }
        var query = createQuery(nativeId, platform, osVersion, name);
        query.created = common.generateTimestamp();
        collection.save(query, {safe:true}, function(error, device) {
            if(error || !device) {
                logger.error('devices.loadOrCreate(): error saving device: ' + error.toString());
                return callback({type: 'internal', message: 'Internal error.'});
            }

            return callback(null, device);
        });
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.remove = function(deviceId, callback) {
    var mongoId = common.parseObjectID(deviceId);
    if(!mongoId) {
        return callback({type: 'invalid_parameter', message: 'Invalid deviceId.'});
    }

    var collection = server.db.collection('devices');
    loadById(collection, mongoId, function(error, device) {
        if(error) {
            return callback(error);
        }
        if(!device) {
            return callback({type: 'not_found', message: 'Invalid deviceId.'});
        }
        //todo: remove sessions
        //todo: remove device
        return callback({type: 'internal', message: 'Not implemented.'});
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.loadStatistics = function(from, to, platform, callback) {
    var dateFrom = common.parseDate(from);
    var dateTo = common.parseDate(to);
    if(!dateFrom || !dateTo || dateFrom > dateTo) {
        return callback({type: 'invalid_parameter', message: 'Invalid date range.'});
    }

    var query = {
        created: {
            $gte: common.formatDateYYYYMMDD(dateFrom),
            $lte: common.formatDateYYYYMMDD(dateTo)
        }
    };

    if(platform) {
        query.platform = {$regex: '.*' + platform + '.*', $options: 'i'};
    }

    server.db.collection('devices').group(
        function(device) { return {date: device.created.substring(0, 10)}; },
        query,
        {count: 0},
        function(obj, prev) { prev.count++; },
        true,
        function(error, results) {
            if(error) {
                logger.error('devices.loadStatistics(): error loading statistics - ' + error.toString());
                return callback({type: 'internal', message: 'Internal error.'});
            }
            return callback(null, results);
        }
    );
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
