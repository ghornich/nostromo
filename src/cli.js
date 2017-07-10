#!/usr/bin/env node

var pathlib = require('path')
var defaults = require('shallow-defaults')
var args = require('minimist')(process.argv.slice(2))
var BrowserSpawners = require('browser-spawners')
var Loggr=require('loggr')

/*
args:
config | c ------- configuration base

config overrides?

 */

const DEFAULT_REC_CFG_FILE='nostromo.record.conf.js'
const DEFAULT_RUN_CFG_FILE='nostromo.run.conf.js'
const DEFAULT_DIFF_CFG_FILE='nostromo.diff.conf.js'

if (args.record || args.rec) {
    var configPath = args.config||args.c||DEFAULT_REC_CFG_FILE
    var configFn=require(pathlib.resolve(configPath))
    
    var baseConf = configFn({
        LOG_LEVELS: Loggr.LEVELS
    })

    var conf = defaults(baseConf, {
        recorderAppPort: 7700,
        logLevel: Loggr.LEVELS.OFF
    })

    var RecorderServer = require('./recorder/server')
    var recServer = new RecorderServer(conf)

    recServer.start()
}
else if (args.diff) {
    var configPath = args.config||args.c||DEFAULT_DIFF_CFG_FILE
    var configFn=require(pathlib.resolve(configPath))
    
    var baseConf = configFn()

    var conf = defaults(baseConf, {
    })

    var DiffServer=require('./differ/diff-server')
    var ds=new DiffServer(conf)
    ds.start()

    // ds.getDiffableScreenshots()

}
else if (args.run) { // run
    var configPath = args.config||args.c||DEFAULT_RUN_CFG_FILE
    var configFn=require(pathlib.resolve(configPath))
    var baseConf = configFn({
        browsers:BrowserSpawners,
        LOG_LEVELS: Loggr.LEVELS
    })

    var conf = defaults(baseConf, {
        
    })

    var Testrunner = require('./testrunner/testrunner')

    var tr=new Testrunner(baseConf)

    tr.run()
}
else {
    console.log('Missing task type (run, diff, rec)')
}