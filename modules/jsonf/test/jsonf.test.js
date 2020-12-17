const JSONF = require('../jsonf');

test('JSONF test', () => {

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
    const parsed = JSONF.parse(stringified);

    expect(parsed.a[1]).toBe(2);
    expect(parsed.a[3](4, 6)).toBe(24);
    expect(parsed.b(12)).toBe(144);
    expect(parsed.c.d).toBe(5);
    expect(parsed.e('dog')).toBe('dog\r\n');
});
