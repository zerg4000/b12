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
var common = require('../common.js');
var logger = require('../logger.js');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function ObjectGenerator(entities) {
    this.entities = entities;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
ObjectGenerator.prototype = {
    processProperties: function(properties) {
        var object = {};
        for(var prop in properties) {
            if(properties.hasOwnProperty(prop)) {
                object[prop] = this.generateObject(properties[prop]);
            }
        }
        return object;
    },
    processReference: function(reference) {
        return this.generateObject(this.entities[reference]);
    },
    generateObject: function(schema) {
        if(schema.type instanceof Array) {
            var type = schema.type[0];
        } else {
            type = schema.type;
        }
        switch(type) {
            case 'string':
                return '';
            case 'boolean':
                return false;
            case 'number':
            case 'integer':
                return 0;
            case undefined:
                return this.processReference(schema.$ref);
            case 'object':
                return this.processProperties(schema.properties);
        }
        return null;
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function ObjectDescriptionGenerator(entities) {
    this.entities = entities;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
ObjectDescriptionGenerator.prototype = {
    findReferenceInfo: function(reference) {
        return this.entities[reference];
    },
    processProperties: function(properties) {
        var object = {};
        for(var prop in properties) {
            if(properties.hasOwnProperty(prop)) {
                object[prop] = this.generate(properties[prop]);
            }
        }
        return object;
    },
    processArray: function(items) {
        if(items.$ref) {
            return {
                type: items.$ref,//this.findReferenceName(items.$ref),
                isArray: true,
                isReference: true
            };
        }
        var object = {};
        for(var prop in items) {
            if(items.hasOwnProperty(prop)) {
                if(prop == 'type') {
                    var type = items[prop];
                    switch(type) {
                        case 'string':
                            return {type: 'string', isArray: true};
                        case 'boolean':
                            return {type: 'boolean', isArray: true};
                        case 'number':
                            return {type: 'number', isArray: true};
                        case 'integer':
                            return {type: 'integer', isArray: true};
                        //case undefined:
                        //    return this.processReference(type.$ref ? type.$ref : type);
                        case 'object':
                            return this.processProperties(items.properties);
                        default:
                            //todo: error processing
                            return null;
                    }
                } else {
                    object[prop] = this.generate(items[prop]);
                }
            }
        }
        return {
            type: object,
            isArray: true
        };
    },
    processAnyOf: function(anyOf) {
        for(var i = 0; i < anyOf.length; ++i) {
            if(anyOf[i].hasOwnProperty('$ref')) {
                return this.processReference(anyOf[i].$ref);
            }
        }
        //todo:
        return this.generate(anyOf[0]);
    },
    processReference: function(reference) {
        var referenceInfo = this.findReferenceInfo(reference);
        if(referenceInfo.type == 'object') {
            return {
                type: reference,
                isReference: true
            };
        }
        if(referenceInfo.type == 'string' && referenceInfo.hasOwnProperty('enum')) {
            return {
                type: reference,
                isReference: true,
                isEnum: true
            };
        }
        return this.generate(referenceInfo);
    },
    generate: function(schema) {
        if(schema.type instanceof Array) {
            var type = schema.type[0];
        } else {
            type = schema.type;
        }
        switch(type) {
            case 'string':
            case 'boolean':
            case 'number':
            case 'integer':
                return {type: type};
            case undefined:
                if(schema.hasOwnProperty('anyOf')) {
                    return this.processAnyOf(schema.anyOf);
                } else if(schema.hasOwnProperty('type')) {
                    return this.generate(schema);
                } else {
                    return this.processReference(schema.$ref ? schema.$ref : schema);
                }
            case 'object':
                if(schema.hasOwnProperty('properties')) {
                    return this.processProperties(schema.properties);
                } else if(schema.hasOwnProperty('anyOf')) {
                    return this.processAnyOf(schema.anyOf);
                } else {
                    //todo: error processing
                    return null;
                }
            case 'array':
                return this.processArray(schema.items);
            default:
                logger.error('schemaGenerator.generate(): unknown type' + type);
        }
        return null;
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
module.exports = {
    ObjectGenerator: ObjectGenerator,
    ObjectDescriptionGenerator: ObjectDescriptionGenerator
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
