exports=module.exports=Command

// TODO replace magic strings everywhere
var TYPES = Command.TYPES = {
	CLICK: 'click',
	SET_VALUE: 'setValue',
	PRESS_KEY: 'pressKey',
	SCROLL: 'scroll',
	WAIT_FOR_VISIBLE: 'waitForVisible',
	WAIT_WHILE_VISIBLE: 'waitWhileVisible',
	FOCUS: 'focus',
	ASSERT_SCREENSHOT: 'assertScreenshot',

}

function Command(data){
	// var self=this

	// Object.keys(data).forEach(function (key){
	// 	var val=data[key]

	// 	Object.defineProperty(self, key, {
	// 		value:
	// 	})
	// })
}