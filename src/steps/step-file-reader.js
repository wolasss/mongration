'use strict';

var assert = require('assert');
var fs = require('fs');
var crypto = require('crypto');

var merge = require("../utils/utility-functions/deep-merge");

var Step = require('./step');

const md5 = data => crypto.createHash('md5').update(data).digest("hex")

function StepFile(path){
    assert.notEqual(path, null);
    
    this.path = path;
    this.content = null;
    this.checksum = null;
}

StepFile.prototype.read = function(){
    this.content = fs.readFileSync(this.path, {encoding : 'utf8'});
    this.checksum = md5(this.content);

    return this;
}

StepFile.prototype.getStep = function(){
    var obj = require(this.path);
    return new Step(merge(obj, {checksum : this.checksum}));
}

module.exports = StepFile;
