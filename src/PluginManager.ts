import { ChildLogger, logger } from './logging/logger';

type CommandArgs = {
    startTime: number;
    endTime: number;
    success: boolean;
    getScreenshot: () => Promise<Buffer>
}

export type Hooks = {
    testStart: { testId: string, testName: string; startTime: number };
    testEnd: { testId: string, testName: string; success: boolean; endTime: number, errors?: any[] };
    runEnd: { success: boolean; endTime: number };

    suiteStart: { suiteId: string; suiteName: string; startTime: number };
    suiteEnd: { suiteId: string; suiteName: string; endTime: number };

    click: { selector: string } & CommandArgs;
    delay: { amount: number } & CommandArgs;
    execFunction: { functionName: string } & CommandArgs;
    getValue: { selector: string } & CommandArgs;
    screenshot: {selector: string } & CommandArgs;
    scrollTo: { selector: string } & CommandArgs;
    scroll: { selector: string; scrollTop: number } & CommandArgs;
    setValue: { selector: string; value: string } & CommandArgs;
    waitForVisible: { selector: string; timeout: number } & CommandArgs;
    waitWhileVisible: { selector: string; timeout: number } & CommandArgs;
    pressKey: { keyCode: string } & CommandArgs;
    focus: { selector: string } & CommandArgs;
    setFileInput: { selector: string; filePath: string[]; } & CommandArgs;
};

type HookName = keyof Hooks;

export type Plugin = {
    name: string;
    hooks: Partial<{ [K in HookName]: (args: Hooks[K]) => Promise<void> }>;
};

export class PluginManager {
    private plugins: Map<string, Plugin> = new Map();
    private log: ChildLogger

    constructor() {
        this.log = logger.childLogger('PluginManager');
    }

    async loadPlugin(packageName: string): Promise<void> {
        const pluginModule = await import(packageName);
        if (!pluginModule || !pluginModule.default) {
            throw new Error(`Plugin ${packageName} does not export a default module.`);
        }

        const plugin: Plugin = pluginModule.default;
        if (!plugin.name || !plugin.hooks) {
            throw new Error(`Plugin ${packageName} is missing required properties.`);
        }

        this.plugins.set(plugin.name, plugin);
        this.log.info(`Plugin "${plugin.name}" loaded successfully.`);
    }

    async callHook<K extends HookName>(hookId: K, args: Hooks[K]): Promise<void> {
        for (const [pluginName, plugin] of this.plugins) {
            const hook = plugin.hooks[hookId];
            if (hook) {
                try {
                    await hook(args);
                    this.log.info(`Hook "${hookId}" executed for plugin "${pluginName}".`);
                }
                catch (error) {
                    this.log.error(`Error executing hook "${hookId}" for plugin "${pluginName}":`, error);
                }
            }
            else {
                this.log.warn(`Hook "${hookId}" not implemented by plugin "${pluginName}".`);
            }
        }
    }
}
