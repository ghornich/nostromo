var resolve = require('path').resolve;

module.exports=function(config){
    return {
        logLevel:config.LOG_LEVELS.INFO,
        appUrl: `file://${ resolve(__dirname, 'test.html') }`,

        browsers: [
            new config.browsers.Chrome({
                name:'Chrome',
                path:'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
                bounds:{size:{width:800,height:600},position:{x:10,y:10}}
            }),
            new config.browsers.Firefox({
                name:'Firefox',
                path:'C:/Program Files (x86)/Mozilla Firefox/firefox.exe',
                bounds:{size:{width:800,height:600},position:{x:10,y:10}}
            })
        ],
        testFiles: ['test.js']
    }
}
