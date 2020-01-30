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
var async = require('async');
var common = require('./common.js');
var server = require('./server.js');
var logger = require('./logger.js');
var object = require('./object.js');
var schemas = require('./schemas.js');
var database = require('./database.js');
var files = require('./files.js');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.inputSchema = {
    type: 'object',
    properties: {
        _id: schemas.objectIdOrEmpty,
        name: {
            type: 'string'
        },
        description: {
            type: 'string',
            minLength: 0
        },
        parentId: schemas.objectIdOrEmpty,
        visible: {
            type: 'boolean'
        }
    },
    required: ['_id', 'name', 'description', 'parentId', 'visible'],
    additionalProperties: false
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.outputSchema  = schemas.extendSchema(object.Object.extendSchema({
    type: 'object',
    properties: {
        childCount: {
            type: 'number',
            minimum: 0
        },
        imageId: {
            type: 'string',
            //todo: format: 'uri',
            minLength: 0
        },
        imageUrl: {
            type: 'string',
            format: 'uri',
            minLength: 0
        },
        importUrl: {
            type: 'string',
            format: 'uri',
            minLength: 0
        }
    },
    required: ['childCount', 'imageId', 'imageUrl', 'importUrl'],
    additionalProperties: false
}), exports.inputSchema);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.importSchema = {
    type: 'object',
    properties: {
        importUrl: {
            type: 'string',
            format: 'uri'
        },
        parentImportUrl: {
            type: 'string',
            format: 'uri',
            minLength: 0
        },
        imageUrl: {
            type: 'string',
            format: 'uri'
        },
        name: {
            type: 'string'
        },
        description: {
            type: 'string'
        }
    },
    required: ['importUrl', 'parentImportUrl', 'imageUrl', 'name', 'description'],
    additionalProperties: false
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.onBeforeSave = function(entity, collection, group, callback) {
    var data = {
        name: group.name,
        visible: group.visible,
        description: group.description
    };

    if(group.imageId) {
        // check is not needed
        data.imageId = group.imageId;
    }

    if(group.imageUrl) {
        // check is not needed
        data.imageUrl = group.imageUrl;
    }

    if(group.importUrl) {
        // check is not needed
        data.importUrl = group.importUrl;
    }

    //todo: if parentId changed - notify
    //todo: collect differences and save to log

    if(group.parentId) {
        // check parent
        var parentId = common.parseObjectID(group.parentId);
        if(!parentId) {
            return callback({type:'invalid_parameter', message:'Invalid parentId.'});
        }
        entity.loadById(parentId, function(error, parent) {
            if(error || !parent) {
                return callback({type:'invalid_parameter', message:'Invalid parentId.'});
            }
            data.parentId = parentId;
            return callback(null, data);
        });
    } else {
        data.parentId = '';
        return callback(null, data);
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.onAfterLoad = function(collection, group, callback) {
    group.imageUrl = object.getFullImageUrl(group.imageUrl);
    group.imageId = group.imageId ? group.imageId : '';
    group.importUrl = group.importUrl ? group.importUrl : '';
    return object.countChildren(group, collection, callback);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.saveImage = function(entity, groupId, imageType, filePath, callback) {
    entity.loadById(groupId, function(error, group) {
        if(error) {
            return callback(error);
        }
        files.save(group.imageId, imageType, 'image/' + imageType, group.name, 'Group image', filePath,
            function(error, image) {
                if(error) {
                    return callback(error);
                }
                group.imageId = image._id;
                group.imageUrl = image.url;
                return entity.save(group, callback);
            });
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function extractImageType(url) {
    url = url.toLowerCase();
    var index = url.length - 4;
    if(url.indexOf('.gif') == index) {
        return 'gif';
    }
    if(url.indexOf('.png') == index) {
        return 'png';
    }
    return 'jpeg';
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.importFromWeb = function(entity, importData, callback) {
    var collection = entity.getCollection();
    object.findByQuery(collection, importData.parentImportUrl ? {importUrl: importData.parentImportUrl} : null, function(error, parentGroups) {
        if(error) {
            return callback(error);
        }
        if(importData.parentImportUrl && _.isEmpty(parentGroups)) {
            return callback({type: 'invalid_parameter', message: 'Invalid parentImportUrl - ' + importData.parentImportUrl});
        }

        object.findByQuery(collection, importData.importUrl ? {importUrl: importData.importUrl} : null, function(error, groups) {
            if(error) {
                return callback(error);
            }
            var data = {
                _id: _.isEmpty(groups) ? '' : groups[0]._id,
                name: importData.name,
                description: importData.description,
                parentId: _.isEmpty(parentGroups) ? '' : parentGroups[0]._id,
                visible: _.isEmpty(groups) ? false : groups[0].visible,
                importUrl: importData.importUrl,
                parentImportUrl: importData.parentImportUrl
            };
            if(!importData.imageUrl) {
                return entity.save(data, callback);
            }
            var imageType = extractImageType(importData.imageUrl);
            files.saveByExternalUrl(_.isEmpty(groups) ? '' : groups[0].imageId, imageType, 'image/' + imageType, importData.name,
                'Group image', importData.imageUrl,
                function(error, image) {
                    if(error) {
                        return callback(error);
                    }
                    data.imageId = image._id;
                    data.imageUrl = image.url;
                    return entity.save(data, callback);
                });
        });
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
