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

var http = require('http');
var https = require('https');
var urlLib = require('url');
var fs = require('fs');
var temp = require('temp');
var _ = require('underscore');
var common = require('./common.js');
var logger = require('./logger.js');

//todo: support redirecting for all requests
// see https://github.com/olalonde/follow-redirects - but does not work with custom charset for location

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function setupRequest(request, callback) {
    request.on('socket', function(socket) {
        socket.setTimeout(60000);
        socket.on('timeout', function() {
            logger.error('http.processRequest(): timeout');
            return request.abort();
        });
    });

    request.on('error', function(error) {
        logger.error('http.processRequest(): error - ' + error.toString());
        return callback();
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function processResponse(request, response, callback, doNotParse) {
    if(response.statusCode != 200) {
        logger.error('http.processResponse(): HTTP code - ' + response.statusCode);
        request.abort();
        return callback();
    }
    var buffer;
    response.on('data', function(chunk) {
        if(!buffer) {
            buffer = chunk;
        } else {
            buffer = Buffer.concat([buffer, chunk]);
        }
    });
    response.on('error', function(error) {
        logger.error('http.processResponse(): error - ' + error.toString());
        return callback();
    });
    response.on('end', function() {
        var data = buffer ? buffer.toString() : '';
        if(doNotParse) {
            return callback(data);
        }
        var parsedData;
        try {
            parsedData = JSON.parse(data);
        } catch (error) {
            logger.error('http.processResponse(): invalid JSON in response, error - ' + error.toString() + ', data: ' + data);
            return callback();
        }
        return callback(parsedData);
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.get = function(url, callback, doNotParse) {
    logger.verbose('http.get(): ' + url);

    var request = http.get(url, function(response) {
        processResponse(request, response, callback, doNotParse);
    });
    setupRequest(request, callback);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.getFile = function(url, callback) {
    logger.verbose('http.getFile(): ' + url);
    var startTime = Date.now();

    temp.open('node-http-getFile', function(error, info) {
        if(error) {
            logger.error('http.getFile(): error creating temp file - ' + error.toString());
            return callback();
        }

        var request = http.get(url, function(response) {
            if(response.statusCode >= 300 && response.statusCode < 400 && _.has(response.headers, 'location')) {
                //logger.verbose(JSON.stringify(response.headers, null, 2));
                var location = urlLib.resolve(url, response.headers.location);
                logger.verbose('http.getFile(): redirecting to - ' + location);
                return exports.getFile(location, callback)
            }

            if(response.statusCode != 200) {
                logger.error('http.getFile(): HTTP code - ' + response.statusCode);
                request.abort();
                return callback();
            }
            var buffer;
            response.on('data', function(chunk) {
                if(!buffer) {
                    buffer = chunk;
                } else {
                    buffer = Buffer.concat([buffer, chunk]);
                }
            });
            response.on('error', function(error) {
                fs.close(info.fd, function(){});
                logger.error('http.getFile(): error downloading - ' + error.toString());
                return callback();
            });
            response.on('end', function() {
                fs.write(info.fd, buffer, 0, buffer.length, 0, function(error) {
                    if(error) {
                        logger.error('http.getFile(): error writing file - ' + error.toString());
                        return callback();
                    }
                    fs.close(info.fd, function(error) {
                        if(error) {
                            logger.error('http.getFile(): error closing file - ' + error.toString());
                            return callback();
                        }
                        logger.verbose('http.getFile(): downloading time - ' + (Date.now() - startTime) + ' ms');
                        return callback(info.path);
                    });
                });
            });
        });
        setupRequest(request, callback);
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.getHTTPS = function(url, callback, doNotParse) {
    logger.verbose('http.getHTTPS(): ' + url);

    var request = https.get(url, function(response) {
        processResponse(request, response, callback, doNotParse);
    });
    setupRequest(request, callback);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.getHTTPSWithParams = function(url, params, doNotParse, callback) {
    if(!_.isEmpty(params)) {
        var add = '';
        for(var p in params) {
            if(params.hasOwnProperty(p)) {
                if(add.length > 0) {
                    add += '&';
                }
                add += p.toString() + '=' + encodeURIComponent(params[p]);
            }
        }
        url += '?' + add;
    }
    return exports.getHTTPS(url, callback, doNotParse);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.post = function(host, port, url, params, callback, doNotParse) {
    var body = '';
    for(var p in params) {
        if(params.hasOwnProperty(p)) {
            if(body.length > 0) {
                body += '&';
            }
            body += p.toString() + '=' + encodeURIComponent(params[p]);
        }
    }

    var options = {
        hostname: host,
        port: port,
        path: url,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': body.length
        }
    };

    logger.verbose('http.post(): posting ' + host + url + ', params: ' + body);

    var request = http.request(options, function(response) {
        if(response.statusCode != '200') {
            logger.error('http.post(): error posting: ' + JSON.stringify(response.statusCode));
            return callback();
        }
        var buffer;
        response.on('data', function(chunk) {
            if(!buffer) {
                buffer = chunk;
            } else {
                buffer = Buffer.concat([buffer, chunk]);
            }
        });
        response.on('error', function(error) {
            logger.error('http.post(): error posting: ' + JSON.stringify(error));
            return callback();
        });
        response.on('end', function() {
            var data = buffer.toString();
            if(doNotParse) {
                return callback(data);
            }
            var parsedData;
            try {
                parsedData = JSON.parse(data);
            } catch (error) {
                logger.error('http.post(): invalid JSON response, error: ' + error + ', data: ' + data);
                return callback();
            }
            return callback(parsedData);
        });
    }).on('socket', function(socket) {
            socket.setTimeout(10000);
            socket.on('timeout', function() {
                logger.error('http.post(): error posting - timeout');
                return request.abort();
            });
        }).on('error', function(error) {
            logger.error('http.post(): error posting - ' + error);
            return callback();
        });

    request.write(body);
    request.end();
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//todo: add checkUrl method
/*
 exports.checkUrl = function(address, options, callback) {
 logger.debug('checkUrl(): checking ' + address);
 if(!callback) {
 callback = options;
 options = null;
 }
 var request = restler.head(address, options).once('complete', function(data, response) {
 if(data instanceof Error) {
 return callback(null, false);
 }
 return callback(null, response.statusCode == '200');
 }).on('socket', function(socket) {
 socket.setTimeout(10000);
 socket.on('timeout', function() {
 request.abort();
 return callback(null, false);
 })
 });
 };
*/

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
