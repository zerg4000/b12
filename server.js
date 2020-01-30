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

var express = require('express');
var https = require('https');
var http = require('http');
var async = require('async');
var _ = require('underscore');
var uuid = require('node-uuid');
var jsonBuilder = require('./jsonBuilder');
var socketio = require('socket.io');
var fs = require('fs');
var compression = require('compression');
var bodyParser = require('body-parser');
var multiparty = require('connect-multiparty');
var database = require("./database.js");
var apiRegistrar = require('./APIRegistrar.js');
var logger = require('./logger.js');
var common = require('./common.js');
var devicesAPI = require('./devices.js');
var settings = require('./settings.js');
var schemaValidator = require('./schemaValidator.js');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.app = express();
exports.app.use(compression());
exports.app.disable('x-powered-by');
exports.app.use(bodyParser.json({limit: '1mb'}));
exports.app.use(bodyParser.urlencoded({extended: false}));
exports.app.use(multiparty());
exports.app.use(function(request, response, next) {
    if(request.body._data) {
        var data = JSON.parse(request.body._data);
        delete request.body._data;
        _.extend(request.body, data);
    }
    next();
});
exports.app.use(function(error, message, response, next) {
    //todo: function should be with 4 parameters...
    logger.error('Invalid request. Path: %s', message.originalUrl);
    response.status(400).send('Invalid request');
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var onStartFunctions = [];
var requestProcessorFunctions = [];

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.settings = settings.get();

if(exports.settings.CORS) {
    logger.verbose('server: adding CORS - ' + JSON.stringify(exports.settings.CORS));
    exports.app.use(function(request, response, next) {
        response.header('Access-Control-Allow-Origin',  exports.settings.CORS.origin);
        response.header('Access-Control-Allow-Methods', exports.settings.CORS.methods);
        response.header('Access-Control-Allow-Headers', exports.settings.CORS.headers);

        next();
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.db = null;
var isPrivate;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.getVersion = function() {
    return exports.settings.VERSION || '0.9';
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.onStart = function(func) {
    onStartFunctions.push(func);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.addRequestProcessor = function(func) {
    requestProcessorFunctions.push(func);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
process.on('uncaughtException', function(error) {
    logger.error('Exception: ' + error.stack, function() {
        setTimeout(function() {
            // Only for Win32 - we need to wait when logger flushed
            process.exit(-1);
        }, 200);
    });
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function checkSession(request, callback) {
    if(!request.body.session) {
        return callback();
    }

    if(!request.body.session) {
        return callback({type: 'invalid_session', message: 'Invalid session.'});
    }

    var sessions = exports.db.collection(isPrivate ? 'syssessions' : 'sessions');
    sessions.findOne({session: request.body.session}, function(error, session) {
        if(error) {
            logger.error('server.checkSession(): error loading session: ' + error.toString());
            return callback({type: 'internal', message: 'Internal error.'});
        }

        if(!session) {
            logger.error('server.checkSession(): session not found: ' + request.body.session);
            return callback({type: 'invalid_session', message: 'Not logged on.'});
        }

        request.session = session;
        return callback();
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.enableSocketIO = false;
exports.disableDefaultCollections = false;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function createIndexes(callback) {
    if(exports.disableDefaultCollections) {
        return callback();
    }

    async.each([
            ['syssessions', 'userId', {}],
            ['syssessions', 'session', {unique: true}],
            ['sysusers', 'email', {}],
            ['sysusers', 'created', {}],
            ['sessions', 'userId', {}],
            ['sessions', 'deviceId', {}],
            ['sessions', 'session', {unique: true}],
            ['devices', 'nativeId', {}],
            ['devices', 'platform', {}],
            ['devices', 'osVersion', {}],
            ['devices', 'name', {}],
            ['users', 'email', {unique: true}],
            ['users', 'restorePasswordToken', {}],
            ['users', 'created', {}],
            ['filesUrls', 'fileId', {unique: true}],
            ['filesUrls', 'url', {unique: true}],
            ['counters', 'name', {unique: true}],
            ['history', 'userId', {}],
            ['history', 'objectId', {}],
            ['history', 'objectName', {}],
            ['variables', 'name', {unique: true}]
        ],
        function(item, innerCallback) {
            exports.db.collection(item[0]).ensureIndex(item[1], item[2], innerCallback);
        },
        callback);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.addRequestProcessor(checkSession);
exports.onStart(createIndexes);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var runHttpServers = function(port, httpsPort)
{
    var httpServer = http.createServer(exports.app).listen(port);
    if(exports.enableSocketIO) {
        exports.io = socketio(httpServer);
    }

    if(httpsPort) {
        try {
            var options = {
                key: fs.readFileSync('key.pem'),
                cert: fs.readFileSync('cert.pem')
            };
        } catch(error) {
            logger.error('server: error opening ssl certificate files: ' + error.toString());
            logger.error('server: https server failed to start.');
            return;
        }
        https.createServer(options, exports.app).listen(httpsPort);
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var startListening = function(serverName, callback) {
    var port = isPrivate ? exports.settings.WWW_PRIVATE_PORT : exports.settings.WWW_PUBLIC_PORT;
    var httpsPort = isPrivate ? exports.settings.WWW_PRIVATE_HTTPS_PORT : exports.settings.WWW_PUBLIC_HTTPS_PORT;
    var cluster = require('cluster');
    
    if(cluster.isMaster) {
        logger.info(serverName + ' server is starting...');
        logger.info('\tAPI:        ' + (isPrivate ? 'private' : 'public'));
        logger.info('\tport:       ' + port);
        logger.info('\thttps port: ' + httpsPort);
        logger.info('\tdatabase:   ' + exports.settings.DB_NAME + ' on ' + exports.settings.DB_SERVER + ':' + exports.settings.DB_PORT);

        if(exports.settings.RUN_CLUSTER) {
            var numCPUs = require('os').cpus().length;
            for(var i = 0; i < numCPUs; ++i) {
                cluster.fork();
            }

            cluster.on('death', function(worker) {
                logger.warn('Worker ' + worker.pid + ' died. Restarting...');
                cluster.fork();
            });
        } else {
            logger.info('Single instance started');
            runHttpServers(port, httpsPort);
            return callback();
        }
    } else {
        logger.info('Child instance started');
        runHttpServers(port, httpsPort);
        return callback();
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// open database and start the server
exports.run = function(serverName, privateVer, callback) {
    if(isPrivate !== undefined) {
        return;
    }
    isPrivate = privateVer;

    database.open(function(error, database) {
        if(error) {
            logger.error('server: failed to open database: ' + error.toString());
            throw new Error('Failed to open database: ' + error.toString());
        }

        exports.db = database;
        startListening(serverName, function(error) {
            if(error) {
                logger.error('server: failed to start server: ' + error.toString());
                throw new Error('Failed to start server: ' + error.toString());
            }

                async.series(onStartFunctions, function(error) {
                if(error) {
                    logger.error('server: error in start functions: ' + JSON.stringify(error));
                    throw new Error('Failed to start server - ' + JSON.stringify(error));
                }

                if(callback) callback();
            });
        });
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function maskPassword(object) {
    _.each(object, function(value, key) {
        if(_.isObject(value) || _.isArray(value)) {
            maskPassword(value);
        } else if (_.isString(value) && key == 'password') {
            object[key] = '****';
        }
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var apiCall = function(meta, impl, request, result) {
    var profilingStartTS = common.currentDateTime();

    var requestURL = request.url;
    result.header('content-type', 'application/json');
    var out = jsonBuilder.stream(result);
    out.map().key('result').map();
    impl(out, request, function(error) {
        out.close();

        var status;
        if(!error) {
            status = {error: 'ok', errorMessage: ''};
        } else if(meta.info.errors && !meta.info.errors[error.type]) {
            logger.error('server: unexpected error: ' + JSON.stringify(error));
            status = {error: 'internal', errorMessage: 'Unexpected error: ' + error.type};
        } else {
            status = {error:error.type, errorMessage: JSON.stringify(error.message)};
        }

        out.key('status').val(status);
        out.close();
        result.end();

        var statusString;
        if(error) {
            statusString = 'ERROR: ' + status.errorMessage;
        }
        else{
            statusString = 'Success.';
        }

        var profilingDelta = common.currentDateTime() - profilingStartTS;
        //todo: disable for production
        var requestInfo = 'ip: ' + request.connection.remoteAddress;
        if(request.session) {
            requestInfo += ', session: ' + request.session.session + ', user: ' + request.session.userId;
        }
        logger.info('Request[' + requestInfo + ']: ' + requestURL + (request.sslUsed ? ' (https). ' : ' (http). ') + statusString + ' [' + profilingDelta + ' ms]');
        if(error){
            // no password in logs
            maskPassword(request.body);
            logger.error("Body[" + requestInfo + "]: " + JSON.stringify(request.body));
        }
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var checkSSL = function(forced, request, callback) {
    request.sslUsed = request.connection && request.connection.pair && request.connection.pair._secureEstablished;
    if(forced && !request.sslUsed){
        return callback({type: 'ssl_required', message: 'SSL connection required for this method.'});
    }

    return callback();
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function checkRequest(jsonSchema, request, callback) {
    if(request.body === null) {
        return callback({type: 'invalid_parameter', message: 'Request is empty.'});
    }
    //todo: trim strings
    //todo: escape all HTML tags
    return schemaValidator.validateInput(request.body, jsonSchema, callback);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function checkResultSchema(jsonSchema, result, callback) {
    if(exports.settings.IS_DEBUG) {
        try {
            // we have incomplete json, so we need to add ending brackets
            var parsedResult = JSON.parse(result.getDebugBuffer() + '}}');
        } catch(error) {
            logger.error('server.checkResultSchema(): parsing error - ' + error.toString());
            return callback({type: 'internal', message: 'Internal error'});
        }
        return schemaValidator.validateOutput(parsedResult.result, jsonSchema, callback);
    }
    return callback();
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var applyRequestProcessors = function(request, callback) {
    async.applyEachSeries(requestProcessorFunctions, request, callback);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function objectIdParserImpl(str) {
    if(!str) return null;
    var result = common.parseObjectID(str);
    if(!result) {
        var error = new Error('Invalid objectId.');
        error.fieldName = '';
        error.objectId = str;
        throw error;
    }
    return result;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function emptyParser(param) {
    return param;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function isObjectIdSchema(schema) {
    return _.contains(['objectId', 'objectIdOrEmpty'], schema.format);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.makeObjectIdParser = function(schema) {
    if(isObjectIdSchema(schema)) {
        return objectIdParserImpl;
    }

    if(schema.$ref) {
        var entity = apiRegistrar.getEntities()[schema.$ref];
        return exports.makeObjectIdParser(entity);
    }

    var operations = [];
    for(var name in schema.properties) {
        var info = schema.properties[name];
        if(info.type == 'object') {
            var subParser = exports.makeObjectIdParser(info);
            if(subParser !== emptyParser) {
                operations.push(_.partial(function(parser, name, object) {
                    var subValue = object[name];
                    if (subValue) {
                        return parser(subValue);
                    }
                }, subParser, name));
            }
        } else if(info.type == 'array') {
            subParser = exports.makeObjectIdParser(info.items);
            if(subParser !== emptyParser) {
                operations.push(_.partial(function(parser, name, object) {
                    var property = object[name];
                    for(var i in property) {
                        var item = property[i];
                        if(item) {
                            property[i] = parser(item);
                        }
                    }
                    return object;
                }, subParser, name));
            }
        } else if(isObjectIdSchema(info)) {
            operations.push(_.partial(function(name, object) {
                var value = object[name];
                if(!value) {
                    return null;
                }

                var objectId = common.parseObjectID(value);
                if(objectId) {
                    object[name] = objectId;
                } else {
                    var error = new Error('Invalid objectId.');
                    error.fieldName = name;
                    error.objectId = value;
                    throw error;
                }
            }, name));
        }
    }

    if(operations.length == 0) return emptyParser;
    return function objectIdParserImpl(object) {
        for(var i in operations) {
            operations[i](object);
        }
        return object;
    };
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.enableObjectIDParsing = false;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var makeObjectIdParser = function(schema) {
    if(!exports.enableObjectIDParsing) {
        return function(object) {};
    }

    return exports.makeObjectIdParser(schema);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var parseObjectIds = function(parser, body, callback) {
    if(!exports.enableObjectIDParsing) {
        return callback();
    }

    var error = parser(body);
    if(error) {
        logger.error('Got invalid objectId \'' + error.objectId + '\' in field \'' + error.fieldName + '\'.');
        return callback({error: 'invalid_parameter', message: 'Invalid id: ' + JSON.stringify(error.objectId) + '.'});
    }

    callback();
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var makeApiCall = function(meta, impl) {
    var parser = makeObjectIdParser(meta.input);
    return async.apply(apiCall, meta, function(result, request, callback) {
        async.series([
            async.apply(checkSSL, meta.info.forcedSSL, request),
            async.apply(checkRequest, meta.input, request),
            async.apply(parseObjectIds, parser, request.body),
            async.apply(applyRequestProcessors, request),
            async.apply(impl, result, request),
            async.apply(checkResultSchema, meta.output, result)
        ],
        callback)
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.registerMethod = function(name, meta, impl) {
    if(!apiRegistrar.registerMethod(name, meta)) {
        process.exit(-1);
    }
    exports.app.post('/' + name, makeApiCall(meta, impl));
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.hashPassword = function(password) {
    return common.hashPassword(password);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.verifyPassword = function(password, hashedPassword) {
    return common.verifyPassword(password, hashedPassword);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var doPublicLogin = function(result, user, request, callback) {
    var data = request.body;
    var devices = exports.db.collection('devices');
    devicesAPI.loadOrCreate(data.deviceNativeId, data.devicePlatform, data.deviceOsVersion, data.deviceName, function(error, device) {
        if(error) {
            return callback(error);
        }

        var sessionData = {
            userId: user._id,
            session: uuid.v1(),
            time: new Date().toUTCString(),
            ip: request.connection.remoteAddress,
            deviceId: device._id,
            version: data.version
        };

        var sessions = exports.db.collection('sessions');
    
        // cleanup old sessions
        sessions.remove({userId: user._id, deviceId: device._id, version: data.version, time:{$lt:sessionData.time}}, function(error){});

        sessions.save(sessionData, {safe:true}, function(error, session) {
            if(error || !session) {
                logger.error('server.doPublicLogin(): error creating session: ' + JSON.stringify(error));
                return callback({type: 'internal', message: 'Internal error.'});
            }

            result.key('session');
            result.val(session.session);
            result.key('version');
            result.val(exports.getVersion());
            return callback();
        });
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var doSystemLogin = function(result, user, request, callback) {
    if(_.isEmpty(user.roles)) {
        logger.error('server.doSystemLogin(): invalid user roles list - ' + JSON.stringify(user));
        return callback({type: 'invalid_user', message: 'Login failed, invalid user roles list.'});
    }

    var sessionData = {
        userId: user._id,
        session: uuid.v1(),
        time: new Date().toUTCString(),
        ip: request.connection.remoteAddress
    };

    var sessions = exports.db.collection('syssessions');

    // cleanup old sessions
    sessions.remove({userId: user._id, time:{$lt: sessionData.time}}, function(error) {
        if(error) {
            logger.error('server.doSystemLogin(): error clearing old sessions - ' + error.toString());
        }
    });

    sessions.save(sessionData, {safe: true}, function(error, session) {
        if(error || !session) {
            logger.error('server.doSystemLogin(): error creating session - ' + error);
            return callback({type: 'internal', message: 'Internal error.'});
        }

        result.key('session');
        result.val(session.session);
        result.key('version');
        result.val(exports.getVersion());
        result.key('roles');
        result.val(user.roles);
        return callback();
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.login = function(result, request, isSystem, callback) {
    var users = exports.db.collection(isSystem ? 'sysusers' : 'users');
    var data = request.body;

    logger.info('server.login(): user ' + data.email + ' from ' +  request.connection.remoteAddress + ' is logging in.');
    users.findOne({email: common.prepareStringForCompare(data.email)}, function(error, user) {
        if(error) {
            logger.error('server.login(): error ' + error.toString());
            return callback({type: 'internal', message: 'Internal error.'});
        }
        if(!user || !exports.verifyPassword(data.password, user.password)) {
            logger.error('server.login(): invalid user ' + data.email);
            return callback({type: 'invalid_user', message: 'Login failed, invalid user or password.'});
        }
        if(!user.active) {
            logger.error('server.login(): disabled user ' + data.email);
            return callback({type: 'disabled_user', message: 'Login failed, user disabled.'});
        }

        if(isSystem) {
            doSystemLogin(result, user, request, callback);
        } else {
            doPublicLogin(result, user, request, callback);
        }
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.logout = function(result, request, isSystem, callback) {
    if(!request.body.session) {
        logger.error('server.logout(): invalid session - ' + JSON.stringify(request.body.session));
        return callback({type: 'invalid_parameter', message: 'Invalid session.'});
    }

    logger.info('server.logout(): user ' + JSON.stringify(request.body.session) + ' is logging out.');

    var sessions = exports.db.collection(isSystem ? 'syssessions' : 'sessions');

    sessions.remove({session: request.body.session}, function(error) {
        if(error) {
            logger.error('server.logout(): error clearing sessions - ' + error.toString());
            return callback({type: 'internal', message: 'Internal error.'});
        }
        return callback();
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.removeSessions = function(userId, isSystem, callback) {
    var sessions = exports.db.collection(isSystem ? 'syssessions' : 'sessions');

    sessions.remove({userId: userId}, function(error) {
        if(error) {
            logger.error('server.removeSessions() error removing sessions - ' + error.toString());
            return callback({type: 'internal', message: 'Internal error.'});
        }
        return callback();
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
