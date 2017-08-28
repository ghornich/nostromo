#!/usr/bin/env node

const fs = require('fs');
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

if (args.record || args.rec) {
    var configPath = args.config || args.c || DEFAULT_REC_CFG_FILE;
    var baseConf = {};

    try {
        fs.statSync(configPath);
        var configFn = require(pathlib.resolve(configPath));

        baseConf = configFn({
            LOG_LEVELS: Loggr.LEVELS,
        });
    }
    catch (e) {
        console.log(e.message);
        console.log('Using default conf');
    }

    var conf = defaults({}, baseConf, {
        recorderAppPort: 7700,
        logLevel: Loggr.LEVELS.OFF,
    });

    const RecorderServer = require('./recorder/server');
    const recServer = new RecorderServer(conf);

    recServer.start();
}
else if (args.diff) {
    var configPath = args.config || args.c || DEFAULT_DIFF_CFG_FILE;
    var configFn = require(pathlib.resolve(configPath));

    var baseConf = configFn();

    var conf = defaults({}, baseConf, {
    });

    const DiffServer = require('./differ/diff-server');
    const ds = new DiffServer(conf);
    ds.start();

    // ds.getDiffableScreenshots()

}
else if (args.run) { // run
    var configPath = args.config || args.c || DEFAULT_RUN_CFG_FILE;
    var configFn = require(pathlib.resolve(configPath));
    var baseConf = configFn({
        browsers: BrowserSpawners,
        LOG_LEVELS: Loggr.LEVELS,
    });

    var conf = defaults({}, baseConf, {

    });

    const Testrunner = require('./testrunner/testrunner');

    const tr = new Testrunner(baseConf);

    tr.run();
}
else {
    console.log('Missing task type (run, diff, rec)');
}
