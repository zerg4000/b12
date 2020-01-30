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

'use strict';

var _ = require('underscore');
var fs = require('fs');
var common = require('../common.js');
var stringUtils = common.stringUtils;
var logger = require('../logger.js');
var utils = require('./utils.js');
var schemaGenerator = require('./schemaGenerator.js');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var generator;
var apiData;
var schemas;
var enums;
var imports;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function getSchemaFullName(schemaName) {
    return 'QS' + stringUtils.capitalizeFirst(schemaName) + 'Schema';
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function getEnumFullName(schemaName) {
    return 'QS' + stringUtils.capitalizeFirst(schemaName);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function getParameterType(parameter) {
    if(parameter.isReference) {
        if(parameter.isArray) {
            return 'NSArray<' + getSchemaFullName(parameter.type) + '>*';
        }
        if(parameter.isEnum) {
            return getEnumFullName(parameter.type);
        }
        return getSchemaFullName(parameter.type) + '*';
    }
    if(parameter.isArray) {
        return 'NSArray*';
    }
    switch(parameter.type) {
        case 'string':
            return 'NSString*';
        case 'number':
        case 'integer':
        case 'boolean':
            return 'NSNumber*';
    }
    logger.error('ios.getParameterType(): unknown parameter type - ' + JSON.stringify(parameter));
    throw new Error('Unknown parameter type. Most likely you have nested objects in schema (they must be extracted to separate entity).');
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function fixParameterName(parameterName) {
    switch(parameterName) {
        case 'description':
            return 'desc';
        case 'class':
            return 'class_';
        case 'superclass':
            return 'superclass_';
        case 'hash':
            return 'hash_';
    }
    return parameterName;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function generateSchema(parameter) {
    var schemaName = parameter.type;
    var schemaData = apiData.entities[schemaName];

    if(schemaData.type == 'string' && schemaData.hasOwnProperty('enum')) {
        var enumFullName = getEnumFullName(schemaName);
        if(enumFullName in enums) {
            return enums[enumFullName];
        }

        var enumResult = {
            name: enumFullName,
            enums: _.map(schemaData.enum, function(item, index) {
                return {
                    name: enumFullName + (item ? stringUtils.capitalizeFirst(item) : 'None'),
                    value: item,
                    index: index
                };
            })
        };
        enums[enumFullName] = enumResult;
        return enumResult;
    } else {
        var schemaFullName = getSchemaFullName(schemaName);
        if(schemaFullName in schemas) {
            return schemas[schemaFullName];
        }

        var data = generator.generate(schemaData);
        var parameters = generateParameters(data);
        var references = generateReferences(data);

        var result = {
            name: schemaFullName,
            parameters: parameters,
            references: references
        };

        schemas[schemaFullName] = result;

        return result;
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function generateParameters(parameters) {
    var result = [];
    for(var parameterName in parameters) {
        if(parameters.hasOwnProperty(parameterName)) {
            var parameter = parameters[parameterName];
            var fixedName = fixParameterName(parameterName);
            if(parameter.isReference) {
                generateSchema(parameter);
            }
            result.push({
                type: getParameterType(parameter),
                name: fixedName,
                nameUp: stringUtils.capitalizeFirst(fixedName),
                isEnum: !!parameter.isEnum,
                isReference: !!parameter.isReference
            });
        }
    }
    return result;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function generateReferences(parameters) {
    var result = [];
    for(var parameterName in parameters) {
        if(parameters.hasOwnProperty(parameterName)) {
            var parameter = parameters[parameterName];
            if(parameter.isReference) {
                if(parameter.isArray) {
                    result.push({
                        type: getSchemaFullName(parameter.type),
                        isClass: false,
                        isProtocol: true
                    });
                } else {
                    if(parameter.isEnum) {
                        //skip
                        /*result.push({
                            type: getEnumFullName(parameter.type),
                            isClass: true,
                            isProtocol: false
                        });*/
                    } else {
                        result.push({
                            type: getSchemaFullName(parameter.type),
                            isClass: true,
                            isProtocol: false
                        });
                    }
                }
            }
        }
    }
    return result;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function generateMethods(outDir, templatesPath) {
    for(var methodName in apiData.api) {
        if(apiData.api.hasOwnProperty(methodName) && methodName !== 'getAPI') {
            logger.verbose('generateMethods(): generating method - ' + methodName);

            var name = 'QS' + stringUtils.capitalizeFirst(methodName.replace(/[/\\]/, '_')) + 'Method';
            var method = apiData.api[methodName];
            var methodData = {
                name: name,
                serverName: methodName
            };

            methodData.inputs = generateParameters(generator.generate(method.input));
            methodData.outputs = generateParameters(generator.generate(method.output));

            utils.generateFile(outDir + '/' + name + '.h', templatesPath + '/MethodHeader.dot', methodData);
            utils.generateFile(outDir + '/' + name + '.m', templatesPath + '/MethodImpl.dot', methodData);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function generateSchemas(outDir, templatesPath) {
    for(var schemaFullName in schemas) {
        if(schemas.hasOwnProperty(schemaFullName)) {
            logger.verbose('generateSchemas(): generating schema - ' + schemaFullName);

            var schema = schemas[schemaFullName];

            utils.generateFile(outDir + '/' + schemaFullName + '.h', templatesPath + '/SchemaHeader.dot', schema);
            utils.generateFile(outDir + '/' + schemaFullName + '.m', templatesPath + '/SchemaImpl.dot', schema);

            imports.push(schemaFullName);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function generateEnums(outDir, templatesPath) {
    for(var enumFullName in enums) {
        if(enums.hasOwnProperty(enumFullName)) {
            logger.verbose('generateEnums(): generating enum - ' + enumFullName);

            var enumInfo = enums[enumFullName];

            utils.generateFile(outDir + '/' + enumFullName + '.h', templatesPath + '/EnumHeader.dot', enumInfo);
            utils.generateFile(outDir + '/' + enumFullName + '.m', templatesPath + '/EnumImpl.dot', enumInfo);

            // enums should be first
            imports.unshift(enumFullName);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function generateImports(outDir, templatesPath) {
    utils.generateFile(outDir + '/QSSchemas.h', templatesPath + '/Schemas.dot', {schemas: imports});
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function generate(data, outDir) {
    try {
        schemas = {};
        enums = {};
        imports = [];
        generator = new schemaGenerator.ObjectDescriptionGenerator(data.entities);
        apiData = data;

        var templatesPath = __dirname + '/ios';
        utils.createFolder(outDir);

        var schemasDir = outDir + '/schemas';
        utils.createFolder(schemasDir);

        var enumsDir = outDir + '/enumerations';
        utils.createFolder(enumsDir);

        generateMethods(outDir, templatesPath);
        generateSchemas(schemasDir, templatesPath);
        generateEnums(enumsDir, templatesPath);
        generateImports(schemasDir, templatesPath);

        return true;
    } catch(error) {
        logger.error('ios(): error generating code - ' + error.stack);
        return false;
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
module.exports = {
    generate: generate
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
