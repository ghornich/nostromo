module.exports = function (config) {
    return {
        logLevel: config.LOG_LEVELS.DEBUG,
        beforeCapture: function (data) {
        },

        onSelectorBecameVisible: [
            {
                selector: '.dialog--wrap',
                listener: function (recorderInstance) {
                    recorderInstance.addCommand({
                        type: 'waitForVisible',
                        selector: '.dialog--wrap',
                    });
                },
            },
        ],
    };
};
