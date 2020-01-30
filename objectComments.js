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
var errors = require('./errors.js');
var object = require('./object.js');
var users = require('./users.js');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var commentInputSchema = {
    id: 'commentInput',
    type: 'object',
    title: 'CommentInput',
    description: 'Comment schema used for input.',
    properties: {
        _id: schemas.objectIdOrEmpty,
        userId: schemas.objectId,
        objectId: schemas.objectId,
        text: {
            type: 'string'
        }
    },
    required: ['_id', 'userId', 'objectId', 'text'],
    additionalProperties: false
};
schemas.registerEntity(commentInputSchema);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var commentOutputSchema  = schemas.extendSchema(object.Object.extendSchema({
    id: 'commentOutput',
    type: 'object',
    title: 'CommentOutput',
    description: 'Comment schema used for output',
    properties: {
        userName: {
            type: 'string',
            minLength: 0
        }
    },
    required: ['userName'],
    additionalProperties: false
}), commentInputSchema);
schemas.registerEntity(commentOutputSchema);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var Comment = {
    input: {$ref: 'commentInput'},
    output: {$ref: 'commentOutput'},
    list: schemas.createListSchema('comments', {$ref: 'commentOutput'}),
    example: {
        _id: '550d84460b93524e14112345',
        userId: '550d84460b93524e14222344',
        objectId: '550d84463361bc0113580c08',
        userName: 'TestUserName',
        text: 'Hi',
        created: '2015-03-21 14:46:30.535',
        modified: '2015-03-21 14:46:30.535'
    },
    getCollection: function() {
        return server.db.collection('comments');
    },
    getSort: function() {
        return [['created', 1]];
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
Comment.save = _.partial(object.save, Comment);
Comment.loadById = _.partial(object.loadById, Comment);
Comment.removeById = _.partial(object.removeById, Comment);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
Comment.onBeforeSave = function(collection, comment, callback) {
    //todo: check all data
    var data = {
        userId: common.parseObjectID(comment.userId),
        objectId: common.parseObjectID(comment.objectId),
        text: common.stringUtils.trimAll(comment.text)
    }

    if(!data.userId) {
        return callback(new errors.InvalidParameter('Invalid userId'));
    }

    if(!data.objectId) {
        return callback(new errors.InvalidParameter('Invalid objectId'));
    }

    users.loadSystemById(data.userId, function(error) {
        if(error) return callback(error);
        return callback(null, data);
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
Comment.onAfterLoad = function(collection, comment, callback) {
    users.loadSystemById(comment.userId, function(error, user) {
        if(error) {
            return callback(error);
        }
        comment.userName = user.email;
        return callback(null, comment);
    })
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function removeAllByObjectId(objectId, callback) {
    var mongoObjectId = common.parseObjectID(objectId);
    if(!mongoObjectId) {
        logger.error('objectComments.removeAllByObjectId(): invalid objectId - ' + objectId);
        return callback(new errors.InvalidParameter('Invalid objectId.'));
    }
    Comment.getCollection().remove({objectId: mongoObjectId}, function(error) {
        if(error) {
            logger.error('objectComments.removeAllByObjectId(): error removing - ' + error.toString());
            return callback(new errors.Internal());
        }
        return callback();
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function loadAllByObjectId(objectId, callback) {
    var mongoObjectId = common.parseObjectID(objectId);
    if(!mongoObjectId) {
        logger.error('objectComments.loadAllByObjectId(): invalid objectId - ' + objectId);
        return callback(new errors.InvalidParameter('Invalid objectId.'));
    }
    object.loadAllByQuery(Comment, {objectId: mongoObjectId}, function(error, comments) {
        return callback(error, comments);
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
module.exports = {
    Comment: Comment,
    removeAllByObjectId: removeAllByObjectId,
    loadAllByObjectId: loadAllByObjectId
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
