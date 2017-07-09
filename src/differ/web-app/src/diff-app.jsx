var $=require('jquery')
var m=require('mithril')
var JSONF=require('jsonf')
var Buffer=require('buffer')
var pathlib=require('path')
var Promise=require('bluebird')

var get=Promise.method(function(url){return $.get(url)})

window.DiffApp=DiffApp
window.$=$
window.m=m

function DiffApp(conf){
	if (typeof conf ==='string')conf=JSONF.parse(conf)

		/*
		 * ref, current: Image(width, height, pixel base64)
		 * id: path + number
		 * 
		 */
		this.diffs=[]
		this.count=0
}

DiffApp.prototype.start=function(){
	var self=this


    var MountComp={
        view: function () {
            return m(RootComp, { app: self, actions: self.actions })
        }
    }

    // no return
    get(window.location.origin+'/get-diffs')
    .then(function(data){
    	self.diffs=data
    	m.redraw()
    })


    m.mount(document.querySelector('#mount'), MountComp)
}

var RootComp = {
	view: function(vnode){
		var app=vnode.attrs.app
		var actions=vnode.attrs.actions

		return <div class="page">
			<div class="header">
				0/0
				&nbsp;
				&nbsp;
				<button>Prev</button>
				&nbsp;
				<button>Next</button>
			</div>
			<div class="body">
				{
					app.diffs.map(function(diff){return <div class="diff">
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
					})
				}
			</div>
		</div>
	}
}



