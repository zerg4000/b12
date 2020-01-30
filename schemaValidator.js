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
var zSchema = require('z-schema');
var common = require('./common.js');
var logger = require('./logger.js');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
zSchema.registerFormat('objectId', function(str) {
    if(_.isNull(str)) return true;
    if(_.isObject(str)) {
        return common.isObjectID(str);
    }
    return common.validateObjectID(str);
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
zSchema.registerFormat('objectIdOrEmpty', function(str) {
    if(_.isObject(str)) {
        return common.isObjectID(str);
    }
    if(str === '') {
        return true;
    }
    return common.validateObjectID(str);
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
zSchema.registerFormat('timestamp', function(str) {
    return common.validateTimestamp(str);
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var defaultOptions = {
    noEmptyStrings: true,
    noTypeless: true,
    noExtraKeywords: true,
    forceAdditional: true,
    forceItems: true
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var inputValidator = new zSchema(defaultOptions);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var outputValidator = new zSchema(defaultOptions)

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.setInputValidatorOptions = function setInputValidatorOptions(options) {
    _.defaults(options, defaultOptions);
    inputValidator = new zSchema(options);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.setOutputValidatorOptions = function setOutputValidatorOptions(options) {
    _.defaults(options, defaultOptions);
    outputValidator = new zSchema(options);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.validateInput = function(json, schema, callback) {
    inputValidator.validate(json, schema, function(errors, valid) {
        if(valid) {
            return callback();
        }
        logger.error('schemaValidator.validateInput(): invalid json -\n'
            + JSON.stringify(errors, null, 2)
            + '\n'
            + JSON.stringify(schema, null, 2)
            + '\n'
            + JSON.stringify(json, null, 2));
        //todo: parse errors and create better error message
        return callback({type: 'invalid_parameter', message: JSON.stringify(errors)});
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.validateOutput = function(json, schema, callback) {
    //todo: is it needed? How to right check empty objects?
    if(JSON.stringify(schema) == '{}') {
        logger.error('schemaValidator.validateOutput(): json schema is empty - ' + JSON.stringify(schema));
        return callback({type: 'internal', message: 'Internal error'});
    }

    outputValidator.validate(json, schema, function(errors, valid) {
        if(valid) {
            return callback();
        }
        logger.error('schemaValidator.validateOutput(): invalid json -\n'
            + JSON.stringify(errors, null, 2)
            + '\n'
            + JSON.stringify(schema, null, 2)
            + '\n'
            + JSON.stringify(json, null, 2));
        return callback({type: 'internal', message: 'Internal error'});
    });
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.validateOutputSync = function(json, schema) {
    if(!outputValidator.validate(json, schema)) {
        logger.error('schemaValidator.validateOutputSync(): invalid json -\n'
            + JSON.stringify(outputValidator.getLastErrors(), null, 2)
            + '\n'
            + JSON.stringify(schema, null, 2)
            + '\n'
            + JSON.stringify(json, null, 2));
        return false;
    }
    return true;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.validateInputSchema = function(schema) {
    if(!inputValidator.validateSchema(schema)) {
        logger.error('schemaValidator.validateInputSchema(): invalid schema -\n'
            + JSON.stringify(inputValidator.getLastErrors(), null, 2)
            + '\n'
            + JSON.stringify(schema, null, 2));
        return false;
    }
    return true;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.validateOutputSchema = function(schema) {
    if(!outputValidator.validateSchema(schema)) {
        logger.error('schemaValidator.validateOutputSchema(): invalid schema -\n'
            + JSON.stringify(outputValidator.getLastErrors(), null, 2)
            + '\n'
            + JSON.stringify(schema, null, 2));
        return false;
    }
    return true;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.strictValidator = new zSchema({
    noEmptyStrings: false,
    noTypeless: true,
    noExtraKeywords: true,
    forceAdditional: true,
    forceItems: true
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.validate = function(json, schema) {
    if(!exports.strictValidator.validate(json, schema)) {
        return {ok: false, errors: exports.strictValidator.getLastErrors()}
    }

    return {ok: true};
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.registerFormat = zSchema.registerFormat;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
