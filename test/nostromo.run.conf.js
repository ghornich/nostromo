module.exports=function(config){
    return {
        logLevel: config.LOG_LEVELS.INFO,
        defaultBeforeCommand:function(t, command) {
            var selectors = [
                '.icon-spinner',
                '.button--icon-loading',
                '.button--working'
            ]

            if (command.type !== 'assertScreenshot') {
                selectors.push(
                    '.global-notifications .notification-message:not(.hide-notification)',
                    '.details-notifications .notification-message:not(.hide-notification)'
                )
            }

            return t.waitWhileVisible(selectors.join(', '))
        },

        // defaultAfterCommand:function(t, command) {

        // },


        beforeTest:function(){
            // console.log('before test')
        },

        afterTest:function(){
            // console.log('after test')
        },


        appUrl: 'http://localhost:21000',

        browsers: [
            new config.browsers.Chrome({
                name:'Chrome',
                path:'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
                // size:{width:1024,height:750}
            }),
            new config.browsers.Firefox({
                name:'Firefox',
                path:'C:/Program Files (x86)/Mozilla Firefox/firefox.exe',
                // size:{width:1024,height:750}
            })
        ],
        testFiles: ['test.js'],
    }
}
