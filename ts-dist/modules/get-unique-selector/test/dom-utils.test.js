const DOMUtils = require('../src/dom-utils');
test('DOMUtils::hasId', () => {
    expect(DOMUtils.hasId({ id: 'testId' })).toBe(true);
    expect(DOMUtils.hasId({ id: '' })).toBe(false);
    expect(DOMUtils.hasId({ id: null })).toBe(false);
    expect(DOMUtils.hasId({ id: undefined })).toBe(false);
});
test('DOMUtils::getId', () => {
    expect(DOMUtils.getId({ id: 'testId' })).toBe('testId');
});
test('DOMUtils::hasClass', () => {
    expect(DOMUtils.hasClass({ className: 'test class' })).toBe(true);
    expect(DOMUtils.hasClass({ className: '' })).toBe(false);
    expect(DOMUtils.hasClass({ className: null })).toBe(false);
    expect(DOMUtils.hasClass({ className: undefined })).toBe(false);
});
test('DOMUtils::getClass', () => {
    expect(DOMUtils.getClass({ className: 'test class' })).toBe('test class');
});
