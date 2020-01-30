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
var common = require('./common.js');
var apiRegistrar = require('./APIRegistrar.js');
var logger = require('./logger.js');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// entities
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.registerEntity = function(entity) {
    if(!entity.title) {
        logger.error('schemas.registerEntity(): entity does not have title - ' + JSON.stringify(entity));
        process.exit(-1);
    }
    if(!entity.id) {
        logger.error('schemas.registerEntity(): entity does not have id - ' + JSON.stringify(entity));
        process.exit(-1);
    }
    if(!apiRegistrar.registerEntity(entity.id, common.clone(entity))) {
        process.exit(-1);
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var empty = {
    type: 'object',
    properties: {},
    additionalProperties: false
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.session = {
    $ref: 'session'
};
exports.registerEntity({
    id: 'session',
    type: 'string',
    title: 'Session',
    description: 'Session descriptor'
    //todo: format '9fcda1a0-a957-11e4-aa7f-25ce182219f8'
});

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.objectId = {
    type: 'string',
    format: 'objectId'
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.objectIdOrEmpty = {
    type: 'string',
    format: 'objectIdOrEmpty',
    minLength: 0
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.version = {
    type: 'string'
    //todo: format
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.email = {
    type: 'string',
    format: 'email'
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.password = {
    type: 'string'
    //todo:
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var sessionSchema = {
    type: 'object',
    properties: {
        session: exports.session
    },
    required: ['session'],
    additionalProperties: false
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.idSchema = {
    type: 'string',
    format: 'objectId',
    description: 'Id of the object.',
    default: '54f732c987afcda81bd0e6d3'
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.idOnlySchema = {
    type: 'object',
    properties: {
        _id: common.clone(exports.idSchema)
    },
    required: ['_id'],
    additionalProperties: false
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.created = {
    type: 'string',
    format: 'timestamp',
    description: 'Time of creation.',
    default: '2015-03-04 16:07:15.204'
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.modified = {
    type: 'string',
    format: 'timestamp',
    description: 'Time of last modification.',
    default: '2015-03-04 16:07:15.204'
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.modifiedCreatedSchema = {
    type: 'object',
    properties: {
        modified: exports.modified,
        created: exports.created
    },
    required: ['modified', 'created'],
    additionalProperties: false
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// schema helpers
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.extendSchema = function(schema1, schema2) {
    var result = common.clone(schema1);
    if(schema2) {
        _.extend(result.properties, common.clone(schema2.properties));
        result.required = _.union(result.required, schema2.required);
    }

    return result;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function createSchema(schema1, schema2, required) {
    // schema2 is JSON schema
    if(schema2.properties !== undefined) {
        return exports.extendSchema(schema1, schema2);
    }

    // schema2 is just properties map
    var result = common.clone(schema1);
    _.extend(result.properties, common.clone(schema2));

    if(result.required === undefined) {
        result.required = [];
    }

    if(required !== undefined) {
        result.required = _.union(result.required, common.clone(required));
    } else {
        // add all
        for(var prop in schema2) {
            if(schema2.hasOwnProperty(prop)) {
                result.required.push(prop);
            }
        }
    }

    return result;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.createSchema = function(schema, required) {
    return createSchema(empty, schema, required);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.createSessionSchema = function(schema, required) {
    if(schema === undefined) {
        return common.clone(sessionSchema);
    }
    return createSchema(sessionSchema, schema, required);
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.createEmptySchema = function() {
    return {
        type: 'object',
        additionalProperties: false
    };
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.createListSchema = function(listName, itemSchema) {
    if(!itemSchema) {
        itemSchema = listName;
        listName = undefined;
    }

    var listSchema = {
        type: 'array',
        items: common.clone(itemSchema),
        additionalProperties: false
    };
    if(!listName) return listSchema;

    var result = {
        type: 'object',
        properties: {},
        required: [listName],
        additionalProperties: false
    };
    result.properties[listName] = listSchema;
    return result;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.createObjectSchema = function(name, itemSchema) {
    var result = {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false
    };
    result.properties[name] = common.clone(itemSchema);
    result.required.push(name);
    return result;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.createMultiObjectSchema = function(items) {
    var result = {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false
    };
    _.each(items, function(item) {
        result.properties[item.name] = common.clone(item.schema);
        result.required.push(item.name);
    });

    return result;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.extractSample = function(schema) {
    if(schema.type == 'object') {
        var sample = {};
        for(var n in schema.properties) {
            sample[n] = exports.extractSample(schema.properties[n]);
        }
        return sample;
    } else if(schema.type == 'array') {
        return [exports.extractSample(schema.items)];
    } else if(schema.$ref) {
        var entity = apiRegistrar.getEntities()[schema.$ref];
        return exports.extractSample(entity);
    } else {
        return schema.default;
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
