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
var logger = require('./logger.js');
var server = require('./server.js');
var schemas = require('./schemas.js');
var object = require('./object.js');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var users;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function getUsers() {
    if(!users) {
        users = require('./users.js');
    }
    return users;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var outputSchema = {
    id: 'historyOutput',
    type: 'object',
    title: 'HistoryOutput',
    description: 'History schema used for output.',
    properties: {
        _id: schemas.objectId,
        userId: {
            type: 'string',
            minLength: 0
        },
        userName: {
            type: 'string',
            minLength: 0
        },
        objectId: schemas.objectId,
        operationType: {
            type: 'string',
            enum: ['insert', 'remove', 'update']
        },
        objectName: {
            type: 'string',
            minLength: 0
        },
        data: {
            type: 'string',
            minLength: 0
        },
        created: schemas.created,
    },
    required: ['_id', 'userId', 'userName', 'objectId', 'operationType', 'objectName', 'data', 'created'],
    additionalProperties: false
};
schemas.registerEntity(outputSchema);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var History = {
    output: {$ref: 'historyOutput'},
    list: schemas.createListSchema('history', {$ref: 'historyOutput'}),
    example: {
        _id: '550d84460b93524e14112345',
        userId: '550d84460b93524e14222344',
        objectId: '550d84463361bc0113580c08',
        userName: 'TestUserName',
        objectName: 'order',
        operationType: 'remove',
        data: '',
        created: '2015-03-21 14:46:30.535'
    },
    getCollection: function() {
        return server.db.collection('history');
    },
    getSort: function() {
        return [['created', 1]];
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
History.onAfterLoad = function(collection, history, callback) {
    history.data = JSON.stringify(history.data, null, 2);
    var mongoUserId = common.parseObjectID(history.userId);
    if(mongoUserId) {
        getUsers().loadSystemById(history.userId, function(error, user) {
            if(error) {
                return callback(error);
            }
            history.userName = user.email;
            return callback(null, history);
        });
    } else {
        history.userName = history.userId;
        return callback(null, history);
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function save(entityName, entity, userId, operationType, object, callback) {
    var collection = _.has(entity, 'getHistoryCollection')
        ? entity.getHistoryCollection()
        : server.db.collection('history');

    var mongoUserId = common.parseObjectID(userId);
    var data = {
        userId: mongoUserId ? mongoUserId : userId + '',
        operationType: operationType,
        objectName: entityName,
        created: common.generateTimestamp(),
        objectId: common.parseObjectID(object._id),
        data: object
    };

    collection.insert(data, {safe: true}, function(error) {
        if(error) {
            logger.error('objectHistory.save(): error saving history - ' + error.toString());
        }
        return callback(null, object);
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function loadAllByObjectId(objectId, callback) {
    var mongoObjectId = common.parseObjectID(objectId);
    if(!mongoObjectId) {
        logger.error('objectHistory.loadAllByObjectId(): invalid objectId - ' + objectId);
        return callback(new errors.InvalidParameter('Invalid objectId.'));
    }
    object.loadAllByQuery(History, {objectId: mongoObjectId}, function(error, history) {
        return callback(error, history);
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
module.exports = {
    History: History,
    save: save,
    loadAllByObjectId: loadAllByObjectId
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
