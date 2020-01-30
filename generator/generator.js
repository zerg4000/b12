////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//  Copyright (C) 2008-2014 Quantron Systems LLC.
//  All Rights Reserved.
//
//  This file is part of the B12 project.
//  For conditions of distribution and use,
//  please contact sales@quantron-systems.com
//
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

var fs = require('fs');
var async = require('async');
var common = require('../common.js');
var settings = require('../settings.js');
var http = require('../http.js');
var logger = require('../logger.js');
var android = require('./android.js');
var ios = require('./ios.js');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function doRequest(options, methodName, data, callback) {
    logger.verbose('generator.doRequest(): requesting ' + methodName + ' ' + JSON.stringify(data));
    http.post(options.SERVER_ADDRESS, options.SERVER_PORT, '/' + methodName, data, function(result) {
        if(!result) {
            return callback({type: 'internal', message: 'Internal error.'});
        }
        if(!result.result || !result.status || !result.status.error || result.status.error != 'ok') {
            logger.error('generator.doRequest(): invalid result - ' + JSON.stringify(result));
            return callback({type: 'internal', message: 'Internal error.'});
        }
        //logger.verbose('generator.doRequest(): result ' + JSON.stringify(result));
        return callback(null, result.result);
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function generate(options, callback) {
    async.waterfall([
            // login
            function(callback) {
                if(options.USER && options.PASSWORD) {
                    doRequest(options, 'login', {email: options.USER, password: options.PASSWORD}, function(error, result) {
                        console.log(JSON.stringify(result));
                        if(error) {
                            logger.error('generator.getApi(): logging in ' + JSON.stringify(error));
                        }
                        return callback(error, result.session);
                    });
                } else {
                    return callback(null, null);
                }
            },
            // get api
            function(session, callback) {
                var params = session ? {session: session} : {};
                doRequest(options, 'getAPI', params, function(error, result) {
                    if(error) {
                        logger.error('generator.generate(): getting API - ' + JSON.stringify(error));
                    }
                    return callback(error, result);
                });
            },
            // generate
            function(api, callback) {
                switch(options.PLATFORM) {
                    case 'android': {
                        android.generate(api, options.OUTPUT);
                        return callback();
                    }
                    case 'ios': {
                        ios.generate(api, options.OUTPUT);
                        return callback();
                    }
                    default: {
                        logger.error('generator.generate(): unknown platform - ' + options.PLATFORM);
                        return callback();
                    }
                }
            }
        ],
        function(error) {
            return callback(error);
        }
    );
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var args = process.argv.slice(2);

if(!args.length) {
    logger.error('Please specify path to config.');
    return -1;
}

try {
    var options = settings.readFromFile(args[0]);
    // check settings
    if(!options.OUTPUT) {
        logger.error('There is no OUTPUT section in the config.');
        return -2;
    }
    if(!options.SERVER_ADDRESS || !options.SERVER_PORT) {
        logger.error('There is no SERVER_ADDRESS or SERVER_PORT section in the config.');
        return -2;
    }
    generate(options, function(error) {
        //
    });
} catch(error) {
    logger.error('Error generating code - ' + error);
    return -3;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
