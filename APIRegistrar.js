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

var logger = require('./logger.js');
var common = require('./common.js');
var schemaValidator = require('./schemaValidator.js');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var methodMap = {};
var entityMap = {};
var errorMap = {
    internal: 'Internal server error occurred.',
    invalid_parameter: 'Parameter unknown, missed or has invalid value.',
    ssl_required: 'SSL is required for this call.',
    not_found: 'Item not found.',
    already_exists: 'Item already exists.',
    disabled_user: 'User is disabled',
    object_is_used: 'Object is used and cannot be deleted or moved.'
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function registerError(name, text) {
    if(!errorMap[name]) {
        errorMap[name] = text;
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function checkMeta(name, meta) {
    var info = meta.info;
    if(info === undefined) {
        logger.error('checkMeta(): method "' + name + '" has no info.');
        return false;
    }

    if(info.description === undefined) {
        logger.error('checkMeta(): method "' + name + '" has no description.');
        return false;
    }

    if(meta.input === undefined || !schemaValidator.validateInputSchema(meta.input)) {
        logger.error('checkMeta(): method "' + name + '" has invalid input schema.');
        return false;
    }

    if(meta.output === undefined || !schemaValidator.validateOutputSchema(meta.output)) {
        logger.error('checkMeta(): method "' + name + '" has invalid output schema.');
        return false;
    }

    if(info.sampleResult === undefined || !schemaValidator.validateOutputSync(info.sampleResult, meta.output)) {
        logger.error('checkMeta(): method "' + name + '" has invalid sample result.');
        return false;
    }

    //todo: check descriptions

    if(info.errors === undefined) {
        info.errors = {};
    }
    var errors = info.errors;
    ['internal', 'ssl_required', 'invalid_parameter', 'not_allowed', 'no_right'].forEach(function(item) {
        if(!errors.hasOwnProperty(item)) {
            errors[item] = errorMap[item];
        }
    });

    if(meta.input.properties && meta.input.properties.session && !errors.invalid_session) {
        var text = 'Session is unknown or expired.';
        registerError('invalid_session', text);
        errors.invalid_session = text;
    }

    for(var error in errors) {
        if(errors.hasOwnProperty(error)) {
            registerError(error, errors[error]);
        }
    }

    return true;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.registerMethod = function(name, meta) {
    if(JSON.stringify(meta).indexOf('__') != -1) {
        logger.error('APIRegistrar.registerMethod(): method %s has bad meta.', name);
        process.exit(-1);
    }
    if(methodMap[name]) {
        logger.error('APIRegistrar.registerMethod(): method %s is already registered.', name);
        process.exit(-1);
    }
    // we do not want to see "__$validated" in API, so clone is needed
    meta.input = common.clone(meta.input);
    meta.output = common.clone(meta.output);
    methodMap[name] = {
        input: common.clone(meta.input),
        output: common.clone(meta.output),
        info: meta.info
    };
    return checkMeta(name, meta);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.registerEntity = function(name, entity) {
    if(entityMap[name]) {
        logger.error('APIRegistrar.registerEntity(): entity %s is already registered.', name);
        process.exit(-1);
    }
    entityMap[name] = common.clone(entity);
    if(!schemaValidator.validateInputSchema(entity) || !schemaValidator.validateOutputSchema(entity)) {
        logger.error('APIRegistrar.registerEntity(): entity %s is invalid schema.', name);
        process.exit(-1);
    }
    return true;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.getMethods = function() {
    return methodMap;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.getErrors = function() {
    return errorMap;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.getEntities = function() {
    return entityMap;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
