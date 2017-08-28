var Command=require('./command')
var TYPES=Command.TYPES
var CLICK_FOCUS_MIN_SEPARATION = 200

exports=module.exports=CommandList

function CommandList(commands){
	this._commands=commands||[]
	this._compact()
}

CommandList.prototype._compact=function(){
	if (this._commands.length===0)return

	var newCommands=[]

    for (var i=0,len=this._commands.length;i<len;i++){
        var lastNewIdx=newCommands.length-1
        var lastNewCmd=lastNewIdx>=0?newCommands[lastNewIdx]:null
        var cmd=this._commands[i]

        if (newCommands.length===0) {
            newCommands.push(cmd)
            continue
        }

        var timestampDiff = Math.abs(cmd.$timestamp-lastNewCmd.$timestamp)

        if ((cmd.type===TYPES.CLICK && lastNewCmd.type===TYPES.FOCUS || cmd.type===TYPES.FOCUS && lastNewCmd.type===TYPES.CLICK) &&
                timestampDiff < CLICK_FOCUS_MIN_SEPARATION && stringsSimilar(cmd.$fullSelectorPath, lastNewCmd.$fullSelectorPath)) {
            // insert composite command
            newCommands[lastNewIdx] = {
                type: TYPES.COMPOSITE,
                commands: [lastNewCmd, cmd]
            }
        }
        else if (cmd.type===TYPES.SET_VALUE && lastNewCmd.type===TYPES.SET_VALUE && cmd.selector===lastNewCmd.selector) {
        	newCommands[lastNewIdx]=cmd
        }

        else if (cmd.type===TYPES.FOCUS && lastNewCmd.type===TYPES.FOCUS && cmd.selector===lastNewCmd.selector) {
        	newCommands[lastNewIdx]=cmd
        }
        // TODO ???????
        // else if (cmd.type===TYPES.SCROLL && lastNewCmd.type===TYPES.SCROLL && cmd.selector===lastNewCmd.selector) {
        // 	newCommands[lastNewIdx]=cmd
        // }
        else if (cmd.type===TYPES.ASSERT_SCREENSHOT && lastNewCmd.type===TYPES.ASSERT_SCREENSHOT) {
        	continue
        }
        else {
            newCommands.push(cmd)
        }
    }

    this._commands=newCommands
}

CommandList.prototype.get=function(i){
	return this._commands[i]
}

CommandList.prototype.getList=function(){
	// TODO deep defensive copy?
	return this._commands.slice()
}

CommandList.prototype.add=function(cmd){
	this._commands.push(cmd)
	this._compact()
}

CommandList.prototype.forEach=function(iteratee){
	this._commands.forEach(iteratee)
}

CommandList.prototype.map=function(iteratee){
    return this._commands.map(iteratee)
}

CommandList.prototype.clear=function(){
	this._commands=[]
}

function stringsSimilar(a, b) {
    return a.indexOf(b) >= 0 || b.indexOf(a) >= 0;
}


