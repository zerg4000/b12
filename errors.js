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

//todo: 'use strict';

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function ServerError(message, errorCode) {
    var tmp = Error.call(this);
    tmp.name = 'ServerError';
    tmp.message = message;
    this.name = 'ServerError';
    this.message = message;
    this.type = errorCode;
    this.stack = tmp.stack;
    return this;
}
ServerError.prototype = Object.create(Error.prototype);
ServerError.prototype.constructor = ServerError;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var errorMap = {};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function declareError(base, name, type, defaultMessage) {
    var constructor = function(message) {
        var tmp = Error.call(this);
        tmp.name = name;
        tmp.message = message || defaultMessage;
        this.name = name;
        this.message = tmp.message;
        this.type = type;
        this.stack = tmp.stack;
        return this;
    };
    constructor.name = name;
    constructor.defaultMessage = defaultMessage;
    constructor.prototype = Object.create(base.prototype);
    constructor.prototype.constructor = constructor;

    errorMap[type] = constructor;

    return constructor;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var Internal = declareError(ServerError, 'InternalError', 'internal', 'Internal error.');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function getError(type) {
    return errorMap[type];
}
//todo: what is the difference between NoRight and NotAllowed?
//todo: how to add parameter name (or array of parameter names) to InvalidParameter?
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
module.exports = {
    ServerError: ServerError,
    getError: getError,
    Internal: Internal,
    NotFound: declareError(ServerError, 'NotFoundError', 'not_found', 'Object not found.'),
    AlreadyExists: declareError(ServerError, 'AlreadyExistsError', 'already_exists', 'Object already exists.'),
    InvalidParameter: declareError(ServerError, 'InvalidParameterError', 'invalid_parameter', 'Invalid parameter.'),
    NoRight: declareError(ServerError, 'NoRightError', 'no_right', 'User has no right for this action.'),
    NotAllowed: declareError(ServerError, 'NotAllowedError', 'not_allowed', 'User not allowed to perform this action.'),
    ObjectInUse: declareError(ServerError, 'ObjectInUseError', 'object_in_use', 'Object is in use.'),
    NotImplemented: declareError(Internal, 'NotImplementedError', 'not_implemented',
                                'This functionality not implemented.')
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
