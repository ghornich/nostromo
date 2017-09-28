#!/usr/bin/env node

/* eslint-disable no-console */

const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const pathlib = require('path');
const defaults = require('lodash.defaults');
const args = require('minimist')(process.argv.slice(2));
const BrowserSpawners = require('../modules/browser-spawners');
const Loggr = require('../modules/loggr');
const branchConf = require('../branch.conf.json');

/*
args:
config | c ------- configuration base

config overrides?

 */

const DEFAULT_REC_CFG_FILE = 'nostromo.record.conf.js';
const DEFAULT_RUN_CFG_FILE = 'nostromo.run.conf.js';
const DEFAULT_DIFF_CFG_FILE = 'nostromo.diff.conf.js';

(async function () {
    if (args.record || args.rec) {
        const configPath = args.config || args.c || DEFAULT_REC_CFG_FILE;
        let baseConf = {};

        try {
            await fs.statAsync(configPath);
            const absConfigPath = pathlib.resolve(configPath);
            process.chdir(pathlib.dirname(absConfigPath));
            const configFn = require(absConfigPath);

            baseConf = configFn({
                LOG_LEVELS: Loggr.LEVELS,
                Loggr: Loggr,
            });
        }
        catch (e) {
            if (e.code === 'ENOENT') {
                console.log('WARNING: recorder config file not found. Using default settings.');
            }
            else {
                console.log(e.message);
                process.exit(1);
            }
        }

        const conf = defaults({}, baseConf, {
            recorderAppPort: 7700,
            logLevel: Loggr.LEVELS.OFF,
        });

        const RecorderServer = require('./recorder/recorder-server');
        const recServer = new RecorderServer(conf);

        recServer.start();
    }
    else if (args.diff) {
        const configPath = args.config || args.c || DEFAULT_DIFF_CFG_FILE;
        const absConfigPath = pathlib.resolve(configPath);
        process.chdir(pathlib.dirname(absConfigPath));
        const configFn = require(pathlib.resolve(absConfigPath));

        const baseConf = configFn();

        const conf = defaults({}, baseConf, {
        });

        const DiffServer = require('./differ/diff-server');
        const ds = new DiffServer(conf);
        ds.start();
    }
    else if (args.run) {
        try {

            const configPath = args.config || args.c || DEFAULT_RUN_CFG_FILE;
            const absConfigPath = pathlib.resolve(configPath);
            process.chdir(pathlib.dirname(absConfigPath));
            const configFn = require(pathlib.resolve(absConfigPath));
            const baseConf = configFn({
                browsers: BrowserSpawners,
                LOG_LEVELS: Loggr.LEVELS,
            });

            // const conf = defaults({}, baseConf, {
            // });

            const Testrunner = require('./testrunner/testrunner');

            const tr = new Testrunner(baseConf);

            tr.run();
        }
        catch (err) {
            console.error(err);
        }
    }
    else if (args.update) {
        console.log(`Updating Nostromo (branch: ${branchConf.branch})...`);

        const cp = require('child_process');
        const rimraf = require('rimraf');
        const fs = require('fs');

        try {
            fs.unlinkSync('package-lock.json');
        }
        catch (error) {
            // ignore
        }

        rimraf('node_modules', function (err) {
            if (err) {
                console.error(err);
                process.exit(1);
            }

            cp.exec(`npm i ${branchConf.gitUrl}`, function (err) {
                if (err) {
                    console.log('FAILURE');
                    console.error(err);
                }
                else {
                    console.log('SUCCESS');
                }
            })
        });
    }
    else {
        console.log('Missing task type (run, diff, rec, update)');
    }
}());
