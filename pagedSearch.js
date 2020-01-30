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
var server = require('./server.js');
var common = require('./common.js');
var logger = require('./logger.js');
var schemas = require('./schemas.js');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.schemaNoSession = {
    type: 'object',
    properties: {
        offset: {
            type: ['number', 'string'],
            description: 'Row count to be skipped before returning result.',
            default: 0
        },
        limit: {
            type: ['number', 'string'],
            description: 'Maximum number of rows in result.',
            default: 100
        },
        searchString: {
            type: 'string',
            description: 'Substring to search.',
            default: 'some string',
            minLength: 0
        },
        sortField: {
            type: 'string',
            description: 'Name of the field to sort by, if any.',
            default: 'myField'
        },
        sortDescending: {
            type: ['boolean', 'string'],
            description: 'True, if sorting in descending order.',
            default: 'true'
        }
    },
    required: ['offset', 'limit'],
    additionalProperties: false
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.createSchema = function() {
    return schemas.createSessionSchema(exports.schemaNoSession);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.extendSchema = function(itemSchema) {
    return {
        type: 'object',
        properties: {
            count: {
                type: 'integer',
                minimum: 0,
                description: 'Found count.'
            },
            values: {
                type: 'array',
                items: common.clone(itemSchema),
                description: 'Found list.'
            }
        },
        required: ['count', 'values'],
        additionalProperties: false
    };
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.runWithQuery = function(collectionName, query, params, options, entity, callback) {
    var paging = exports.extractPagingInfo(params, callback);
    if(!paging) {
        // will do callback in extractPagingInfo
        return;
    }

    var collection = server.db.collection(collectionName);
    var cursor = options.fields ? collection.find(query, options.fields) : collection.find(query);
    cursor = exports.applyPagingToCursor(cursor, paging);
    cursor.toArray(function(error, items) {
        if(error) {
            logger.error('pagedSearch.runWithQuery(): error querying ' + collectionName + ' - ' + error + ', ' + JSON.stringify(query));
            return callback({type: 'internal', message: 'Internal error.'});
        }
        // get total count
        cursor.count(false, function(error, count) {
            if(error) {
                logger.error('pagedSearch.runWithQuery(): error counting ' + collectionName + ' - ' + error);
                return callback({type: 'internal', message: 'Internal error.'});
            }

            if(entity && entity.onAfterLoad) {
                async.forEach(items,
                    function(item, callback) {
                        return entity.onAfterLoad(collection, item, callback);
                    },
                    function(error) {
                        return callback(error, parseInt(count), items);
                    }
                );
            } else {
                return callback(null, parseInt(count), items);
            }
        });
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.run = function(collectionName, options, result, request, entity, callback) {
    var query = {};
    if(request.body.searchString) {
        var fieldName = options.fieldName ? options.fieldName : "name";
        var regexStr = ".*" + request.body.searchString + ".*";
        query[fieldName] = {$regex:regexStr, $options: "i"};
    }

    exports.runWithQuery(collectionName, query, request.body, options, entity, function(error, count, items) {
        if(error) {
            return callback(error);
        }
        result.key('count');
        result.val(parseInt(count));
        result.key('values');
        result.val(items);
        return callback();
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.extractPagingInfo = function(object, callback) {
    var paging = { offset: common.convertToNumber(object.offset),
                   limit: common.convertToNumber(object.limit),
                   sortField: object.sortField,
                   sortDescending: common.parseBool(object.sortDescending) };
    if(!paging.limit || paging.limit < 0) {
        return callback({type: 'invalid_parameter', message: 'Invalid limit value.'});
    }

    return paging;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.applyPagingToCursor = function(cursor, paging) {
    if(paging.offset) {
        cursor = cursor.skip(paging.offset);
    }
    if(paging.limit) {
        cursor = cursor.limit(paging.limit);
    }
    if(paging.sortField) {
        var sorting = {};
        sorting[paging.sortField] = paging.sortDescending ? -1 : 1;
        cursor = cursor.sort(sorting);
    }
    return cursor;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.searchArray = function(collectionName, query, fields, request, callback) {
    var paging = exports.extractPagingInfo(request.body, callback);
    if(!paging) {
        // will do callback in extractPagingInfo
        return;
    }

    var collection = server.db.collection(collectionName);
    var cursor = fields ? collection.find(query, fields) : collection.find(query);
    cursor = exports.applyPagingToCursor(cursor, paging);
    cursor.toArray(callback);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.search = function(collectionName, query, fields, tagName, result, request, callback) {
    var paging = exports.extractPagingInfo(request.body, callback);
    if(!paging) {
        // will do callback in extractPagingInfo
        return;
    }

    var collection = server.db.collection(collectionName);
    var cursor = fields ? collection.find(query, fields) : collection.find(query);
    cursor = exports.applyPagingToCursor(cursor, paging);
    result.key(tagName);
    common.sendList(result, cursor, callback);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.searchInfix = function(collectionName, fieldName, tagName, result, request, callback) {
    if(!request.body.searchString) {
        return callback({type: 'invalid_parameter', message: 'searchString not specified.'});
    }

    var regexStr = ".*" + request.body.searchString + ".*";
    var query = {};
    query[fieldName] = {$regex:regexStr, $options: "i"};
    return exports.search(collectionName, query, null, tagName, result, request, callback);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.searchPrefix = function(collectionName, fieldName, tagName, result, request, callback) {
    if(!request.body.searchString) {
        return callback({type: 'invalid_parameter', message: 'searchString not specified.'});
    }

    var query = {};
    query[fieldName] = {$regex: "^" + request.body.searchString};
    return exports.search(collectionName, query, null, tagName, result, request, callback);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.searchPrefixCaseInsensitive = function(collectionName, fieldName, tagName, result, request, callback){
    if(!request.body.searchString){
        return callback({type: 'invalid_parameter', message: 'searchString not specified.'});
    }

    var insensitiveFieldName = "_" + fieldName + "_ci";

    var query = {};
    query[insensitiveFieldName] = {$regex: "^" + request.body.searchString.toLowerCase()};
    var fields = {};
    fields[insensitiveFieldName] = 0;
    return exports.search(collectionName, query, fields, tagName, result, request, callback);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.searchPrefixWithFilterCaseInsensitive = function(collectionName, fieldName, filter, tagName, result,
                                                        request, callback) {
    if(!request.body.searchString) {
        return callback({type: 'invalid_parameter', message: 'searchString not specified.'});
    }

    var insensitiveFieldName = "_" + fieldName + "_ci";

    var query = {};
    query[insensitiveFieldName] = {$regex: "^" + request.body.searchString.toLowerCase()};
    var fullQuery = {$and: [query, filter]};
    var fields = {};
    fields[insensitiveFieldName] = 0;
    return exports.search(collectionName, fullQuery, fields, tagName, result, request, callback);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
