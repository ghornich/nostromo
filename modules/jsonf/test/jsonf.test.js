var test=require('tape')
var JSONF=require('../jsonf')

test(function(t){
	var o={
		a:[1,2,3, function (a,b) {
			/*          */
			return a*b
		}],
		b:function(a){return a*a/*


		*/},
		c:{
			d: 5
		},
		e: function (x) {
			return x + '\r\n';
		}
	}

	var stringified=JSONF.stringify(o)

	var expectedStringified='{"a":[1,2,3,"function (a,b) {\\n\\t\\t\\t/*          */\\n\\t\\t\\treturn a*b\\n\\t\\t}"],\
"b":"function (a){return a*a/*\\n\\n\\n\\t\\t*/}",\
"c":{"d":5},\
"e":"function (x) {\\n\\t\\t\\treturn x + \'\\\\r\\\\n\';\\n\\t\\t}"}'


// '{"a":[1,2,3,{"type":"JSONF:Function","data":"function (a,b) {\\n\\t\\t\\t/*          */\\n\\t\\t\\treturn a*b\\n\\t\\t}"}],\
// "b":{"type":"JSONF:Function","data":"function (a){return a*a/*\\n\\n\\n\\t\\t*/}"},\
// "c":{"d":5}}"'





	t.equal(stringified, expectedStringified)

	var parsed=JSONF.parse(stringified)

	t.equal(parsed.a[1], 2)
	t.equal(parsed.a[3](4,6), 24)
	t.equal(parsed.b(12), 144)
	t.equal(parsed.c.d, 5)
	t.equal(parsed.e('dog'), 'dog\r\n')

	t.end()
})
