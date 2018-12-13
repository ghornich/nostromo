exports = module.exports = [
    {
        name: 'RecorderApp',
        paths: [
            'src/recorder/ui',
        ],
        command: 'npm run build-ui',
    },
    {
        name: 'BrowserPuppet',
        paths: [
            'modules/browser-puppeteer/src/puppet',
        ],
        command: 'npm run build-browser-puppet',
    },
    {
        name: 'GetUniqueSelector',
        paths: [
            'modules/get-unique-selector/src',
        ],
        command: 'npm run build-get-unique-selector',
    },
    // {
    //     name: 'DiffApp',
    //     paths: [
    //         'src/differ/web-app/src',
    //     ],
    //     command: 'npm run build-diff-app',
    // }
];
