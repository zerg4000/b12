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
var fs = require('fs');
var logger = require('./logger.js');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function processError(message) {
    logger.error('settings: ' + message);
    throw Error(message);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.read = function() {
    try {
        logger.verbose('settings.read(): reading default config file...');
        var defaultSettingsString = fs.readFileSync('./config.json');
    } catch(error) {
        processError('cannot read default settings file - ' + error.toString());
    }

    try {
        var settings = JSON.parse(defaultSettingsString);
    } catch(error) {
        processError('cannot parse default settings file - ' + error.toString());
    }

    settings.getValue = function(name, defaultValue) {
        if(!settings.hasOwnProperty(name)) {
            logger.warn('settings.getValue(): no ' + name + ' record in settings.');
            return defaultValue;
        }
        return settings[name];
    }

    var overridePath = './config.local.json';

    if(!fs.existsSync(overridePath)) {
        return settings;
    }

    try {
        logger.verbose('settings.read(): reading local config file...');
        var localSettingsString = fs.readFileSync(overridePath);
    } catch(error) {
        processError('cannot read local settings file - ' + error.toString());
    }

    try {
        var localSettings = JSON.parse(localSettingsString);
    } catch(error) {
        processError('error on local settings file parsing - ' + error.toString());
    }

    settings = _.defaults(localSettings, settings);

    return settings;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.readFromFile = function(path) {
    try {
        logger.verbose('settings.readFromFile(): reading config file - ' + path);
        var settingsString = fs.readFileSync(path);
        var settings = JSON.parse(settingsString);
        return settings;
    } catch(error) {
        processError('cannot read settings file - ' + error.toString());
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var settings;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.get = function() {
    if(!settings) {
        settings = exports.read();
    }
    return settings;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
