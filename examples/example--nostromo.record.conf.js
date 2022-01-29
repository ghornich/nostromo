'use strict';

exports = module.exports = function (config) {
    return {
        recorderAppPort: 7700,
        logLevel: config.Loggr.LEVELS.WARN,

        captureFilter: function (data) {
            const event = data.event;
            const command = data.command;
            const recorderInstance = data.recorderInstance;
            // ...
            // return false to prevent recording this event
        },

        // pressKeyFilter: same as capture filter. Default: capture only Enter, Esc

        onSelectorBecameVisible: [
            {
                selector: '.my-class a span[name="text1"]',
                listener: function (recorderInstance) {
                    // e.g. insert a command
                    // recorderInstance.addCommand({ type: 'focus', selector: '.password' });
                },
            },
            // ...
        ],

        outputFormatters: [
            {
                name: 'myCustomOutputFormat',
                filename: 'myFilename.abc',
                fn: function (commands) {
                    // ...
                },
            },
            // ...
        ],

        selectedOutputFormatter: 'myCustomOutputFormat',

        mouseoverSelectors: [
            '.highlight a',
            '#add-dialog .close-button',
        ],

        uniqueSelectorOptions: {
            ignoredClasses: [
                'class1',
                'class2',
                // ...
            ],
            // useIds: true/false,
            // preferredClass: /some-classname-[^ ]+/,
            // useClosestParentWithPreferredClass: true/false,
            // preferredClassParentLimit: 5
        },
    };
};
