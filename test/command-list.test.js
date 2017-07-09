var tape=require('tape')
var TYPES=require('../src/command').TYPES
var CommandList=require('../src/command-list')

tape('command list test', t=>{
	var list = new CommandList([
		{ type: TYPES.ASSERT_SCREENSHOT },
		{ type: TYPES.SET_VALUE, selector: 'div a', value: 'Adam' },
		{ type: TYPES.SET_VALUE, selector: 'div a', value: 'John' },
		{ type: TYPES.WAIT_FOR_VISIBLE, selector: '.loading' },
		// TODO ?????
		// { type: TYPES.SCROLL, selector: '.scroll', scrollTop: 120 },
		// { type: TYPES.SCROLL, selector: '.scroll', scrollTop: 180 },
		// { type: TYPES.SCROLL, selector: '.scroll', scrollTop: 200 },
		// { type: TYPES.SCROLL, selector: '.scroll', scrollTop: 195 },
		{ type: TYPES.ASSERT_SCREENSHOT },
		{ type: TYPES.ASSERT_SCREENSHOT },
		{ type: TYPES.ASSERT_SCREENSHOT },
		{ type: TYPES.FOCUS, selector: 'input.name' },
		{ type: TYPES.FOCUS, selector: 'input.name' },
		{ type: TYPES.PRESS_KEY, selector: 'input.name', keyCode: 97 },
		{ type: TYPES.PRESS_KEY, selector: 'input.name', keyCode: 97 },
		{ type: TYPES.WAIT_WHILE_VISIBLE, selector: '.toast' },
	])

	var expected=[
		{ type: TYPES.ASSERT_SCREENSHOT },
		{ type: TYPES.SET_VALUE, selector: 'div a', value: 'John' },
		{ type: TYPES.WAIT_FOR_VISIBLE, selector: '.loading' },
		{ type: TYPES.ASSERT_SCREENSHOT },
		{ type: TYPES.FOCUS, selector: 'input.name' },
		{ type: TYPES.PRESS_KEY, selector: 'input.name', keyCode: 97 },
		{ type: TYPES.PRESS_KEY, selector: 'input.name', keyCode: 97 },
		{ type: TYPES.WAIT_WHILE_VISIBLE, selector: '.toast' },
	]

	var actual=list.getList()

	t.deepEquals(actual, expected)
	t.end()
})