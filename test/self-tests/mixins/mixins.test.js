exports = module.exports = function (test) {
    test('mixins', async t => {
        await t.addItem('mixin item');
        await t.screenshot();
    });
};
