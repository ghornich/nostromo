var DOMUtils = require('../dom-utils')
var test = require('tape')

test('DOMUtils::hasId', t => {
    t.ok(DOMUtils.hasId({ id: 'testId' }))

    t.notOk(DOMUtils.hasId({ id: '' }))
    t.notOk(DOMUtils.hasId({ id: null }))
    t.notOk(DOMUtils.hasId({ id: undefined }))

    t.end()
})

test('DOMUtils::getId', t => {
    t.equal(DOMUtils.getId({ id: 'testId' }), 'testId')

    t.end()
})

test('DOMUtils::hasClass', t => {
    t.ok(DOMUtils.hasClass({ className: 'test class' }))

    t.notOk(DOMUtils.hasClass({ className: '' }))
    t.notOk(DOMUtils.hasClass({ className: null }))
    t.notOk(DOMUtils.hasClass({ className: undefined }))

    t.end()
})

test('DOMUtils::getClass', t => {
    t.equal(DOMUtils.getClass({ className: 'test class' }), 'test class')

    t.end()
})
