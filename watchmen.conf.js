exports=module.exports=[
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
];
