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
var ObjectID = require('mongodb').ObjectID;
var common = require('./common.js');
var logger = require('./logger.js');
var database = require('./database.js');
var uuid = require('node-uuid');
var server = require('./server.js');
var files = require('./files.js');
var schemas = require('./schemas.js');
var history = require('./objectHistory.js');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.Object = {
    schema: {
        type: 'object',
        title: 'Object',
        description: 'Base class',
        properties: {
            created: schemas.created,
            modified: schemas.modified
        },
        required: ['created', 'modified'],
        additionalProperties: false
    },
    extendSchema: function(schema) {
        return schemas.extendSchema(schema, exports.Object.schema);
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.loadById = function(entity, objectId, callback) {
    if(!(objectId instanceof ObjectID)) {
        var parsedId = common.parseObjectID(objectId);
        if(!parsedId) {
            logger.error('object.loadById(): invalid object id: ' + objectId);
            return callback({type: 'invalid_parameter', message: 'Invalid objectId.'});
        }
        objectId = parsedId;
    }

    var collection = entity.getCollection();

    collection.findOne({_id : objectId}, function(error, object) {
        if(error) {
            logger.error('object.loadById(): error loading object - ' + error.toString());
            return callback({type: 'internal', message: 'Internal error.'});
        }
        if(!object) {
            logger.error('object.loadById(): Object not found. Id: ' + objectId);
            return callback({type: 'not_found', message: 'Object not found or invalid id.'});
        }

        if(entity.onAfterLoad) {
            return entity.onAfterLoad(collection, object, callback);
        }
        return callback(null, object);
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.save = function(entity, object, callback) {
    var collection = entity.getCollection();

    async.waterfall([
        // prepare for save
        function(callback) {
            if(entity.hasOwnProperty('onBeforeSave')) {
                entity.onBeforeSave(collection, object, function(error, data) {
                    return callback(error, data);
                });
            } else {
                return callback(null, object);
            }
        },
        // save
        function(data, callback) {
            //todo: use findAndModify
            if(object._id) {
                var id = common.parseObjectID(object._id);
                if(!id) {
                    return callback({type:'invalid_parameter', message:'Invalid id.'});
                }
                data.modified = common.generateTimestamp();

                var query = {_id: id};
                collection.update(query, {$set: data}, {safe: true}, function(error, updatedCount) {
                    if(error) {
                        logger.error('object.save(): error updating object - ' + error.toString());
                        return callback({type: 'internal', message: 'Internal error.'});
                    }
                    if(updatedCount === 0) {
                        logger.error('object.save(): error updating object, object not found. _id - ' + id);
                        return callback({type: 'not_found', message: 'Object not found.'});
                    }
                    if(updatedCount !== 1) {
                        logger.error('object.save(): invalid updated objects count - ' + updatedCount);
                        return callback({type: 'internal', message: 'Internal error.'});
                    }
                    return callback(null, id);
                });
            } else {
                data.created = common.generateTimestamp();
                data.modified = data.created;

                collection.insert(data, {safe: true}, function(error, results) {
                    if(error) {
                        logger.error('object.save(): error saving object - ' + error.toString());
                        return callback({type: 'internal', message: 'Internal error.'});
                    }
                    if(results.length !== 1) {
                        logger.error('object.save(): error saving object - ' + results.toString());
                        return callback({type: 'internal', message: 'Internal error.'});
                    }

                    return callback(null, results[0]._id);
                });
            }
        },
        // load
        function(id, callback) {
            return exports.loadById(entity, id, callback);
        },
        // mark parent as modified
        function(object, callback) {
            if(object.parentId && object.parentId != '') {
                exports.markAsModified(collection, object.parentId, function(error) {
                    return callback(error, object);
                });
            } else {
                return callback(null, object);
            }
        },
        // notify about saving
        function(object, callback) {
            if(entity.onAfterSave) {
                return entity.onAfterSave(collection, object, callback);
            }
            return callback(null, object);
        }
    ],
    function(error, object) {
        return callback(error, object);
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.saveWithHistory = function(entityName, entity, userId, object, callback) {
    var user = common.parseObjectID(userId);
    var operationType = object._id ? 'update' : 'insert';

    exports.save(entity, object, function(error, result) {
        if(error) return callback(error);

        return history.save(entityName, entity, userId, operationType, result, callback);
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.removeById = function(entity, objectId, callback) {
    var mongoId = common.parseObjectID(objectId);
    if(!mongoId) {
        return callback({type: 'invalid_parameter', message: 'Invalid objectId.'});
    }

    var collection = entity.getCollection();

    async.waterfall([
        // load and check children
        function(callback) {
            exports.loadById(entity, objectId, function(error, object) {
                if(error) {
                    return callback(error);
                }

                if(object.childCount > 0) {
                    return callback({type: 'invalid_parameter', message: 'Invalid objectId, there are child objects.'});
                }
                return callback(null, object);
            });
        },
        // notify object
        function(object, callback) {
            if(entity.onBeforeRemove) {
                entity.onBeforeRemove(collection, object, function(error) {
                    return callback(error, object);
                });
            } else {
                return callback(null, object);
            }
        },
        // remove
        function(object, callback) {
            collection.remove({_id: mongoId}, function(error, removed) {
                if(error) {
                    logger.error('object.remove(): error removing object - ' + error.toString());
                    return callback({type: 'internal', message: 'Internal error.'});
                }
                if(removed === 0) {
                    return callback({type: 'not_found', message: 'Object not found.'});
                }
                if(removed !== 1) {
                    logger.error('object.remove(): invalid records count removed - ' + removed);
                    return callback({type: 'internal', message: 'Internal error.'});
                }

                return callback(null, object);
            });
        },
        // remove image
        function(object, callback) {
            if(object.imageId) {
                files.remove(object.imageId, function(error) {
                    return callback(error, object);
                });
            } else {
                return callback(null, object);
            }
        },
        // notify parent
        function(object, callback) {
            if(object.parentId && object.parentId != '') {
                exports.markAsModified(collection, object.parentId, function(error) {
                    return callback(error, object);
                });
            } else {
                return callback(null, object);
            }
        },
        // notify object
        function(object, callback) {
            if(entity.onAfterRemove) {
                return entity.onAfterRemove(collection, object, callback);
            }
            return callback(null, object);
        }],
        function(error, object) {
            return callback(error, object);
        }
    );
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.removeByIdWithHistory = function(entityName, entity, userId, objectId, callback) {
    exports.removeById(entity, objectId, function(error, object) {
        if(error) return callback(error);
        return history.save(entityName, entity, userId, 'remove', object, callback);
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*exports.loadAll = function(collection, query, offset, limit, sortField, sortDescending, callback) {
    if(common.isString(collection)) {
        collection = server.db.collection(collection);
    }

    var paging = {
        offset: common.convertToNumber(offset),
        limit: common.convertToNumber(limit),
        sortField: sortField,
        sortDescending: common.parseBool(sortDescending)
    };

    if(!paging.limit || paging.limit < 0) {
        return callback({type: 'invalid_parameter', message: 'Invalid limit value.'});
    }

    var cursor = collection.find(query);
    cursor = pagedSearch.applyPagingToCursor(cursor, paging);
    cursor.toArray(function(error, items) {
        if(error || !items) {
            logger.error('object.loadAll(): error loading objects - ' + error.toString());
            return callback({type: 'internal', message: 'Internal error.'});
        }
        // get total count
        cursor.count(false, function(error, count) {
            if(error) {
                logger.error('object.loadAll(): error counting objects - ' + error.toString());
                return callback({type: 'internal', message: 'Internal error.'});
            }
            return callback(null, parseInt(count), items);
        });
    });
};*/

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.getFullImageUrl = function(imageUrl) {
    return imageUrl ? '/getImage/?id=' + imageUrl : '';
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*exports.getImageByImageUrl = function(collection, imageUrl, callback) {
    if(common.isString(collection)) {
        collection = server.db.collection(collection);
    }
    collection.findOne({imageUrl: imageUrl}, function(error, object) {
        if(error) {
            logger.error('object.getImageByImageUrl(): error finding object - ' + error.toString());
            return callback({type:'internal', message:'Internal error.'});
        }
        if(!object) {
            logger.error('object.getImageByImageUrl(): invalid image url - ' + imageUrl);
            return callback({type:'internal', message:'Internal error.'});
        }
        return callback(null, object.imageId);
    });
};*/

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.countChildren = function(object, collection, callback) {
    database.countDBRecords(collection, {parentId: object._id}, function(error, result) {
        if(error) {
            return callback(error);
        }
        object.childCount = result;
        return callback(null, object);
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.markAsModified = function(collection, objectId, callback) {
    return exports.updateById(collection, objectId, {}, callback);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.updateById = function(collection, objectId, data, callback) {
    if(common.isString(collection)) {
        collection = server.db.collection(collection);
    }

    var mongoId = common.parseObjectID(objectId);
    if(!mongoId) {
        return callback({type: 'invalid_parameter', message: 'Invalid Id.'});
    }

    data.modified = common.generateTimestamp();

    collection.update({_id: mongoId}, {$set: data}, {upsert: false, safe: true}, function(error, updatedCount) {
        if(error || updatedCount != 1) {
            logger.error('object.updateById(): error updating - ' + error + ' ' + updatedCount);
            return callback({type: 'internal', message: 'Internal error.'});
        }
        return callback();
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.updateAllByQuery = function(collection, query, data, callback) {
    if(common.isString(collection)) {
        collection = server.db.collection(collection);
    }

    if(_.has(data, '$set')) {
        data.$set.modified = common.generateTimestamp();
    } else {
        data.$set = {
            modified: common.generateTimestamp()
        };
    }

    collection.update(query, data, {upsert: false, safe: true, multi: true}, function(error) {
        if(error ) {
            logger.error('object.updateAllByQuery(): error updating - ' + error);
            return callback({type: 'internal', message: 'Internal error.'});
        }
        return callback();
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.processOnAfterLoad = function(entity, objects, callback) {
    if(!entity.onAfterLoad) {
        return callback(null, objects);
    }

    var collection = entity.getCollection();

    var actions = [];
    for(var i = 0; i < objects.length; ++i) {
        var object = objects[i];
        actions.push(async.apply(entity.onAfterLoad, collection, object));
    }
    async.parallel(actions, function(error) {
        if(error) {
            logger.error('object.processOnAfterLoad(): error processing objects - ' + error.toString());
            return callback({type: 'internal', message: 'Internal error.'});
        }
        return callback(null, objects);
    });
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.loadAllByQuery = function(entity, query, callback) {
    var collection = entity.getCollection();
    var sort = _.has(entity, 'getSort') ? entity.getSort() : [['order', 1], ['name', 1]];
    collection.find(query).sort(sort).toArray(function(error, objects) {
        if(error) {
            logger.error('object.loadAllByQuery(): error finding objects - ' + error.toString());
            return callback({type: 'internal', message: 'Internal error.'});
        }
        return exports.processOnAfterLoad(entity, objects, callback);
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.loadAllByQueryWithLimit = function(entity, query, limit, callback) {
    //todo: refactor with loadAllByQuery
    var collection = entity.getCollection();
    var sort = _.has(entity, 'getSort') ? entity.getSort() : [['order', 1], ['name', 1]];
    collection.find(query).limit(limit).sort(sort).toArray(function(error, objects) {
        if(error) {
            logger.error('object.loadAllByQueryWithLimit(): error finding objects - ' + error.toString());
            return callback({type: 'internal', message: 'Internal error.'});
        }
        return exports.processOnAfterLoad(entity, objects, callback);
    });
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.loadAllByParent = function(entity, parentId, callback) {
    var mongoId = common.parseObjectID(parentId);
    if(!mongoId) {
        mongoId = '';
    }

    var query = {};
    if(entity.hasOwnProperty('getParentIdFieldName')) {
        query[entity.getParentIdFieldName()] = mongoId;
    } else {
        query.parentId = mongoId;
    }

    return exports.loadAllByQuery(entity, query, callback);
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.loadAllVisibleByParent = function(entity, parentId, callback) {
    var mongoId = common.parseObjectID(parentId);
    if(!mongoId) {
        mongoId = '';
    }

    var query = {};
    if(entity.hasOwnProperty('getParentIdFieldName')) {
        query[entity.getParentIdFieldName()] = mongoId;
    } else {
        query.parentId = mongoId;
    }

    if(entity.hasOwnProperty('getVisibleFieldName')) {
        query[entity.getVisibleFieldName()] = true;
    } else {
        query.visible = true;
    }

    return exports.loadAllByQuery(entity, query, callback);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.findByQuery = function(collection, query, callback) {
    if(!query) {
        return callback();
    }
    if(common.isString(collection)) {
        collection = server.db.collection(collection);
    }
    collection.find(query).toArray(function(error, objects) {
        if(error) {
            logger.error('object.findByQuery(): error finding objects - ' + error.toString());
            return callback({type: 'internal', message: 'Internal error.'});
        }
        return callback(null, objects);
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.findByQueryWithLimit = function(collection, query, limit, callback) {
    //todo: refactor with findByQuery
    if(!query) {
        return callback();
    }
    if(common.isString(collection)) {
        collection = server.db.collection(collection);
    }
    collection.find(query).limit(limit).toArray(function(error, objects) {
        if(error) {
            logger.error('object.findByQueryWithLimit(): error finding objects - ' + error.toString());
            return callback({type: 'internal', message: 'Internal error.'});
        }
        return callback(null, objects);
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.loadByQuery = function(collection, query, callback) {
    exports.findByQuery(collection, query, function(error, objects) {
        if(error) {
            return callback(error);
        }
        if(!objects.length || objects.length > 1) {
            logger.error('object.loadByQuery(): invalid results count - ' + objects.length);
            return callback({type: 'internal', message: 'Internal error.'});
        }
        return callback(null, objects[0]);
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.countByQuery = function(collection, query, callback) {
    if(common.isString(collection)) {
        collection = server.db.collection(collection);
    }
    return database.countDBRecords(collection, query, callback);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.isExist = function(entity, objectId, callback) {
    var mongoId = common.parseObjectID(objectId);
    if(!mongoId) {
        return callback(null, false);
    }
    return exports.countByQuery(entity.getCollection(), {_id: mongoId}, function(error, count) {
        return callback(error, count > 0);
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
