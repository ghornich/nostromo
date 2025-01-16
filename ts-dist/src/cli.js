#!/usr/bin/env node
/* eslint-disable no-console, max-statements */
const util = require('util');
const pathlib = require('path');
const args = require('minimist')(process.argv.slice(2));
const DEFAULT_RUN_CFG_FILE = 'nostromo.run.conf.js';
const HELP = `Nostromo usage:
  Modes:
    --run: runs test
      --filter: filter tests by name
    --help (-h): prints this page
  
  Configuration:
    --config (-c): path to run config file
  
  Development
    --debug: shows runtime information about nostromo

  Additional arguments will override respective config values, e.g.:
    --logLevel 1
    --referenceErrorsDir /path/to/dir
`;
run();
async function run() {
    if (args.run) {
        try {
            const configPath = args.config || args.c || DEFAULT_RUN_CFG_FILE;
            const absConfigPath = pathlib.resolve(configPath);
            process.chdir(pathlib.dirname(absConfigPath));
            const configFn = require(pathlib.resolve(absConfigPath));
            const fileConf = await configFn();
            const conf = Object.assign({}, fileConf, args);
            if (args.grep || args.filter) {
                conf.testFilter = args.grep || args.filter;
            }
            if (args.debug) {
                console.log(util.inspect(conf, true, 10));
            }
            const Testrunner = require('./testrunner/testrunner').default;
            const tr = new Testrunner(conf);
            process.on('SIGINT', async () => {
                console.log('Aborting Testrunner...');
                try {
                    await tr.abort();
                }
                catch (error) {
                    console.log('Error while aborting Testrunner:', error);
                }
                process.exit(1);
            });
            await tr.run();
        }
        catch (err) {
            console.error(err);
            process.exit(1);
        }
    }
    else {
        console.log(HELP);
        process.exit(1);
    }
}
