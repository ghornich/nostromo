var SelectorElement = require('../')._SelectorElement
var test = require('tape')

test('SelectorElement::ctor', t => {
    var mockNode = {
        tagName: 'DIV',
        className: 'dummy class',
        name: '',
        parentNode: {
            tagName: 'DIV',
            children: null
        }
    }

    mockNode.parentNode.children = [
        'dummy1',
        'dummy2',
        mockNode
    ]

    var se = new SelectorElement(mockNode)

    t.equal(se.node, mockNode)
    t.equal(se.selector, '.dummy.class')
    t.equal(se.type, SelectorElement.TYPE.CLASS)
    t.equal(se.active, true)
    t.equal(se.useNthChild, false)
    t.equal(se._nthChild, 3)

    t.end()
})


test('SelectorElement::ctor 2', t => {
    var mockNode = {
        tagName: 'INPUT',
        className: '  ',
        name: 'password'
        parentNode: {
            tagName: 'FORM',
            children: []
        }
    }

    mockNode.parentNode.children.push(
        'dummy1',
        'dummy2',
        'dummy3',
        mockNode
        'dummy4',
    )

    var se = new SelectorElement(mockNode)

    t.equal(se.node, mockNode)
    t.equal(se.selector, 'input[name="password"]')
    t.equal(se.type, SelectorElement.TYPE.ATTR)
    t.equal(se.active, true)
    t.equal(se.useNthChild, false)
    t.equal(se._nthChild, 4)

    t.end()
})



// test('SelectorElement::', t => {
    

//     t.end()
// })

