const SelectorElement = require('../src/selector-element');

test('SelectorElement::ctor', () => {
    const mockNode = {
        tagName: 'DIV',
        className: 'dummy class',
        name: '',
        parentNode: {
            tagName: 'DIV',
            children: null,
        },
    };

    mockNode.parentNode.children = [
        'dummy1',
        'dummy2',
        mockNode,
    ];

    const se = new SelectorElement(mockNode);

    expect(se.node).toBe(mockNode);
    expect(se.selector).toBe('.dummy.class');
    expect(se.type).toBe(SelectorElement.TYPE.CLASS);
    expect(se.active).toBe(true);
    expect(se.useNthChild).toBe(false);
    expect(se._nthChild).toBe(3);
});

test('SelectorElement::ctor 2', () => {
    const mockNode = {
        tagName: 'INPUT',
        className: '  ',
        name: 'password',
        parentNode: {
            tagName: 'FORM',
            children: [],
        },
        getAttribute: function (attr) {
            if (attr === 'name') {
                return 'password';
            }

            throw new Error('Mock getAttribute only supports "name"');
        },
    };

    mockNode.parentNode.children.push(
        'dummy1',
        'dummy2',
        'dummy3',
        mockNode,
        'dummy4',
    );

    const se = new SelectorElement(mockNode);

    expect(se.node).toBe(mockNode);
    expect(se.selector).toBe('input[name="password"]');
    expect(se.type).toBe(SelectorElement.TYPE.ATTR);
    expect(se.active).toBe(true);
    expect(se.useNthChild).toBe(false);
    expect(se._nthChild).toBe(4);
});
