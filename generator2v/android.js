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
function generateEntity(entityName, outDir, entities, packageName, templatesPath) {
    var entity = entities[entityName];
    var generator = new schemaGenerator.ObjectDescriptionGenerator(entities);
    entityName = stringUtils.capitalizeFirst(entityName);

    if(entity.hasOwnProperty('enum')) {
        if(entity.type != 'string') {
            logger.error('android.generateEntity(): invalid enum type ' + entity.type);
            return;
        }

        var enums = '';
        _.each(entity.enum, function(item, index) {
            if(index) {
                enums += '    ';
            }
            enums += item ? item.toUpperCase() : 'NONE';
            enums += '("' + item + '")';
            if(index != entity.enum.length - 1) {
                enums += ',\n';
            }
        });

        utils.generateFile(outDir + '/enumerations/' + entityName + '.java', templatesPath + '/enumerations/Enum.dot', {
            name: entityName,
            enums: enums,
            packageName: packageName
        });

    } else {
        var properties = generator.generate(entity);

        //console.log(JSON.stringify(entity, null, 2));
        //console.log(JSON.stringify(properties, null, 2));


        var propertiesArray = [];
        var references = {};

        for(var propertyName in properties) {
            if(properties.hasOwnProperty(propertyName)) {
                var property = properties[propertyName];
                //console.log(JSON.stringify(property));
                if(property.isReference) {
                    var propertyType = stringUtils.capitalizeFirst(property.type);
                    references[property.type] = true;
                } else {
                    propertyType = stringUtils.capitalizeFirst(property.type);
                }
                if(property.isArray) {
                    propertyType = propertyType + '[]';
                }
                propertiesArray.push({
                    name: propertyName,
                    type: propertyType,
                    nameUp: common.stringUtils.capitalizeFirst(propertyName),
                    isReference: !!property.isReference,
                    isEnum: !!property.isEnum
                });
            }
        }

        utils.generateFile(outDir + '/schemas/' + entityName + '.java', templatesPath + '/schemas/Entity.dot', {
            name: entityName,
            properties: propertiesArray,
            packageName: packageName
        });

        //todo: recursive
        //console.log(JSON.stringify(references, null, 2));
        for(var reference in references) {
            if(references.hasOwnProperty(reference)) {
                generateEntity(reference, outDir, entities, packageName, templatesPath);
            }
        }
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function generateMethods(data, outDir, templatesPath) {
    var packageName = data.packageName;
    var responsesDir = outDir + '/schemas/responses/';
    utils.createFolder(responsesDir);
    var requestsDir = outDir + '/schemas/requests/';
    utils.createFolder(requestsDir);
    var methodsDir = outDir + '/methods/';
    utils.createFolder(methodsDir);

    var generator = new schemaGenerator.ObjectDescriptionGenerator(data.entities);

    var entities = {};

    for(var methodName in data.api) {
        if(data.api.hasOwnProperty(methodName) && methodName !== 'getAPI') {
            logger.verbose('generateMethods(): generating method - ' + methodName);

            var fixedMethodName = methodName.replace(/[/\\]/, '_');
            var name = stringUtils.capitalizeFirst(fixedMethodName) + 'Method';
            var method = data.api[methodName];
            var parameters = generator.generate(method.input);
            //console.log(JSON.stringify(parameters, null, 2));
            var outputs = generator.generate(method.output);
            //console.log(JSON.stringify(outputs, null, 2));
            var parametersDescription = '';
            var parametersCall = '';
            var parametersArray = [];
            var outputsArray = [];

            for(var parameterName in parameters) {
                if(parameters.hasOwnProperty(parameterName)) {
                    var parameter = parameters[parameterName];
                    var parameterType = stringUtils.capitalizeFirst(parameter.type);
                    if(parametersDescription) {
                        parametersDescription += ', ';
                    }
                    if(parameter.isArray) {
                        parameterType += '[]';
                    }
                    parametersDescription += parameterType + ' ' + parameterName;
                    if(parametersCall) {
                        parametersCall += ', ';
                    }
                    parametersCall += parameterName;
                    parametersArray.push({
                        name: parameterName,
                        type: parameterType,
                        nameUp: common.stringUtils.capitalizeFirst(parameterName),
                        isReference: !!parameter.isReference,
                        isEnum: !!parameter.isEnum
                    });
                    if(parameter.isReference) {
                        entities[parameter.type] = true;
                    }
                }
            }

            for(var outputName in outputs) {
                if(outputs.hasOwnProperty(outputName)) {
                    var output = outputs[outputName];
                    if(output.isReference) {
                        var outputType = stringUtils.capitalizeFirst(output.type);
                        entities[output.type] = true;
                    } else {
                        outputType = stringUtils.capitalizeFirst(output.type);
                    }
                    if(output.isArray) {
                        outputType = outputType + '[]';
                    }
                    outputsArray.push({
                        name: outputName,
                        type: outputType,
                        nameUp: common.stringUtils.capitalizeFirst(outputName),
                        isReference: !!output.isReference,
                        isEnum: !!output.isEnum
                    });
                }
            }

            utils.generateFile(requestsDir + '/' + name + 'Request' + '.java', templatesPath + '/schemas/requests/Request.dot', {
                name: name + 'Request',
                parameters: parametersArray,
                parametersDescription: parametersDescription,
                packageName: packageName
            });

            utils.generateFile(responsesDir + '/' + name + 'Response' + '.java', templatesPath + '/schemas/responses/Response.dot', {
                responseName: name + 'Response',
                resultName: name + 'Result',
                outputs: outputsArray,
                packageName: packageName
            });

            utils.generateFile(methodsDir + name + '.java', templatesPath + '/methods/Method.dot', {
                name: name,
                serverName: methodName,
                request: name + 'Request',
                result: name + 'Result',
                response: name + 'Response',
                parametersDescription: parametersDescription,
                parametersCall: parametersCall,
                packageName: packageName
            });
        }
    }

    for(var entity in entities) {
        if(entities.hasOwnProperty(entity)) {
            generateEntity(entity, outDir, data.entities, packageName, templatesPath);
        }
    }

    //utils.generateFile(outDir + '/Server.java', templatesPath + '/Server.dot', {
    //    methods: methods
    //});
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function generate(data, outDir) {
    try {
        var templatesPath = __dirname + '/android';

        utils.createFolder(outDir);
        utils.createFolder(outDir + '/schemas');
        utils.createFolder(outDir + '/enumerations');

        generateMethods(data, outDir, templatesPath);

        return true;
    } catch(error) {
        logger.error('android(): error generating code - ' + error.stack);
        return false;
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
module.exports = {
    generate: generate
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
