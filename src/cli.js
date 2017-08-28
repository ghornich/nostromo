#!/usr/bin/env node

const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const pathlib = require('path');
const defaults = require('lodash.defaults');
const args = require('minimist')(process.argv.slice(2));
const BrowserSpawners = require('../modules/browser-spawners');
const Loggr = require('../modules/loggr');

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
            const configFn = require(pathlib.resolve(configPath));

            baseConf = configFn({
                LOG_LEVELS: Loggr.LEVELS,
            });
        }
        catch (e) {
            console.log(e.message);
            console.log('Using default conf');
        }

        const conf = defaults({}, baseConf, {
            recorderAppPort: 7700,
            logLevel: Loggr.LEVELS.OFF,
        });

        const RecorderServer = require('./recorder/server');
        const recServer = new RecorderServer(conf);

        recServer.start();
    }
    else if (args.diff) {
        const configPath = args.config || args.c || DEFAULT_DIFF_CFG_FILE;
        const configFn = require(pathlib.resolve(configPath));

        const baseConf = configFn();

        const conf = defaults({}, baseConf, {
        });

        const DiffServer = require('./differ/diff-server');
        const ds = new DiffServer(conf);
        ds.start();

        // ds.getDiffableScreenshots()

    }
    else if (args.run) {
        const configPath = args.config || args.c || DEFAULT_RUN_CFG_FILE;
        const configFn = require(pathlib.resolve(configPath));
        const baseConf = configFn({
            browsers: BrowserSpawners,
            LOG_LEVELS: Loggr.LEVELS,
        });

        const conf = defaults({}, baseConf, {

        });

        const Testrunner = require('./testrunner/testrunner');

        const tr = new Testrunner(baseConf);

        tr.run();
    }
    else {
        console.log('Missing task type (run, diff, rec)');
    }
}());
