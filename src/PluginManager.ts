import { ChildLogger, logger } from './logging/logger';

type CommandArgs = {
    startTime: number;
    endTime: number;
    success: boolean;
    getScreenshot: () => Promise<Buffer>
}

type Hooks = {
    testStart: { testName: string; startTime: number };
    testEnd: { testName: string; success: boolean; endTime: number, errors?: any[] };
    runEnd: { success: boolean; endTime: number };

    click: { selector: string } & CommandArgs;
    delay: { milliseconds: number } & CommandArgs;
    execFunction: { functionName: string; args: any[] } & CommandArgs;
    getValue: { selector: string } & CommandArgs;
    setValue: { selector: string; value: string } & CommandArgs;
    waitForVisible: { selector: string; timeout: number } & CommandArgs;
    waitWhileVisible: { selector: string; timeout: number } & CommandArgs;
};

type HookName = keyof Hooks;

type Plugin = {
    name: string;
    hooks: Partial<Record<HookName, (args: Hooks[HookName]) => Promise<void>>>;
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
