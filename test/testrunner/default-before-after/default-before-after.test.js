const test=require('tape')
const cp=require('child_process')
const pathlib=require('path')
const cliPath=pathlib.resolve(__dirname,'../../../src/cli.js')
test('default before/after', t=>{
	const proc = cp.spawn('node',[cliPath, '--run'], {cwd:__dirname})

	let stdout=''

	process.stdout.write('  Running test...')

	proc.stdout.on('data',d=>{
		stdout+=d
		process.stdout.write('.')
	})

	proc.stdout.on('end',()=>{
		console.log('')
	})

	const expectedCode=0

	const expectedStdout=
`TAP version 13
  Starting browser Chrome
# default before/after commands 1
    -- defaultBeforeTest
    -- defaultBeforeCommand
ok 1 click - '.a'
    -- defaultAfterCommand
    -- defaultBeforeCommand
ok 2 click - '.b'
    -- defaultAfterCommand
    -- defaultAfterTest
# default before/after commands 2
    -- defaultBeforeTest
    -- defaultBeforeCommand
ok 3 click - '.c'
    -- defaultAfterCommand
    -- defaultBeforeCommand
ok 4 click - '.d'
    -- defaultAfterCommand
    -- defaultAfterTest
# default before/after commands 3
    -- defaultBeforeTest
    -- defaultBeforeCommand
ok 5 click - '.e'
    -- defaultAfterCommand
    -- defaultBeforeCommand
ok 6 click - '.f'
    -- defaultAfterCommand
    -- defaultAfterTest
# default before/after commands 4
    -- defaultBeforeTest
    -- defaultBeforeCommand
ok 7 click - '.g'
    -- defaultAfterCommand
    -- defaultBeforeCommand
ok 8 click - '.h'
    -- defaultAfterCommand
    -- defaultAfterTest
  Starting browser Firefox
# default before/after commands 1
    -- defaultBeforeTest
    -- defaultBeforeCommand
ok 9 click - '.a'
    -- defaultAfterCommand
    -- defaultBeforeCommand
ok 10 click - '.b'
    -- defaultAfterCommand
    -- defaultAfterTest
# default before/after commands 2
    -- defaultBeforeTest
    -- defaultBeforeCommand
ok 11 click - '.c'
    -- defaultAfterCommand
    -- defaultBeforeCommand
ok 12 click - '.d'
    -- defaultAfterCommand
    -- defaultAfterTest
# default before/after commands 3
    -- defaultBeforeTest
    -- defaultBeforeCommand
ok 13 click - '.e'
    -- defaultAfterCommand
    -- defaultBeforeCommand
ok 14 click - '.f'
    -- defaultAfterCommand
    -- defaultAfterTest
# default before/after commands 4
    -- defaultBeforeTest
    -- defaultBeforeCommand
ok 15 click - '.g'
    -- defaultAfterCommand
    -- defaultBeforeCommand
ok 16 click - '.h'
    -- defaultAfterCommand
    -- defaultAfterTest
1..16
# tests 16
# pass 16
# fail 0
`.replace(/\r/g, '')



	proc.on('error',e=>{
		console.log('  ',e)
	})

	proc.on('exit',code=>{
		t.equals(code, expectedCode)
		t.equals(stdout.replace(/\r/g, ''), expectedStdout)
		t.end()
	})

})
