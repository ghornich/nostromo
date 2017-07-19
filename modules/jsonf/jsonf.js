'use strict'

// TODO tests
// TODO support ES6 arrow fns

var JSONF=exports

var FN_TYPE='JSONF:Function'



JSONF.stringify=function(o){
    return JSON.stringify(o, function(key,val){
        if (typeof val==='function'){
            return {
                type: FN_TYPE,
                data: val.toString().replace(/\r/g, '\\r').replace(/\n/g, '\\n')
            }
        }
        else {
            return val
        }
    })
}

JSONF.parse=function(s){
    var i=0
    return JSON.parse(s, function(key, val){
        if (val&&val.type===FN_TYPE){
            try {
                return new Function(
                    // http://www.kristofdegrave.be/2012/07/json-serialize-and-deserialize.html
                    val.data.match(/\(([^)]+?)\)/)[1],
                    val.data.match(/\{([\s\S]+)\}/)[1]
                )
            }
            catch (e){
                // TODO throw a big fat error
                return val
            }
        }
        else {
            return val
        }
        /*if (typeof val!=='string')return val
        if (val.indexOf(FN_TYPE)<0)return val

        */
    })
}
