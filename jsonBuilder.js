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

var logger = require('./logger.js');
var common = require('./common.js');
var settings = require('./settings.js');

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// based on:
// https://github.com/x1B/json-builder/blob/master/json-builder.js
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
exports.stream = function jsonStream(stream) {
    // Each stack element is a tuple (isMap:boolean, size:number)
    // isMap: true if the stack frame is a {} (otherwise it is a [])
    // size: number of items in the current {} or []
    var stack = [];
    var danglingKey = false;
    var debugBuffer = '';
    var writeFunc = settings.get().IS_DEBUG ? debugWrite : write;
    
    function top() {
        return stack[stack.length - 1];
    }
    
    function isMap() {
        return stack.length && top()[0];
    }
    
    function size() {
        return stack.length ? top()[1] : 0;
    }
    
    function increment() {
        stack[stack.length - 1][1]++;
    }

    function error(message) {
        logger.error('jsonBuilder: ' + message);
        throw Error(message);
    }

    function write(str) {
        stream.write(str);
    }

    function debugWrite(str) {
        debugBuffer += str;
        write(str);
    }

    function getDebugBuffer() {
        return debugBuffer;
    }
    
    function startValue() {
        if(!stack.length) return;
        if(isMap() && !danglingKey) {
            error('Need key for map value!');
        }
        if(!isMap() && size()) {
            writeFunc(',');
        }
        increment();
        danglingKey = false;
    }

    function map() {
        startValue();
        stack.push([true, 0]);
        writeFunc('{');
        return api;
    }

    function list() {
        startValue();
        stack.push([false, 0]);
        writeFunc('[');
        return api;
    }

    function close() {
        if(!stack.length) {
            error('Nothing to close!');
        }
        if(danglingKey) {
            error('Key written, but no value!');
        }
        if(isMap()) {
            writeFunc('}');
        } else {
            writeFunc(']');
        }
        stack.pop();
        return api;
    }

    function key(key) {
        if(!isMap()) {
            error('Cannot write key in [] only {}.');
        }
        if(danglingKey) {
            error('Key written, but no value!');
        }
        if(size()) {
            writeFunc(',');
        }
        writeFunc(JSON.stringify('' + key));
        writeFunc(':');
        danglingKey = true;
        return api;
    }

    function val(val) {
        return json(JSON.stringify(val));
    }

    function json(json) {
        startValue();
        writeFunc(json);
        return api;
    }

    var api = {
        map: map,
        list: list,
        key: key,
        val: val,
        json: json,
        close: close,
        getDebugBuffer: getDebugBuffer
    };

    return api
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
