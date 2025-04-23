'use strict';

var assert = require('assert');

var async = require('async');
var fs = require('fs');
var path = require('path');

var merge = require("./utils/utility-functions/deep-merge");

var statuses = require('./utils/constants').statuses;
var MongoConnection = require('./utils/mongo-connection');
var StepFileReader = require('./steps').Reader;
var StepVersionCollection = require('./steps').VersionCollection;
var utilities = require('./utils/utility-functions');

function Migration(dbConfig, dbClient) {
    assert.notEqual(dbConfig.migrationCollection, null);

    this.dbConfig = dbConfig;
    this.steps = [];
    this.migrationFiles = [];
    this.dbClient = dbClient;
    this.collection = dbConfig.migrationCollection;
};

var validate = async function() {
    if(this.db){
        const docs = await this.db.collection(this.collection).find({}, {}).sort({order : 1}).toArray();

        var _steps = utilities.arrayToObject(this.steps, 'id');

        docs.forEach(function(dbStep, index){
            if(this.steps[index]){
                this.steps[index].status = statuses.skipped;   

                if(!_steps[dbStep.id] || (dbStep.order && dbStep.order != _steps[dbStep.id].order)){
                    this.steps[index].status = statuses.error;
                    throw new Error("[" + dbStep.id + "] was already migrated on [" + dbStep.date + "] in a different order. Database order[" + dbStep.order + "] - Current migration on this order[" + this.steps[index].id + "]");
                } else if(dbStep.checksum != this.steps[index].checksum){
                    this.steps[index].status = statuses.error;
                    throw new Error("[" + dbStep.id + "] was already migrated on [" + dbStep.date + "] in a different version. Database version[" + dbStep.checksum + "] - Current version[" + this.steps[index].checksum + "]");
                }
            }
        }.bind(this));

        this.steps = this.steps.map(function(step){
            if(step.status === statuses.notRun){
                step.status = statuses.pending;
            }
            return step;
        });
    }
};

Migration.prototype.add = function(fileList) {
    this.migrationFiles = this.migrationFiles.concat(fileList);
};

Migration.prototype.addAllFromPath = function(dirpath) {
    var fileList = fs.readdirSync(dirpath);
    fileList.map(function(file){
        this.migrationFiles = this.migrationFiles.concat(path.join(dirpath, file));
    }.bind(this));
};

Migration.prototype.migrate = async function() {
    this.migrationFiles.forEach(function(path, index){
        var _step = new StepFileReader(path).read().getStep();
        _step.order = index;
        this.steps.push(_step);
    }.bind(this));

    const client = new MongoConnection(this.dbConfig, this.dbClient);
    this.client = await client.connect();
    this.db = this.client.db(this.dbConfig.db);

    await validate.call(this);

    for(const step of this.steps) {
        if (step.status === statuses.pending) {
            try {
                await step.up(this.db);
                try {
                    await this.db.collection(this.collection).insertOne(new StepVersionCollection(step.id, step.checksum, step.order, new Date()));
                    step.status = statuses.ok;
                } catch (err) {
                    step.status = statuses.error;
                    throw new Error("[" + step.id + "] failed to save migration version: " + err);
                }
            } catch(err) {
                if (err) {
                    step.status = statuses.error;
                    throw new Error("[" + step.id + "] unable to complete migration: " + err);
                }
            }
        }
    }

    await this.client.close();
    
    return this.steps;
};

module.exports = Migration;
