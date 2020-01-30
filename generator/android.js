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

var fs = require('fs');
var common = require('../common.js');
var stringUtils = common.stringUtils;
var logger = require('../logger.js');
var utils = require('./utils.js');
var schemaGenerator = require('../schemaGenerator.js');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function generateExceptions(data, outDir, templatesPath) {
    outDir = outDir + '/exceptions/';
    utils.createFolder(outDir);

    templatesPath = templatesPath + '/exceptions';
    utils.generateFile(outDir + '/NetworkException.java', templatesPath + '/NetworkException.dot');

    var template = utils.readTemplate(templatesPath + '/Exception.dot');
    var uid = 1024 + Math.round(Math.random() * 1024);
    var exceptions = [];

    for(var error in data.errors) {
        if(data.errors.hasOwnProperty(error)) {
            var name = stringUtils.toCamelStyle(error, '_') + 'Exception';
            var fileName = outDir + name + '.java';

            utils.generateFile(fileName, template, {
                name: name,
                message: data.errors[error],
                uid: uid
            });

            exceptions.push({
                id: error,
                name: name
            });

            ++uid;
        }
    }

    utils.generateFile(outDir + '/NetworkExceptionFactory.java', templatesPath + '/NetworkExceptionfactory.dot', {
        exceptions: exceptions
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/*function generateEntity(data, outDir, template) {
    outDir = outDir + '/schemas/responses/';
    utils.createFolder(outDir);

    var name = data.title;
    var fileName = outDir + name + '.java';

    utils.generateFile(fileName, template, {
        name: name
    });
}*/

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function generateRequest(requestName, outDir, parameters, parametersDescription, templatesPath) {
    utils.generateFile(outDir + '/' + requestName + '.java', templatesPath + '/schemas/requests/Request.dot', {
        name: requestName,
        parameters: parameters,
        parametersDescription: parametersDescription
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function generateResponse(responseName, resultName, outDir, templatesPath) {
    utils.generateFile(outDir + '/' + responseName + '.java', templatesPath + '/schemas/responses/MethodResponse.dot', {
        responseName: responseName,
        resultName: resultName
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function generateResult(resultName, outputs, outDir, templatesPath) {
    utils.generateFile(outDir + '/' + resultName + '.java', templatesPath + '/schemas/responses/MethodResult.dot', {
        resultName: resultName,
        outputs: outputs
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function generateEntity(entityName, isRequest, outDir, entities, templatesPath) {
    var entity = entities[entityName];
    var generator = new schemaGenerator.ObjectDescriptionGenerator(entities);
    var properties = generator.generate(entity);

    //console.log(JSON.stringify(entity, null, 2));
    //console.log(JSON.stringify(properties, null, 2));

    entityName = stringUtils.capitalizeFirst(entityName);

    var propertiesArray = [];
    var references = {};

    for(var propertyName in properties) {
        if(properties.hasOwnProperty(propertyName)) {
            var property = properties[propertyName];
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
                type: propertyType
            });
        }
    }

    utils.generateFile(outDir + '/' + entityName + '.java', templatesPath + '/schemas/' + (isRequest ? 'requests' : 'responses') + '/Entity.dot', {
        name: entityName,
        properties: propertiesArray
    });
    //todo: recursive
    //console.log(JSON.stringify(references, null, 2));
    for(var reference in references) {
        if(references.hasOwnProperty(reference)) {
            generateEntity(reference, isRequest, outDir, entities, templatesPath);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function generateMethods(data, outDir, templatesPath) {
    var responsesDir = outDir + '/schemas/responses/';
    utils.createFolder(responsesDir);
    var requestsDir = outDir + '/schemas/requests/';
    utils.createFolder(requestsDir);

    var generator = new schemaGenerator.ObjectDescriptionGenerator(data.entities);

    var responseEntities = {};
    var requestEntities = {};
    var methods = [];

    for(var methodName in data.api) {
        if(data.api.hasOwnProperty(methodName) && methodName !== 'getAPI') {
            logger.verbose('generateMethods(): generating method - ' + methodName);

            var fixedMethodName = methodName.replace(/[/\\]/, '_');
            var name = stringUtils.capitalizeFirst(fixedMethodName);
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
                        type: parameterType
                    });
                    if(parameter.isReference) {
                        requestEntities[parameter.type] = true;
                    }
                }
            }

            for(var outputName in outputs) {
                if(outputs.hasOwnProperty(outputName)) {
                    var output = outputs[outputName];
                    if(output.isReference) {
                        var outputType = stringUtils.capitalizeFirst(output.type);
                        responseEntities[output.type] = true;
                    } else {
                        outputType = stringUtils.capitalizeFirst(output.type);
                    }
                    if(output.isArray) {
                        outputType = outputType + '[]';
                    }
                    outputsArray.push({
                        name: outputName,
                        type: outputType
                    });
                }
            }

            //console.log(JSON.stringify(outputsArray, null, 2));

            methods.push({
                name: fixedMethodName,
                serverName: methodName,
                request: name + 'Request',
                result: name + 'Result',
                response: name + 'Response',
                parametersDescription: parametersDescription,
                parametersCall: parametersCall
            });

            generateRequest(name + 'Request', requestsDir, parametersArray, parametersDescription, templatesPath);
            generateResponse(name + 'Response', name + 'Result', responsesDir, templatesPath);
            generateResult(name + 'Result', outputsArray, responsesDir, templatesPath);
        }
    }

    for(var responseEntity in responseEntities) {
        if(responseEntities.hasOwnProperty(responseEntity)) {
            generateEntity(responseEntity, false, responsesDir, data.entities, templatesPath);
        }
    }

    for(var requestEntity in requestEntities) {
        if(requestEntities.hasOwnProperty(requestEntity)) {
            generateEntity(requestEntity, true, requestsDir, data.entities, templatesPath);
        }
    }

    utils.generateFile(outDir + '/Server.java', templatesPath + '/Server.dot', {
        methods: methods
    });
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function generate(data, outDir) {
    try {
        var templatesPath = __dirname + '/android';
        utils.createFolder(outDir);
        utils.generateFile(outDir + '/ApiCallPerformer.java', templatesPath + '/ApiCallPerformer.dot');

        generateExceptions(data, outDir, templatesPath);

        var schemasDir = outDir + '/schemas';
        utils.createFolder(schemasDir);
        utils.generateFile(schemasDir + '/JsonSchema.java', templatesPath + '/schemas/JsonSchema.dot');
        utils.generateFile(schemasDir + '/JsonSchemaEmptyResponse.java', templatesPath + '/schemas/JsonSchemaEmptyResponse.dot');
        utils.generateFile(schemasDir + '/JsonSchemaRequest.java', templatesPath + '/schemas/JsonSchemaRequest.dot');
        utils.generateFile(schemasDir + '/JsonSchemaResponse.java', templatesPath + '/schemas/JsonSchemaResponse.dot');
        utils.generateFile(schemasDir + '/Status.java', templatesPath + '/schemas/Status.dot');

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
