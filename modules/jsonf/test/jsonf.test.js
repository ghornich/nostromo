const test = require('tape');
const JSONF = require('../jsonf');

test('JSONF test', t => {

    /* eslint-disable */

	const testObject = {
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
		},
		f: function(){},
		g: {
			regex1: /^[a-z]+ latenc(y|ies)$/gi,
			regex2: /[a-z]*\\\/\..+?/
		}
	};

	/* eslint-enable */

    const stringified = JSONF.stringify(testObject);

    // eslint-disable-next-line no-multi-str
    const expectedStringified = '{"a":[1,2,3,"function (a,b) {\\n\\t\\t\\t/*          */\\n\\t\\t\\treturn a*b\\n\\t\\t}"],\
"b":"function (a){return a*a/*\\n\\n\\n\\t\\t*/}",\
"c":{"d":5},\
"e":"function (x) {\\n\\t\\t\\treturn x + \'\\\\r\\\\n\';\\n\\t\\t}",\
"f":"function (){}",\
"g":{"regex1":"/^[a-z]+ latenc(y|ies)$/gi","regex2":"/[a-z]*\\\\\\\\\\\\/\\\\..+?/"}}';

    t.equal(stringified, expectedStringified);

    const parsed = JSONF.parse(stringified);

    t.equal(parsed.a[1], 2);
    t.equal(parsed.a[3](4, 6), 24);
    t.equal(parsed.b(12), 144);
    t.equal(parsed.c.d, 5);
    t.equal(parsed.e('dog'), 'dog\r\n');

    t.end();
});
