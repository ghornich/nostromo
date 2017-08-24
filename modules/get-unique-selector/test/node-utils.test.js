var NodeUtils = require('../')._NodeUtils
var test = require('tape')

test('NodeUtils::hasId', t => {
    t.ok(NodeUtils.hasId({ id: 'testId' }))

    t.notOk(NodeUtils.hasId({ id: '' }))
    t.notOk(NodeUtils.hasId({ id: null }))
    t.notOk(NodeUtils.hasId({ id: undefined }))

    t.end()
})

test('NodeUtils::getId', t => {
    t.equal(NodeUtils.getId({ id: 'testId' }), 'testId')

    t.end()
})

test('NodeUtils::hasClass', t => {
    t.ok(NodeUtils.hasClass({ className: 'test class' }))

    t.notOk(NodeUtils.hasClass({ className: '' }))
    t.notOk(NodeUtils.hasClass({ className: null }))
    t.notOk(NodeUtils.hasClass({ className: undefined }))

    t.end()
})

test('NodeUtils::getClass', t => {
    t.equal(NodeUtils.getClass({ className: 'test class' }), 'test class')

    t.end()
})
