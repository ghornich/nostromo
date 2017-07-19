'use strict';

var $ = require('jquery');
var m = require('mithril');
var JSONF = require('../../../../modules/jsonf');
var Buffer = require('buffer');
var pathlib = require('path');
var Promise = require('bluebird');

var get = Promise.method(function (url) {
	return $.get(url);
});

window.DiffApp = DiffApp;
window.$ = $;
window.m = m;

function DiffApp(conf) {
	if (typeof conf === 'string') conf = JSONF.parse(conf);

	/*
  * ref, current: Image(width, height, pixel base64)
  * id: path + number
  * 
  */
	this.diffs = [];
	this.count = 0;
}

DiffApp.prototype.start = function () {
	var self = this;

	var MountComp = {
		view: function view() {
			return m(RootComp, { app: self, actions: self.actions });
		}

		// no return
	};get(window.location.origin + '/get-diffs').then(function (data) {
		self.diffs = data;
		m.redraw();
	});

	m.mount(document.querySelector('#mount'), MountComp);
};

var RootComp = {
	view: function view(vnode) {
		var app = vnode.attrs.app;
		var actions = vnode.attrs.actions;

		return m(
			'div',
			{ 'class': 'page' },
			m(
				'div',
				{ 'class': 'header' },
				'0/0 \xA0 \xA0',
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
				app.diffs.map(function (diff) {
					return m(
						'div',
						{ 'class': 'diff' },
						m(
							'div',
							{ 'class': 'diff--left' },
							m('img', { src: 'data:url(image/png;base64,' + diff.refImg.base64 })
						),
						m('div', { 'class': 'diff--sep' }),
						m(
							'div',
							{ 'class': 'diff--right' },
							m('img', { src: 'data:url(image/png;base64,' + diff.failImg.base64 }),
							diff.diffBounds.map(function (bounds) {
								var imgW = diff.refImg.width;
								var imgH = diff.refImg.height;

								var topPc = bounds.y1 / imgH * 100;
								var leftPc = bounds.x1 / imgW * 100;
								var widthPc = bounds.width / imgW * 100;
								var heightPc = bounds.height / imgH * 100;

								return m('div', { 'class': 'diff--bounds', style: ['top:', topPc, '%; left:', leftPc, '%; width: ', widthPc, '%; height: ', heightPc, '%'].join('') });
							})
						)
					);
				})
			)
		);
	}
};
