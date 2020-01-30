////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//  Copyright (C) 2008-2013 Quantron Systems LLC.
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
var notify = require('push-notify');
var server = require('./server.js');
var logger = require('./logger.js');
var errors = require('./errors.js');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var gcms;
var apns;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function loadGCMSettings(callback) {
    if(!gcms) {
        if(!server.settings.GCM) {
            logger.error('pushes.loadGCMSettings(): GCM field not found in config');
            return callback({type:'internal', message: 'Internal error'});
        }
        gcms = {};
        for(var item in server.settings.GCM) {
            if(server.settings.GCM.hasOwnProperty(item)) {
                gcms[item] = {
                    apiKey: server.settings.GCM[item],
                    retries: 1
                };
            }
        }
        logger.verbose('pushes.loadGCMSettings(): GCM config loaded ' + JSON.stringify(gcms, null, 2));
    }
    return callback();
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function loadAPNSettings(callback) {
    if(!apns) {
        if(!server.settings.APN) {
            logger.error('pushes.loadAPNSettings(): APN field not found in config');
            return callback({type:'internal', message: 'Internal error'});
        }
        apns = {};
        for(var item in server.settings.APN) {
            if(server.settings.APN.hasOwnProperty(item)) {
                apns[item] = server.settings.APN[item];
            }
        }
        logger.verbose('pushes.loadAPNSettings(): APN config loaded ' + JSON.stringify(apns, null, 2));
    }
    return callback();
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function notifyAndroid(applicationId, pushId, payload, callback) {
    loadGCMSettings(function(error) {
        if(error) {
            return callback(error);
        }

        var gcmConfig = gcms[applicationId];
        if(!gcmConfig) {
            return callback({type: 'invalid_parameter', message: 'Invalid applicationId - ' + applicationId});
        }

        logger.verbose('pushes.notifyAndroid(): sending ' + applicationId + ' ' + pushId + ' ' + JSON.stringify(payload));

        var gcm = notify.gcm(gcmConfig);
        gcm.send({
            registrationId: pushId,
            delayWhileIdle: false,
            timeToLive: 5*60,
            data: {
                payload: payload
            }
        });
        gcm.on('transmitted', function(result/*, message, registrationId*/) {
            logger.verbose('pushes.notifyAndroid(): OK - ' + JSON.stringify(result));
        });
        gcm.on('transmissionError', function (error/*, message, registrationId*/) {
            logger.error('pushes.notifyAndroid(): error sending push - ' + error.toString());
        });

        return callback();
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function notifyIos(applicationId, pushId, payload, options, callback) {
    loadAPNSettings(function(error) {
        if(error) {
            return callback(error);
        }

        var config = apns[applicationId];
        if(!config) {
            return callback({type: 'invalid_parameter', message: 'Invalid applicationId - ' + applicationId});
        }

        logger.verbose('pushes.notifyIos(): sending ' + applicationId + ' ' + pushId);

        try {
            var apn = notify.apn(config);
            apn.on('transmitted', function(/*notification, device*/) {
                logger.verbose('pushes.notifyIos(): success.');
            });
            apn.on('error', function (error) {
                logger.error('pushes.notifyIos(): error sending push - ' + error.toString());
            });
            apn.on('transmissionError', function (errorCode/*, notification, device*/) {
                logger.error('pushes.notifyIos(): transmission error sending push - ' + errorCode);
            });
            var data = {
                token: pushId,
                payload: {
                    payload: payload
                }
            };
            if(options) {
                _.extend(data, options);
            }
            apn.send(data);
        } catch(error) {
            logger.error('pushes.notifyIos(): error sending push - ' + error.toString());
        }
        return callback();
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function notifyDevice(applicationId, pushId, payload, options, callback) {
    switch(applicationId) {
        case 'android.qa':
        case 'android.prod':
            return notifyAndroid(applicationId, pushId, payload, callback);
        case 'ios.qa':
        case 'ios.prod':
            return notifyIos(applicationId, pushId, payload, options && options.ios ? options.ios : null, callback);
        default:
            logger.error('pushes.notifyDevice(): invalid applicationId - ' + applicationId);
            return callback(new errors.Internal());
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
module.exports = {
    notifyIos: notifyIos,
    notifyAndroid: notifyAndroid,
    notify: notifyDevice
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
