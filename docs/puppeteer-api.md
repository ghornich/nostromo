# BrowserPuppeteer API

## Contents
- [Websocket](#websocket)
- [Upstream messages](#upstream-messages)
- [Downstream messages](#downstream-messages)
- [Commands](#commands)
## Websocket
- __ControlMessage__ - _Object_
### Upstream messages
> Client (browser) to server
- __UpstreamControlMessage__ - _ControlMessage_
- __AckMessage__ - _UpstreamControlMessage_

    |Name|Type|Description|
    |---|---|---|
    | type | `String` | 'ack' |
    | result | `*` |  |
- __CapturedEventMessage__ - _UpstreamControlMessage_

    |Name|Type|Description|
    |---|---|---|
    | type | `String` | 'captured-event' |
    | event | `Object` |  |
    | event.type | `String` |  |
    | event.$timestamp | `Number` |  |
    | event.selector | `String` |  |
    | event.$fullSelectorPath | `String` |  |
    | event.target | `Object` |  |
- __ConsolePipeMessage__ - _UpstreamControlMessage_

    |Name|Type|Description|
    |---|---|---|
    | type | `String` | 'console-pipe' |
    | messageType | `String` | 'info', 'log', 'warn', 'error' |
    | message | `String` |  |
- __InsertAssertionMessage__ - _UpstreamControlMessage_

    |Name|Type|Description|
    |---|---|---|
    | type | `String` | 'insert-assertion' |
- __NakMessage__ - _UpstreamControlMessage_

    |Name|Type|Description|
    |---|---|---|
    | type | `String` | 'nak' |
    | error | `Object` |  |
    | error.message | `String` |  |
- __SelectorBecameVisibleMessage__ - _UpstreamControlMessage_

    |Name|Type|Description|
    |---|---|---|
    | type | `String` | 'selector-became-visible' |
    | selector | `String` |  |
### Downstream messages
> Server to client (browser)
- __DownstreamControlMessage__ - _ControlMessage_
- __ClearPersistentDataMessage__ - _DownstreamControlMessage_

    |Name|Type|Description|
    |---|---|---|
    | type | `String` | 'clear-persistent-data' |
- __ExecCommandMessage__ - _DownstreamControlMessage_

    |Name|Type|Description|
    |---|---|---|
    | type | `String` | 'exec-command' |
    | command | `Command` |  |
- __ExecFunctionMessage__ - _DownstreamControlMessage_

    |Name|Type|Description|
    |---|---|---|
    | type | `String` | 'exec-function' |
    | fn | `function` | to stringify this, use fn.toString(). Currently accepts ES5 function literals only (function () {...}) |
    | args | `Array<Any>` | values passed to `fn` |
- __SetIgnoredClassesMessage__ - _DownstreamControlMessage_

    |Name|Type|Description|
    |---|---|---|
    | type | `String` | 'set-ignored-classes' |
    | classes | `Array<String>` |  |
- __SetMouseoverSelectorsMessage__ - _DownstreamControlMessage_

    |Name|Type|Description|
    |---|---|---|
    | type | `String` | 'set-mouseover-selectors' |
    | selectors | `Array<String>` |  |
- __SetSelectorBecameVisibleDataMessage__ - _DownstreamControlMessage_

    |Name|Type|Description|
    |---|---|---|
    | type | `String` | 'set-selector-became-visible-data' |
    | selectors | `Array<String>` |  |
- __SetTransmitEventsMessage__ - _DownstreamControlMessage_

    |Name|Type|Description|
    |---|---|---|
    | type | `String` | 'set-transmit-events' |
    | value | `Boolean` |  |
- __SetUniqueSelectorOptionsMessage__ - _DownstreamControlMessage_

    |Name|Type|Description|
    |---|---|---|
    | type | `String` | 'set-unique-selector-options' |
    | options | `UniqueSelectorOptions` |  |
- __TerminatePuppetMessage__ - _DownstreamControlMessage_

    |Name|Type|Description|
    |---|---|---|
    | type | `String` | 'terminate-puppet' |
### Commands
- __Command__ - _Object_
- __ClickCommand__ - _Command_

    |Name|Type|Description|
    |---|---|---|
    | type | `String` | 'click' |
    | selector | `String` |  |
- __CompositeCommand__ - _Command_

    |Name|Type|Description|
    |---|---|---|
    | type | `String` | 'composite' |
    | commands | `Array<Command>` |  |
- __FocusCommand__ - _Command_

    |Name|Type|Description|
    |---|---|---|
    | type | `String` | 'focus' |
    | selector | `String` |  |
- __GetValueCommand__ - _Command_

    |Name|Type|Description|
    |---|---|---|
    | type | `String` | 'getValue' |
    | selector | `String` |  |
- __IsVisibleCommand__ - _Command_

    |Name|Type|Description|
    |---|---|---|
    | type | `String` | 'isVisible' |
    | selector | `String` |  |
- __MouseoverCommand__ - _Command_

    |Name|Type|Description|
    |---|---|---|
    | type | `String` | 'mouseover' |
    | selector | `String` |  |
- __PressKeyCommand__ - _Command_

    |Name|Type|Description|
    |---|---|---|
    | type | `String` | 'pressKey' |
    | selector | `String` |  |
    | keyCode | `Number` |  |
- __ScrollCommand__ - _Command_

    |Name|Type|Description|
    |---|---|---|
    | type | `String` | 'scroll' |
    | selector | `String` |  |
    | scrollTop | `Number` |  |
- __SetValueCommand__ - _Command_

    |Name|Type|Description|
    |---|---|---|
    | type | `String` | 'setValue' |
    | selector | `String` |  |
    | value | `String` |  |
- __UploadFileAndAssignCommand__ - _Command_

    |Name|Type|Description|
    |---|---|---|
    | type | `String` | 'uploadFileAndAssign' |
    | selector | `String` | unique selector of the file input node |
    | fileData | `Object` |  |
    | fileData.base64 | `String` | base64 encoded file |
    | fileData.name | `String` |  |
    | fileData.mime | `String` | default: {@link DEFAULT_UPLOAD_FILE_MIME} |
    | destinationVariable | `String` | e.g. `'app.files.someFile'` assigns a `File` instance to `window.app.files.someFile` |
- __WaitForVisibleCommand__ - _Command_

    |Name|Type|Description|
    |---|---|---|
    | type | `String` | 'waitForVisible' |
    | selector | `String` |  |
    | pollInterval | `Number` |  |
    | timeout | `Number` |  |
- __WaitWhileVisibleCommand__ - _Command_

    |Name|Type|Description|
    |---|---|---|
    | type | `String` | 'waitWhileVisible' |
    | selector | `String` |  |
    | pollInterval | `Number` |  |
    | initialDelay | `Number` |  |
    | timeout | `Number` |  |
