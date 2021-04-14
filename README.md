# nostromo

(work in progress)

## Testrunner API

`type WaitOptions = { timeout?: number, initialDelay?: number }`

------

`assert(): Promise<void>`

Automatic screenshot assert and diff.

`click(selector: string): Promise<void>`

`delay(ms: number): Promise<void>`

`execFunction(() => any, ...args: any[]): Promise<void>`

`focus(selector: string): Promise<void>`

`getValue(selector: string): Promise<string>`

`setValue(selector: string, value: string): Promise<void>`

`setFileInput(fileInputSelector: string, filePath: string): Promise<void>`

Throws error if `fileInputSelector` is not a file input.

`waitForVisible(selector: string, opts?: WaitOptions): Promise<void>`

`waitWhileVisible(selector: string, opts?: WaitOptions): Promise<void>`

`isVisible(selector: string): Promise<boolean>`

`scroll(selector: string, scrollTop: number): Promise<void>`

`scrollTo(selector: string): Promise<void>`

`pressKey(keyCode: string): Promise<void>`

See the [puppeteer API](https://github.com/puppeteer/puppeteer/blob/main/src/common/USKeyboardLayout.ts) for keycodes.

`mouseover(selector: string): Promise<void>`
