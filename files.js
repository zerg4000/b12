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
var ObjectID = require('mongodb').ObjectID;
var GridStore = require('mongodb').GridStore;
var common = require('./common.js');
var server = require('./server.js');
var logger = require('./logger.js');
var http = require('./http.js');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var openById = function(fileId, forWrite, callback) {
    var gridStore = new GridStore(server.db, fileId.toString(), forWrite ? 'w' : 'r');
    gridStore.open(function(error, gridStore) {
        if(error) {
            logger.error('files.openById(): error opening file - ' + fileId + ', error - ' + error.toString());
            return callback({type: 'not_found', message: 'Invalid fileId.'});
        }
        return callback(null, gridStore);
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.loadById = function(_id, callback) {
    var mongoId = common.parseObjectID(_id);
    if(!mongoId) {
        return callback({type: 'invalid_parameter', message: 'Invalid fileId.'});
    }

    openById(mongoId, false, function(error, gridStore) {
        if(error) {
            return callback(error);
        }
        var buffer = new Buffer(gridStore.length);
        gridStore.read(gridStore.length, buffer, function(error, data) {
            if(error) {
                logger.error('files.loadById(): error reading file - ' + _id + ', ' + error.toString());
                return callback({type: 'internal', message: 'Internal FS error.'});
            }
            var file = gridStore.metadata;
            file._id = mongoId;
            gridStore.close(function() {
                return callback(null, file, data);
            });
        });
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.getReadableGridStoreByUrl = function(url, callback) {
    findMap(url, function(error, fileId) {
        if(error) {
            return callback(error);
        }

        if(!fileId) {
            return callback({type: 'invalid_parameter', message: 'Unknown url.'});
        }

        return openById(fileId, false, callback);
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.getReadStreamById = function(_id, callback) {
    var mongoId = common.parseObjectID(_id);
    if(!mongoId) {
        return callback({type: 'invalid_parameter', message: 'Invalid fileId.'});
    }

    openById(mongoId, false, function(error, gridStore) {
        if(error) {
            return callback(error);
        }
        return callback(null, gridStore.stream(true));
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.isExist = function(_id, callback) {
    var mongoId = common.parseObjectID(_id);
    if(!mongoId) {
        return callback({type: 'invalid_parameter', message: 'Invalid fileId.'});
    }

    var query = {filename : _id.toString()};

    server.db.collection('fs.files').findOne(query, function(error, file) {
        if(error) {
            logger.error('files.isExist(): error finding file - ' + error.toString());
            return callback({type: 'internal', message: 'Internal error.'});
        }
        return callback(null, !!file);
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function updateMap(fileId, callback) {
    server.db.collection('filesUrls').findAndModify(
        {fileId: fileId},
        [],
        {$set: {fileId: fileId, url: uuid.v1()}},
        {upsert: true, new: true},
        function(error, object) {
            if(error) {
                logger.error('files.updateMap(): error updating file to url map - ' + error.toString());
                return callback({type: 'internal', message: 'Internal error.'});
            }
            return callback(null, object.url);
        }
    );
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function removeMap(fileId, callback) {
    server.db.collection('filesUrls').remove({fileId: fileId}, function(error, removed) {
        if(error) {
            logger.error('files.updateMap(): error clearing file to url map - ' + error.toString());
            return callback({type: 'internal', message: 'Internal error.'});
        }
        if(removed !== 1) {
            logger.error('files.updateMap(): error clearing file to url map, inconsistent data');
            return callback({type: 'internal', message: 'Internal error.'});
        }
        return callback();
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function findMap(url, callback) {
    server.db.collection('filesUrls').findOne({url: url}, function(error, object) {
        if(error) {
            logger.error('files.findMap(): error finding in file to url map - ' + error.toString());
            return callback({type: 'internal', message: 'Internal error.'});
        }
        if(!object) {
            return callback();
        }
        return callback(null, object.fileId);
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.save = function(_id, type, contentType, name, description, fileName, callback) {
    var mongoId = common.parseObjectID(_id);
    if(!mongoId) {
        mongoId = common.generateObjectID();
    }
    openById(mongoId, true, function(error, gridStore) {
        if(error) {
            return callback(error);
        }

        gridStore.writeFile(fileName, function(error, gridStore) {
            if(error) {
                logger.error('files.save(): error writing file - ' + error.toString());
                return callback({type: 'internal', message: 'Internal error.'});
            }
            gridStore.contentType = contentType;
            gridStore.metadata = {type: type, contentType: contentType, name: name, description: description};
            gridStore.close(function() {
                var file = gridStore.metadata;
                file._id = mongoId;
                updateMap(mongoId, function(error, url) {
                    file.url = url;
                    return callback(error, file);
                });
            });
        });
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.saveByExternalUrl = function(_id, type, contentType, name, description, externalUrl, callback) {
    http.getFile(externalUrl, function(tempfileName){
        if(!tempfileName) {
            logger.error('files.saveByExternalUrl(): error downloading file - ' + externalUrl);
            return callback({type: 'invalid_parameter', message: 'Invalid file URL.'});
        }
        var mongoId = common.parseObjectID(_id);
        if(!mongoId) {
            mongoId = common.generateObjectID();
        }
        openById(mongoId, true, function(error, gridStore) {
            if(error) {
                return callback(error);
            }

            gridStore.writeFile(tempfileName, function(error, gridStore) {
                if(error) {
                    logger.error('files.saveByExternalUrl(): error writing file - ' + error.toString());
                    return callback({type: 'internal', message: 'Internal error.'});
                }
                gridStore.contentType = contentType;
                gridStore.metadata = {type: type, contentType: contentType, name: name, description: description};
                gridStore.close(function() {
                    var file = gridStore.metadata;
                    file._id = mongoId;
                    updateMap(mongoId, function(error, url) {
                        file.url = url;
                        return callback(error, file);
                    });
                });
            });
        });
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.saveFromBuffer = function(_id, type, contentType, name, description, buffer, callback) {
    var mongoId = common.parseObjectID(_id);
    if(!mongoId) {
        mongoId = common.generateObjectID();
    }
    openById(mongoId, true, function(error, gridStore) {
        if(error) {
            return callback(error);
        }

        gridStore.write(buffer, function(error, gridStore) {
            if(error) {
                logger.error('files.saveFromBuffer(): error writing file - ' + error.toString());
                return callback({type: 'internal', message: 'Internal error.'});
            }
            gridStore.contentType = contentType;
            gridStore.metadata = {type: type, contentType: contentType, name: name, description: description};
            gridStore.close(function() {
                var file = gridStore.metadata;
                file._id = mongoId;
                updateMap(mongoId, function(error, url) {
                    file.url = url;
                    return callback(error, file);
                });
            });
        });
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.remove = function(_id, callback) {
    var mongoId = common.parseObjectID(_id);
    if(!mongoId) {
        return callback({type: 'invalid_parameter', message: 'Invalid fileId.'});
    }
    openById(mongoId, false, function(error, gridStore) {
        if(error) {
            return callback(error);
        }

        gridStore.unlink(function(error, gridStore) {
            if(error) {
                logger.error('files.remove(): error removing file - ' + error.toString());
                return callback(error);
            }
            gridStore.close(function() {
                return removeMap(mongoId, callback);
            });
        });
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.loadByUrl = function(url, callback) {
    findMap(url, function(error, fileId) {
        if(error) {
           return callback(error);
        }
        return exports.loadById(fileId, callback);
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
