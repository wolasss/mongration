#!/usr/bin/env node

import mongration from 'commander';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import merge from "src/utils/utility-functions/deep-merge";
import consoleTable from 'console.table';
import { Migration } from '../index.js'; // Assuming that '../' is the path to the module that exports Migration

mongration
    .option('-f, --folder [value]', 'migrations folder (current dir is default)')
    .option('-h, --hosts [value]', 'mongoDB hosts')
    .option('-d, --database [value]', 'mongoDB database')
    .option('-u, --user [value]', 'mongoDB user')
    .option('-p, --password [value]', 'mongoDB password')
    .option('-m, --migration-collection [value]', 'collection to save migrations state')
    .option('-c, --config [value]', 'path to config file')
    .parse(process.argv);

let config = {};

if (mongration.config) {
    config = await import(path.resolve(mongration.config)); // Using dynamic import for JSON or config files
}

config = merge(config, {
    hosts: mongration.hosts || config.hosts || '',
    db: mongration.database || config.db || '',
    user: mongration.user || config.user || '',
    password: mongration.password || config.password || '',
    migrationCollection: mongration.migrationCollection || config.migrationCollection || '',
    migrationsFolder: path.resolve(mongration.folder || config.folder || './')
});

const files = fs.readdirSync(config.migrationsFolder);

const filePaths = files.map(file => {
    return path.resolve(path.dirname(new URL(import.meta.url).pathname), config.migrationsFolder, file);
});

const migration = new Migration(config);

migration.add(filePaths);

console.log(chalk.blue('Mongration - Migration Runner'));
console.log(chalk.blue('============================='));
console.log('');

const statusesColors = {
    'ok': 'green',
    'skipped': 'green',
    'error': 'red',
    'rollback': 'yellow',
    'rollback-error': 'red'
};

migration.migrate((err, results) => {
    consoleTable(
        results.map(result => {
            const color = statusesColors[result.status] || 'reset';
            return {
                'Migration': chalk[color](result.id),
                'Status': chalk[color](result.status)
            };
        })
    );

    if (err) {
        console.error(chalk.red(err));
        process.exit(1);
    }
});
