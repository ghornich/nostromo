'use strict';

var $ = require('jquery');
var m = require('mithril');
var JSONF = require('../../../../modules/jsonf');
var Promise = require('bluebird');

var get = Promise.method(function (url) {
    return $.get(url);
});

var RootComp;

window.DiffApp = DiffApp;
window.$ = $;
window.m = m;

var session = {
    getDiffDescriptors: function getDiffDescriptors() {
        return get(window.location.origin + '/get-diff-descriptors');
    },
    getDiffImagesById: function getDiffImagesById(id) {
        return get(window.location.origin + '/get-diff-images-by-id?id=' + id);
    }
};

function DiffApp(rawConf) {
    var conf = rawConf;

    if (typeof conf === 'string') {
        conf = JSONF.parse(conf);
    }

    /*
     * ref, current: Image(width, height, pixel base64)
     * id: path + number
     * 
     */
    this._diffDescriptors = [];
    this._currentDiffIdx = 0;
    this._currentImages = null;
}

DiffApp.prototype.start = function () {
    var self = this;

    var MountComp = {
        view: function view() {
            return m(RootComp, { app: self, actions: self.actions });
        }
    };

    // no return
    this.initApp();

    m.mount(document.querySelector('#mount'), MountComp);
};

DiffApp.prototype.initApp = function () {
    var self = this;

    // no return
    session.getDiffDescriptors().then(function (descriptors) {
        self._diffDescriptors = descriptors;
    }).then(function () {
        if (self.hasDiffs()) {
            return session.getDiffImagesById(self._diffDescriptors[self._currentDiffIdx].id).then(function (images) {
                self._currentImages = images;
            });
        }
    }).catch(function (err) {
        console.error(err);
    }).finally(function () {
        m.redraw();
    });
};

DiffApp.prototype.hasDiffs = function () {
    return this._diffDescriptors.length > 0;
};

RootComp = {
    view: function view(vnode) {
        var app = vnode.attrs.app;
        var actions = vnode.attrs.actions;

        return m(
            'div',
            { 'class': 'page' },
            m(
                'div',
                { 'class': 'header' },
                app._currentDiffIdx,
                '/',
                app._diffDescriptors.length,
                '\xA0 \xA0',
                m(
                    'button',
                    null,
                    'Prev'
                ),
                '\xA0',
                m(
                    'button',
                    null,
                    'Next'
                )
            ),
            m(
                'div',
                { 'class': 'body' },
                app.hasDiffs() ? m(
                    'div',
                    { 'class': 'diff' },
                    m(
                        'div',
                        { 'class': 'diff--left' },
                        app._currentImages ? m('img', { src: 'data:image/png;base64,' + app._currentImages.refImg }) : '(no image)'
                    ),
                    m('div', { 'class': 'diff--sep' }),
                    m(
                        'div',
                        { 'class': 'diff--right' },
                        app._currentImages ? m('img', { src: 'data:image/png;base64,' + app._currentImages.diffImg }) : '(no image)'
                    )
                ) : 'No diffs'

                /* app._diffDescriptors.map(function(diff){return <div class="diff">
                        <div class="diff--left">
                            <img src={'data:url(image/png;base64,'+diff.refImg.base64} />
                        </div>
                        <div class="diff--sep"></div>
                        <div class="diff--right">
                            <img src={'data:url(image/png;base64,'+diff.failImg.base64} />
                            {
                                diff.diffBounds.map(function(bounds){
                                    var imgW=diff.refImg.width
                                    var imgH=diff.refImg.height
                                     var topPc=bounds.y1/imgH*100
                                    var leftPc=bounds.x1/imgW*100
                                    var widthPc=bounds.width/imgW*100
                                    var heightPc=bounds.height/imgH*100
                                     return <div class="diff--bounds" style={ ['top:', topPc, '%; left:', leftPc, '%; width: ', widthPc, '%; height: ', heightPc, '%'].join('') }></div>
                                })
                            }
                        </div>
                     </div>
                })*/

            )
        );
    }
};
