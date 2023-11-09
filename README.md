# nostromo

(work in progress)

## Testrunner API

```ts
type WaitOptions = { timeout?: number, initialDelay?: number }
```

------

```ts
assert(): Promise<void>
```

Automatic screenshot assert and diff.

```ts
click(selector: string): Promise<void>
```

```ts
delay(ms: number): Promise<void>
```

```ts
execFunction(() => any, ...args: any[]): Promise<void>
```

```ts
focus(selector: string): Promise<void>
```

```ts
getValue(selector: string): Promise<string>
```

```ts
setValue(selector: string, value: string): Promise<void>
```

```ts
setFileInput(fileInputSelector: string, filePath: string[], options?: { waitForVisible?: boolean, checkSelectorType?: boolean }): Promise<void>
```

Throws error if `fileInputSelector` is not a file input.

* `checkSelectorType`: checks if selector is a file input. Default: `true`

```ts
waitForVisible(selector: string, opts?: WaitOptions): Promise<void>
```

```ts
waitWhileVisible(selector: string, opts?: WaitOptions): Promise<void>
```

```ts
isVisible(selector: string): Promise<boolean>
```

```ts
scroll(selector: string, scrollTop: number): Promise<void>
```

```ts
scrollTo(selector: string): Promise<void>
```

```ts
pressKey(keyCode: string): Promise<void>
```

See the [puppeteer API](https://github.com/puppeteer/puppeteer/blob/main/src/common/USKeyboardLayout.ts) for keycodes.

```ts
mouseover(selector: string): Promise<void>
```
