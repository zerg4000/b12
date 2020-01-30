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

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var underscore = require('underscore');
var dateFormat = require('dateformat');
var passwordHash = require('password-hash');
var ObjectID = require('mongodb').ObjectID;
var logger = require('./logger.js');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.parseBool = function(value) {
    if(value === null || value === undefined) {
        return null;
    }

    if(!value) return false;

    return value === true || value.toLowerCase() == 'true';
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.parseObjectID = function(value) {
    if(!value) {
        return null;
    }
    if(value instanceof ObjectID) {
        return value;
    }
    try {
        return new ObjectID(value);
    }
    catch(err) {
        return null;
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.generateObjectID = function() {
    return new ObjectID();
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.sendList = function (result, cursor, callback) {
    result.list();
    cursor.each(function (error, item) {
        if(error === null && item !== null) {
            result.val(item);
        } else {
            result.close();
            callback(error);
        }
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.sendArray = function (result, array, callback) {
    result.list();
    for(var i = 0; i < array.length; ++i) {
        result.val(array[i]);
    }
    result.close();
    return callback();
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.sendArrayOfArrays = function (result, arrays, callback) {
    result.list();
    for(var i = 0; i < arrays.length; ++i) {
        var array = arrays[i];
        if(array) {
            for(var j = 0; i < array.length; ++j) {
                result.val(array[j]);
            }
        }
    }
    result.close();
    return callback();
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//todo: replace with underscore
exports.clone = function(object) {
    // Handle the 3 simple types, and null or undefined
    if(null === object || 'object' != typeof object) return object;

    // Handle Date
    var copy;
    if(object instanceof Date) {
        copy = new Date();
        copy.setTime(object.getTime());
        return copy;
    }

    if(object instanceof ObjectID) {
        return new ObjectID(object.toString());
    }

    // Handle Array
    if(object instanceof Array) {
        copy = [];
        for (var i = 0, len = object.length; i < len; ++i) {
            copy[i] = exports.clone(object[i]);
        }
        return copy;
    }

    // Handle Object
    if(object instanceof Object) {
        copy = {};
        for (var attr in object) {
            if(object.hasOwnProperty(attr)) copy[attr] = exports.clone(object[attr]);
        }
        return copy;
    }

    throw new Error('Unable to copy object! Its type isn\'t supported.');
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.convertToNumber = function(value) {
    if(typeof value == 'string') {
        value = parseFloat(value);
        if(isNaN(value)) {
            return null;
        }
    }
    return value;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.cursorToArrayChunked = function(cursor, chunkSize, callback) {
    var completed = false;
    var chunk = [];
    async.whilst(function() { return !completed; },
        function(innerCallback) {
            cursor.nextObject(function(error, record) {
                if(error) {
                    completed = true;
                    innerCallback(error);
                    return;
                }

                if(!record) {
                    completed = true;
                    if(chunk.length > 0) {
                        callback(null, chunk);
                        chunk = [];
                    }
                    innerCallback();
                    return;
                }

                chunk.push(record);
                if(chunk.length >= chunkSize) {
                    callback(null, chunk);
                    chunk = [];
                }
                innerCallback();
            });
        },
        function(error) {
            callback(error);
        }
    );
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var checkTimestampPattern = /^[0-9][0-9][0-9][0-9]-(0[0-9]|1[0-2])-[0-3][0-9] (0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]\.\d*$/;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.checkTimestampFormat = function(str) {
    return checkTimestampPattern.test(str);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var timezomeOffsetMS = new Date(Date.now()).getTimezoneOffset() * 60 * 1000;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.currentDateTime = function() {
    return Date.now() + timezomeOffsetMS;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.convertToLocalDateTime = function(date) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.generateTimestamp = function() {
    return dateFormat(exports.currentDateTime(), 'yyyy-mm-dd HH:MM:ss.l');
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.formatDate = function(date) {
    try {
        return dateFormat(date, 'yyyy-mm-dd HH:MM:ss');
    } catch(error) {
        return null;
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.formatDateYYYYMMDDHHMM = function(date) {
    try {
        return dateFormat(date, 'yyyy-mm-dd HH:MM');
    } catch(error) {
        return null;
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.formatTimestamp = function(date) {
    try {
        return dateFormat(date, 'yyyy-mm-dd HH:MM:ss.l');
    } catch(error) {
        return null;
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.formatDateYYYYMMDD = function(date) {
    return dateFormat(date, 'yyyy-mm-dd');
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.getWeek = function(date) {
    var oneJan = new Date(date.getFullYear(), 0, 1);
    // add +1 after oneJan.getDay() if week starts from Sunday
    return Math.ceil((((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - oneJan) / 86400000) + oneJan.getDay()) / 7);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.isString = function(str) {
    return typeof(str) === 'string' || str instanceof String;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.validateEmail = function(email) {
    if(!email || !exports.isString(email) || email.length === 0) {
        return false;
    }
    var re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.validateObjectID = function(str) {
    if(!str) return false;
    if(!underscore.isString(str)) return false;
    return !!str.match(/^[0-9a-fA-F]{24}$/);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.isObjectID = function(id) {
    return id instanceof ObjectID;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.validateTimestamp = function(str) {
    return !!str.match(/\d{4}-((0[1-9])|(1[0-2]))-((0[1-9])|([1-2][0-9])|(3[0-1]))\s(([0-1][0-9])|(2[0-3])):([0-5][0-9]):([0-5][0-9])\.([0-9][0-9][0-9])$/);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.validatePassword = function(password) {
    return !(!password || !exports.isString(password) || password.length < 6);

};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.hashPassword = function(password) {
    return passwordHash.generate(password);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.verifyPassword = function(password, hashedPassword) {
    return passwordHash.verify(password, hashedPassword);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var usernameRegexp = /^[a-z0-9._]+$/i;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.validateUserName = function(userName) {
    return !(!userName || !exports.isString(userName) || userName.length < 4 || !usernameRegexp.test(userName));

};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// format yyyy-mm-dd HH:MM:ss or yyyy-mm-dd HH:MM:ss.l
exports.parseDate = function(str) {
    try {
        var m;
        if(str.indexOf(':') != -1) {
            if(str.indexOf('.') != -1) {
                m = str.match(/(\d+)-(\d+)-(\d+)\s+(\d+):(\d+):(\d+).(\d+)/);
                return new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +m[6], +m[7]);
            } else {
                m = str.match(/(\d+)-(\d+)-(\d+)\s+(\d+):(\d+):(\d+)/);
                return new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +m[6], 0);
            }
        } else {
            m = str.match(/(\d+)-(\d+)-(\d+)/);
            return new Date(+m[1], +m[2]-1, +m[3], 0, 0, 0, 0);
        }
    } catch(error) {
        return null;
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.normalizeTimestamp = function(str) {
    var date = exports.parseDate(str);
    if(!date) {
        return null;
    }
    return exports.formatTimestamp(date);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.prepareStringForCompare = function(str) {
    return str.toLowerCase().replace(/^\s+|\s+$/g, '');
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.padWithZero = function(number, maxDigits) {
    var str = number + '';
    while(str.length < maxDigits) {
        str = '0' + str;
    }
    return str;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.parseLongitude = function(longitude) {
    var value = exports.convertToNumber(longitude);
    if(value === null || value < -180.0 || value > 180.0) {
        return null;
    }
    return value;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.parseLatitude = function(latitude) {
    var value = exports.convertToNumber(latitude);
    if(value === null || value < -90.0 || value > 90.0) {
        return null;
    }
    return value;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.convertToInt = function(value) {
    if(exports.isString(value)) {
        value = parseInt(value, 10);

        if(isNaN(value)) {
            return null;
        }
    }

    return value;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.getPropertyByName = function(object, name, defaultValue) {
    name = name.replace(/\[(\w+)]/g, '.$1');   // convert indexes to properties
    name = name.replace(/^\./, '');             // strip a leading dot
    var names = name.split('.');
    while(names.length) {
        var propertyName = names.shift();
        if(object && (object instanceof Object || object instanceof Array) && propertyName in object) {
            object = object[propertyName];
            if((object !== 0) && !object) {
                return defaultValue;
            }
        } else {
            return defaultValue;
        }
    }
    return object;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.setPropertyByName = function(object, name, value) {
    name = name.replace(/\[(\w+)]/g, '.$1');   // convert indexes to properties
    name = name.replace(/^\./, '');             // strip a leading dot
    var names = name.split('.');
    while(names.length > 1) {
        var propertyName = names.shift();
        if(!(propertyName in object)) {
            object[propertyName] = {};
        }
        object = object[propertyName];
    }

    object[names.shift()] = value;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.pickFirstProperty = function(data, names, defaultValue) {
    for(var i = 0; i < names.length; ++i) {
        var value = exports.getPropertyByName(data, names[i]);
        if(value) {
            return value;
        }
    }
    return defaultValue;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.extractImageTypeFromUrl = function(url) {
    //todo: very simple function, create tests
    url = url.toLowerCase();
    var index = url.length - 4;
    if(url.indexOf('.gif') == index) {
        return 'gif';
    }
    if(url.indexOf('.png') == index) {
        return 'png';
    }
    return 'jpeg';
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.escapeRegExp = function(str) {
    return str.replace(/[\-\[\]\/\{}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function capitalizeFirst(str) {
    if(str) {
        str = str.substr(0, 1).toUpperCase() + str.substr(1, str.length - 1)
    }
    return str;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.stringUtils = {
    toCamelStyle: function(str, separator) {
        var result = '';
        str.split(separator).forEach(function(word) {
            result += capitalizeFirst(word);
        });
        return result;
    },
    trimAll: function(str) {
        return str.replace(/^\s+|\s+$/g, '');
    },
    clearTabs: function(str) {
        return str.replace(/\t/g, ' ').replace(/\\t/g, ' ');
    },
    prepareForCompare: exports.prepareStringForCompare,
    capitalizeFirst: capitalizeFirst
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.deleteFolderRecursive = function(path) {
    if(fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function(file, index) {
            var curPath = path + '/' + file;
            if(fs.lstatSync(curPath).isDirectory()) {
                exports.deleteFolderRecursive(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.ensurePath = function(path) {
    var parts = path.split('/');
    var subPath = '';
    for(var i = 0; i < parts.length; i++) {
        subPath += parts[i];
        try {
            fs.mkdirSync(subPath);
        } catch(err) {
            if(err.code != 'EEXIST') throw err;
        }
        subPath += '/';
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.md5 = function(str) {
    return crypto.createHash('md5').update(str).digest('hex');
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.md5File = function(fileName, callback) {
    var fd = fs.createReadStream(fileName);
    var hash = crypto.createHash('md5');
    hash.setEncoding('hex');

    fd.on('end', function() {
        hash.end();
        return callback(null, hash.read());
    });

    fd.pipe(hash);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
