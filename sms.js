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
var server = require('./server.js');
var logger = require('./logger.js');
var errors = require('./errors.js');
var http = require('./http.js');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var smsc;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function sendSMS(phone, text, callback) {
    if(phone == '+00000000000') {
        // for testing skip this number
        return callback();
    }
    if(!smsc) {
        if(!server.settings.SMSC) {
            logger.error('sms.sendSMS(): SMSC field not found in config.');
            return callback(new errors.Internal());
        }
        smsc = {
            login: server.settings.SMSC.LOGIN,
            password: server.settings.SMSC.PASSWORD,
            sender: server.settings.SMSC.SENDER
        };
        if(!smsc.login || ! smsc.password || !smsc.sender) {
            logger.error('sms.sendSMS(): SMSC has invalid format.');
            return callback(new errors.Internal());
        }
    }

    var params = {
        login: smsc.login,
        psw: smsc.password,
        phones: phone,
        mes: text,
        sender: smsc.sender,
        charset: 'utf-8'
    };

    http.getHTTPSWithParams('https://smsc.ru/sys/send.php', params, true, function(result) {
        if(!result) {
            logger.error('sms.sendSMS(): error sending sms.');
            return callback(new errors.Internal());
        }
        //console.log(result);
        return callback();
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
module.exports = {
    sendSMS: sendSMS
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
