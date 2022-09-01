import { TestrunnerConfig } from '../../types';

const pathlib = require('path');
const createServer = require('../utils/create-server').default;
import Chromium from '../../modules/browsers/chromium';

module.exports = function nostromoConfig(): TestrunnerConfig {
    return {
        fileLogLevel: 'info',
        testBailout: true,
        referenceScreenshotsDir: pathlib.resolve(__dirname, '../../../test/self-tests/reference-screenshots'),
        referenceErrorsDir: pathlib.resolve(__dirname, '../../../test/self-tests/reference-errors'),
        referenceDiffsDir: pathlib.resolve(__dirname, '../../../test/self-tests/reference-diffs'),

        imageDiffOptions: {
            colorThreshold: 5,
            imageThreshold: 10,
            grayscaleThreshold: 5,
        },

        assertRetryCount: 3,

        browsers: [
            new Chromium({
                width: 750,
                height: 550,
                // headless: false,
            }),
        ],

        testApiMixins: {
            async openAddDialog(t) {
                await t.click('#show-dialog');
            },
            async addItem(t, itemName) {
                await t.mixins.openAddDialog();
                await t.setValue('#input', itemName);
                await t.click('#add-btn');
            },
        },

        suites: [
            {
                name: 'test-testapp',
                appUrl: 'http://localhost:31667/index.html',
                testFiles: ['./test-testapp.js'],
                beforeCommand: function (t, command) {
                    if (!['assert', 'screenshot'].includes(command.type)) {
                        return t.waitWhileVisible('.loading, #toast');
                    }

                    return t.waitWhileVisible('.loading');
                },
                beforeTest: async function () {
                    this.server = await createServer({ dirToServe: pathlib.resolve(__dirname, '../../../test/self-tests/testapp'), port: 31667 });
                },
                afterTest: async function () {
                    return new Promise(resolve => this.server.close(resolve));
                },
            },
            {
                name: 'basic commands',
                appUrl: 'http://localhost:29336/basic-commands.html',
                testFiles: ['./basic-commands/basic-commands.test.js'],
                beforeCommand: function (t, command) {
                    if (!['assert', 'screenshot'].includes(command.type)) {
                        return t.waitWhileVisible('.loading, #toast');
                    }

                    return t.waitWhileVisible('.loading');
                },
                beforeTest: async function () {
                    this.server = await createServer({ dirToServe: pathlib.resolve(__dirname, '../../../test/self-tests/basic-commands'), port: 29336 });
                },
                afterTest: async function () {
                    return new Promise(resolve => this.server.close(resolve));
                },
            },
            {
                name: 'mixins',
                appUrl: 'http://localhost:31667/index.html',
                testFiles: ['./mixins/mixins.test.js'],
                beforeCommand: function (t, command) {
                    if (!['assert', 'screenshot'].includes(command.type)) {
                        return t.waitWhileVisible('.loading, #toast');
                    }

                    return t.waitWhileVisible('.loading');
                },
                beforeTest: async function () {
                    this.server = await createServer({ dirToServe: pathlib.resolve(__dirname, '../../../test/self-tests/testapp'), port: 31667 });
                },
                afterTest: async function () {
                    return new Promise(resolve => this.server.close(resolve));
                },
            },
        ],
    };
};
