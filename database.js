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
var mongodb = require('mongodb');
var logger = require('./logger.js');
var common = require('./common.js');
var settings = require('./settings.js');
var variables = require('./variables.js');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.settings = settings.get();

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var mongo = new mongodb.Db(exports.settings.DB_NAME,
    new mongodb.Server(exports.settings.DB_SERVER, exports.settings.DB_PORT), {w: 1, journal: false, fsync: true});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.open = function(callback) {
    mongo.open(callback);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.close = function(callback) {
    mongo.close(callback);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.countDBRecords = function(collection, query, callback) {
    collection.find(query).count(function(error, result) {
        if(error) {
            logger.error('database.countDBRecords(): error counting - ' + error.toString());
            return callback({type: 'internal', message: 'Internal error'});
        }
        return callback(null, result ? parseInt(result) : 0);
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.loadRandomRecords = function(collection, count, query, callback) {
    exports.countDBRecords(collection, query, function(error, totalCount) {
        if(error) {
            return callback(error);
        }
        if(!totalCount) {
            return callback(null, []);
        }
        var skip = 0;
        if(totalCount - count > 0) {
            skip = Math.floor(Math.random() * (totalCount - count));
        }
        collection.find(query).limit(count).skip(skip).toArray(function(error, objects) {
            if(error) {
                logger.error('database.loadRandomRecords(): error loading - ' + error.toString());
                return callback({type: 'internal', message: 'Internal error'});
            }
            return callback(null, objects);
        });
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.forEachItemInCursorParallel = function(cursor, maxThreads, iterator, callback) {
    var nextScheduled = false;
    var threadCount = 0;
    var cursorEnded = false;
    var returned = false;

    var doNextItem = function() {
        if(returned) return;
        cursor.nextObject(function(error, item) {
            if(error) {
                returned = true;
                return callback(error);
            }

            if(!item) {
                cursorEnded = true;
                --threadCount;
                if(threadCount == 0 && !returned) callback();
                return;
            }

            if(returned) return;

            nextScheduled = false;
            tryNextObject();

            iterator(item, function(error) {
                if(error) {
                    if(!returned) callback(error);
                    return;
                }

                --threadCount;
                if(cursorEnded) {
                    if(threadCount == 0 && !returned) return callback();
                    return;
                }

                tryNextObject();
            });
        });
    };

    var tryNextObject = function() {
        if(!nextScheduled && !returned && threadCount < maxThreads) {
            ++threadCount;
            nextScheduled = true;
            process.nextTick(doNextItem);
        }
    };

    tryNextObject();
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.updateSchema = function(database, schemas, callback) {
    variables.getValueEx(database, 'schema', function(error, value) {
        if(error) return callback(error);

        var version = value ? value : 0;
        logger.verbose('database.updateSchema(): schema migration started, current version - ' + version);

        async.eachSeries(schemas,
            function(schema, callback) {
                if(schema.version > version) {
                    schema.migrate(function(error) {
                        if(error) return callback(error);
                        version = schema.version;
                        logger.verbose('database.updateSchema(): schema updated to version - ' + version);
                        return variables.setValueEx(database, 'schema', version, callback);
                    });
                } else {
                    return callback();
                }
            },
            function(error) {
                if(!error) {
                    logger.verbose('database.updateSchema(): schema migration finished, current version - ' + version);
                }
                return callback(error);
            }
        );
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.createLike = function(searchString) {
    return {$regex: '.*' + common.escapeRegExp(common.stringUtils.trimAll(searchString)) + '.*', $options: 'i'};
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
