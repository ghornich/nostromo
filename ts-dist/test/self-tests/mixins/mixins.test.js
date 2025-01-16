exports = module.exports = function (test) {
    test('mixins', async (t) => {
        await t.mixins.addItem('mixin item');
        await t.screenshot();
    });
};
