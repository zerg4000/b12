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

var fs = require('fs');
var dot = require('dot');
var common = require('../common.js');
var logger = require('../logger.js');

//todo: use templates module
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function createFolder(path) {
    if(!fs.existsSync(path)) {
        logger.verbose('createFolder(): creating folder - ' + path);
        fs.mkdirSync(path);
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function readTemplate(path) {
    logger.verbose('readTemplate(): reading template file - ' + path);
    var data = fs.readFileSync(path, {encoding: 'utf8'});

    //todo: clone!
    var settings = dot.templateSettings;
    settings.strip = false;

    return dot.template(data, settings);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function generateStringFromString(template, templateData) {
    //todo: clone!
    var settings = dot.templateSettings;
    settings.strip = false;

    if(templateData === undefined) {
        templateData = {};
    }

    return dot.template(template, settings)(templateData);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function generateString(template, templateData) {
    if(common.isString(template)) {
        template = readTemplate(template);
    }

    if(templateData === undefined) {
        templateData = {};
    }

    return template(templateData);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function generateFile(fileName, template, templateData) {
    logger.verbose('generateFile(): generating file - ' + fileName);

    fs.writeFileSync(fileName, generateString(template, templateData));
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
module.exports = {
    createFolder: createFolder,
    readTemplate: readTemplate,
    generateString: generateString,
    generateFile: generateFile,
    generateStringFromString: generateStringFromString
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
