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
var nodeMailer = require('nodemailer');
var common = require('./common.js');
var logger = require('./logger.js');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var smtpTransport;
var fromAddress;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function initialize() {
    if(!smtpTransport) {
        var settings = require('./settings.js').get();

        var host = common.getPropertyByName(settings, 'SMTP.HOST');
        var user = common.getPropertyByName(settings, 'SMTP.USER');
        var password = common.getPropertyByName(settings, 'SMTP.PASSWORD');
        var port  = common.getPropertyByName(settings, 'SMTP.PORT', 465);
        var isSecure  = common.getPropertyByName(settings, 'SMTP.SECURE', false);
        fromAddress = common.getPropertyByName(settings, 'SMTP.FROM');

        if(!host || !user || !password || !fromAddress) {
            logger.error('emails.initialize(): there is no SMTP section in settings or it is invalid.');
            return false;
        }

        var params = {
            host: host,
            auth: {
                user: user,
                pass: password
            }
            // uncomment this string for debug
            // ,debug: true
        };

        if(isSecure) {
            params.secure = true;
            params.port = port;
        }

        smtpTransport = nodeMailer.createTransport(params);
        // uncomment this strings for debug
        // smtpTransport.on('log', function(logData) {
        //     logger.verbose('emails: ' + JSON.stringify(logData));
        // });
    }
    return true;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var send = function(to, subject, text, html, callback) {
    var options = {
        from: fromAddress,
        to: to,
        subject: subject
    };

    if(!text && ! html) {
        return callback({type: 'invalid_parameter', message: 'Text or Html is needed.'});
    }

    if(text) {
        options.text = text;
    }
    if(html) {
        options.html = html;
    }

    smtpTransport.sendMail(options, function(error) {
        if(error) {
            logger.error('emails.send(): error sending email - ' + error.toString());
            return callback({type: 'internal', message: 'Error sending email.'});
        }

        logger.verbose('emails.send(): email sent to: ' + to + ' subject: ' + subject);

        return callback();
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.send = function(emails, subject, text, html, callback) {
    if(!initialize()) {
        return callback({type: 'internal', message: 'Internal error.'});
    }

    if(emails.length > 50) {
        logger.error('emails.send(): too many recipients - ' + emails.length);
        return callback({type: 'invalid_parameter', message: 'Too many recipients.'});
    }

    var tasks = [];
    emails.forEach(function(email) {
        tasks.push(async.apply(send, email, subject, text, html));
    });

    async.parallel(tasks, function(error) {
        if(error) {
            return callback(error);
        }
        return callback();
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
