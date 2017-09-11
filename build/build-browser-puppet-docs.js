const fs=require('fs')
const cp=require('child_process')
const pathlib=require('path')

const BROWSER_PUPPETEER_SRC_PATH = pathlib.resolve(__dirname, '../modules/browser-puppeteer/src')
const DOC_PATH = pathlib.resolve(__dirname, '../modules/browser-puppeteer/docs/api.md')

const cpOpts={
    maxBuffer:500*1024
}

let markdown=''

cp.exec(`jsdoc -X -r ${BROWSER_PUPPETEER_SRC_PATH}`, cpOpts, (err, sout, serr)=>{
    try {
        if (err) throw err

        const parsed = JSON.parse(sout)

        let upstreamMsgs=[]
        let downstreamMsgs=[]
        let commands=[]
        let controlMsgTypedef=null
        let upstreamTypedef=null
        let downstreamTypedef=null
        let commandTypedef=null

        for (const item of parsed) {
            if (item.kind!=='typedef')continue

            if (item.name === 'ControlMessage') {
                controlMsgTypedef = item
                continue
            }

            if (item.name === 'UpstreamControlMessage') {
                upstreamTypedef = item
                continue
            }

            if (item.name === 'DownstreamControlMessage') {
                downstreamTypedef = item
                continue
            }

            if (item.name === 'Command') {
                commandTypedef = item
                continue
            }

            if (item.type && item.type.names && item.type.names[0] === 'UpstreamControlMessage') {
                upstreamMsgs.push(item)
                continue
            }

            if (item.type && item.type.names && item.type.names[0] === 'DownstreamControlMessage') {
                downstreamMsgs.push(item)
                continue
            }

            if (item.type && item.type.names && item.type.names[0] === 'Command') {
                commands.push(item)
                continue
            }

            upstreamMsgs=upstreamMsgs.sort(sortByName)
            downstreamMsgs=downstreamMsgs.sort(sortByName)
            commands=commands.sort(sortByName)

        }

        writeln('# BrowserPuppeteer API')

        markdown += `
## Contents
- [Websocket](#websocket)
- [Upstream messages](#upstream-messages)
- [Downstream messages](#downstream-messages)
- [Commands](#commands)
` + markdown

        writeln('## Websocket')

        writeProps(controlMsgTypedef)

        writeln('### Upstream messages')
        writeln('> Client (browser) to server')

        writeProps(upstreamTypedef)

        for (const item of upstreamMsgs) {
            writeProps(item)
        }

        writeln('### Downstream messages')
        writeln('> Server to client (browser)')

        writeProps(downstreamTypedef)

        for (const item of downstreamMsgs) {
            writeProps(item)
        }

        writeln('### Commands')

        writeProps(commandTypedef)

        for (const item of commands) {
            writeProps(item)
        }

        fs.writeFileSync(DOC_PATH, markdown)
    }
    catch (err) {
        console.error(err)
        process.exit(1)
    }
})

function writeln(s,indent=0){markdown+=strtimes('    ',indent)+s+'\n'}

function strtimes(s, t) {
    let result=''
    let i=t

    while(i--){
        result+=s
    }

    return result
}

function sortByName(a,b){
    return a.name<b.name?-1:a.name>b.name?1:0
}

function writeProps(item){
    const itemType = item.type && item.type.names && item.type.names[0]

    itemType
        ? writeln(`- __${item.name}__ - _${itemType}_`)
        : writeln(`- __${item.name}__`)

    if (!item.properties) return

    writeln('')
    writeln('|Name|Type|Description|', 1)
    writeln('|---|---|---|', 1)

    for (const prop of item.properties) {
        let type = prop.type && prop.type.names && prop.type.names[0] || ''
        const description = prop.description || ''

        type = type.replace('.<', '<')

        // console.log(JSON.stringify(prop.type))

        writeln(`| ${prop.name} | \`${type}\` | ${description} |`, 1)
    }
}
