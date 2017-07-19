'use strict'

exports=module.exports=function(opts, defaults){
    opts=opts||{}

    Object.keys(defaults).forEach(function(key){
        if (opts[key]===undefined){
            opts[key]=defaults[key]
        }
    })

    return opts
}
