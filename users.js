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
var uuid = require('node-uuid');
var common = require('./common.js');
var server = require('./server.js');
var logger = require('./logger.js');
var object = require('./object.js');
var schemas = require('./schemas.js');
var database = require('./database.js');
var devicesAPI = require('./devices.js');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var rolesList = ['admin', 'manager', 'content', 'system'];
var rolesSchema = {
    type: 'array',
        items: {
        type: 'string',
        enum: rolesList
    },
    minItems: 1,
    uniqueItems: true
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var inputSystemUserSchema = {
    id: 'systemUserInput',
    type: 'object',
    title: 'SystemUserInput',
    description: 'System user used for input',
    properties: {
        _id: schemas.objectIdOrEmpty,
        email: {
            type: 'string',
            format: 'email'
        },
        active: {
            type: 'boolean'
        },
        password: {
            type: 'string' //todo: create rules
        },
        roles: rolesSchema
    },
    required: ['_id', 'email', 'active', 'roles'],
    additionalProperties: false
};
schemas.registerEntity(inputSystemUserSchema);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var outputSystemUserSchema  = schemas.extendSchema(object.Object.extendSchema({
    id: 'systemUserOutput',
    type: 'object',
    title: 'SystemUserOutput',
    description: 'System User used for output',
    properties: {},
    required: [],
    additionalProperties: false
}), inputSystemUserSchema);
schemas.registerEntity(outputSystemUserSchema);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.SystemUser = {
    input: {'$ref': 'systemUserInput'},
    output: {'$ref': 'systemUserOutput'},
    list: schemas.createListSchema('users', {'$ref': 'systemUserOutput'}),
    rolesList: rolesList,
    rolesSchema: rolesSchema,
    example: {
        _id: '520a750f46b783db91c4e935',
        active: true,
        email: 'anna.ometova@quantron-systems.com',
        roles: ['admin'],
        created: '2014-01-21 11:46:59.940',
        modified: '2014-01-21 11:46:59.940'
    },
    getCollection: function() {
        return server.db.collection('sysusers');
    },
    onBeforeSave: onBeforeSave,
    onAfterSave: function(collection, user, callback) {
        server.removeSessions(user._id, true, function(error) {
            return callback(error, user);
        });
    },
    onAfterLoad: function(collection, user, callback) {
        delete user.password;
        return callback(null, user);
    },
    onBeforeRemove: function(collection, user, callback) {
        return server.removeSessions(user._id, true, callback);
    },
    onAfterRemove: function(collection, user, callback) {
        return callback(null, user);
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var inputPublicUserSchema = {
    id: 'publicUserInput',
    type: 'object',
    title: 'PublicUserInput',
    description: 'Public User used for input',
    properties: {
        _id: schemas.objectIdOrEmpty,
        email: {
            type: 'string',
            format: 'email'
        },
        active: {
            type: 'boolean'
        },
        password: {
            type: 'string' //todo: create rules
        },
        name: {
            type: 'string',
            minLength: 3,
            maxLength: 64
        }
    },
    required: ['_id', 'email', 'active', 'name'],
    additionalProperties: false
};
schemas.registerEntity(inputPublicUserSchema);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var outputPublicUserSchema  = schemas.extendSchema(object.Object.extendSchema({
    id: 'publicUserOutput',
    type: 'object',
    title: 'PublicUserOutput',
    description: 'Public User used for output',
    properties: {},
    required: [],
    additionalProperties: false
}), inputPublicUserSchema);
schemas.registerEntity(outputPublicUserSchema);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.PublicUser = {
    input: {'$ref': 'publicUserInput'},
    output: {'$ref': 'publicUserOutput'},
    list: schemas.createListSchema('users', {'$ref': 'publicUserOutput'}),
    example: {
        _id: '52121e36bf88b0d00a00000a',
        email: 'user@tt.com',
        name: 'Test User Name',
        active: true,
        created: '2014-01-21 11:46:59.940',
        modified: '2014-01-21 11:46:59.940'
    },
    getCollection: function() {
        return server.db.collection('users');
    },
    onBeforeSave: function(collection, user, callback) {
        return onBeforeSave(collection, user, callback);
    },
    onAfterSave: function(collection, user, callback) {
        return callback(null, user);
    },
    onAfterLoad: function(collection, user, callback) {
        delete user.password;
        delete user.restorePasswordEndTime;
        delete user.restorePasswordToken;
        return callback(null, user);
    },
    onBeforeRemove: function(collection, user, callback) {
        return server.removeSessions(user._id, false, callback);
    },
    onAfterRemove: function(collection, user, callback) {
        return callback(null, user);
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function onBeforeSave(collection, user, callback) {
    if(!common.validateEmail(user.email)) {
        return callback({type: 'invalid_parameter', message: 'Invalid email.'});
    }
    var data = {
        email: common.prepareStringForCompare(user.email)
    };

    if(user.hasOwnProperty('active')) {
        data.active = user.active;
    }

    loadByEmail(collection, data.email, function(error, loaded) {
        if(error) {
            return callback(error);
        }
        if(loaded && loaded._id.toString() != user._id) {
            return callback({type: 'already_exists', message: 'User already exists.'});
        }
        if(user.password && user.password.length > 0) {
            if(!common.validatePassword(user.password)) {
                return callback({type: 'weak_password', message: 'Password is invalid.'});
            }
            data.password = server.hashPassword(user.password);
        }
        if(user.name) {
            data.name = user.name;
        }
        if(user.roles) {
            data.roles = common.clone(user.roles);
        }
        return callback(null, data);
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function getResetPasswordAliveHours() {
    return (server.settings.RESTORE_PASSWORD_HOURS || 12);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function loadByTokenAndVerify(collection, token, callback) {
    var query = {restorePasswordToken : token};

    collection.findOne(query, function(error, user) {
        if(error) {
            logger.error('loadByTokenAndVerify(): error loading user - ' + error.toString());
            return callback(error);
        }
        if(!user) {
            logger.info('loadByTokenAndVerify(): restorePasswordToken is invalid - ' + token);
            return callback({type: 'invalid_parameter', message: 'Invalid token.'});
        }
        var dateNow = common.formatDate(Date.now());
        if(!user.restorePasswordEndTime || user.restorePasswordEndTime < dateNow) {
            logger.info('loadByTokenAndVerify(): restorePasswordToken is dead - ' + token
                + ' (' + dateNow + ' > ' + user.restorePasswordEndTime + ')');
            return callback({type: 'invalid_parameter', message: 'Invalid token.'});
        }
        return callback(null, user);
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function loadByEmail(collection, email, callback) {
    if(!common.validateEmail(email)) {
        return callback({type: 'invalid_parameter', message: 'Invalid email.'});
    }
    var query = {email : common.prepareStringForCompare(email)};

    collection.findOne(query, function(error, user) {
        if(error) {
            logger.error('loadByEmail(): error loading user - ' + error.toString());
            return callback(error);
        }
        return callback(null, user);
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.getActiveUsersCount = function(callback) {
    return database.countDBRecords(server.db.collection('users'), {active: true}, callback);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.getInactiveUsersCount = function(callback) {
    return database.countDBRecords(server.db.collection('users'), {active: false}, callback);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.getSystemUsersCount = function(callback) {
    return database.countDBRecords(server.db.collection('sysusers'), {}, callback);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.saveSystem = async.apply(object.save, exports.SystemUser);
exports.savePublic = async.apply(object.save, exports.PublicUser);
exports.loadSystemById = async.apply(object.loadById, exports.SystemUser);
exports.loadPublicById = async.apply(object.loadById, exports.PublicUser);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.loadPublicByEmail = function(email, callback) {
    var collection = server.db.collection('users');
    loadByEmail(collection, email, function(error, user) {
        if(error) {
            return callback(error);
        }
        if(!user) {
            return callback({type: 'invalid_parameter', message: 'Invalid email'});
        }
        //todo: onAfterLoad?
        return callback(null, user);
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.saveRestorePasswordToken = function(userId, callback) {
    var mongoId = common.parseObjectID(userId);
    if(!mongoId) {
        return callback({type: 'invalid_parameter', message: 'Invalid user.'});
    }
    var token = uuid.v1();
    var collection = server.db.collection('users');
    var params = {
        $set: {
            restorePasswordToken: token,
            restorePasswordEndTime: common.formatDate(Date.now() + getResetPasswordAliveHours() * 60 * 60 * 1000)
        }
    };
    collection.update({_id: mongoId}, params, {upsert: false, safe: true}, function(error, updatedCount) {
        if(error || updatedCount != 1) {
            logger.error('Error saving public user: ' + JSON.stringify(error) + ' ' + updatedCount);
            return callback({type: 'internal', message: 'Internal error.'});
        }
        return callback(null, token, getResetPasswordAliveHours());
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.verifyRestorePasswordToken = function(token, callback) {
    loadByTokenAndVerify(server.db.collection('users'), token, function(error, user) {
        if(error) {
            return callback(error);
        }
        return callback(null, user.email);
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.confirmRestorePassword = function(token, password, callback) {
    if(!common.validatePassword(password)) {
        return callback({type: 'weak_password', message: 'Invalid password.'});
    }
    var collection = server.db.collection('users');
    loadByTokenAndVerify(collection, token, function(error, user) {
        if(error) {
            return callback(error);
        }
        var params = {
            $set: {
                restorePasswordToken: '',
                restorePasswordEndTime: '',
                password: server.hashPassword(password)
            }
        };
        collection.update({_id: user._id}, params, {upsert: false, safe: true}, function(error, updatedCount) {
            if(error || updatedCount != 1) {
                logger.error('confirmRestorePassword(): error saving public user: ' + error + ' ' + updatedCount);
                return callback({type: 'internal', message: 'Internal error.'});
            }
            return callback();
        });
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.removeSystem = async.apply(object.removeById, exports.SystemUser);
exports.removePublic = async.apply(object.removeById, exports.PublicUser);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.changePublicPassword = function(userId, oldPassword, newPassword, callback) {
    var mongoId = common.parseObjectID(userId);
    if(!mongoId) {
        return callback({type: 'invalid_parameter', message: 'Invalid userId.'});
    }
    if(!common.validatePassword(newPassword)) {
        return callback({type: 'weak_password', message: 'Invalid password.'});
    }

    var collection = server.db.collection('users');
    collection.findOne({_id: mongoId}, function(error, user) {
        if(error) {
            return callback(error);
        }
        if(!user) {
            return callback({type: 'not_found', message: 'Invalid userId.'});
        }
        if(!server.verifyPassword(oldPassword, user.password)) {
            return callback({type: 'invalid_parameter', message: 'Invalid oldPassword.'});
        }
        collection.update({_id: user._id},
            {
                $set: {
                    password: server.hashPassword(newPassword),
                    modified: common.generateTimestamp()
                }
            },
            {upsert: false, safe: true},
            function(error, updatedCount) {
                if(error || updatedCount != 1) {
                    logger.error('Error saving public user: ' + JSON.stringify(error) + ' ' + updatedCount);
                    return callback({type: 'internal', message: 'Internal error.'});
                }
                return callback();
            }
        );
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.loadDevices = function(userId, callback) {
    var mongoId = common.parseObjectID(userId);
    if(!mongoId) {
        return callback({type: 'invalid_parameter', message: 'Invalid userId.'});
    }

    server.db.collection('sessions').find({userId: mongoId}).toArray(function(error, sessions) {
        if(error) {
            logger.error('loadDevices(): error loading devices - ' + error.toString());
            return callback({type:'internal', message:'Internal error'});
        }
        var devices = [];
        async.each(sessions, function(session, callback) {
                devicesAPI.loadById(session.deviceId, function(error, device) {
                    if(error) {
                        return callback(error);
                    }
                    devices.push(device);
                    return callback();
                });
            },
            function(error) {
                if(error) {
                    return callback(error);
                }
                return callback(null, devices);
            });
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.findSystemUsersByRole = function(role, callback) {
    object.findByQuery('sysusers', {roles: role}, callback);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
