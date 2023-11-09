'use strict';

var assert = require('assert');
var fs = require('fs');
var crypto = require('crypto');

var merge = require("../utils/utility-functions/deep-merge");

var Step = require('./step');

const md5 = data => crypto.createHash('md5').update(data).digest("hex")

function StepFile(content){    
    this.content = content?.default || content;
    this.checksum = null;
}

StepFile.prototype.read = function(){
    this.checksum = md5(JSON.stringify(this.content));

    return this;
}

StepFile.prototype.getStep = function(){
    return new Step(merge(this.content, {checksum : this.checksum}));
}

module.exports = StepFile;
